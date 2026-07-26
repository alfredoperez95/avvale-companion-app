import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateSwFormDto, SwFormDeploymentType } from './dto/generate-sw-form.dto';
import { CreateSwFormCatalogItemDto, UpdateSwFormCatalogItemDto } from './dto/sw-form-catalog-item.dto';

const TEMPLATE_RELATIVE_PATH = path.join('assets', 'sw-forms', 'Formulario-de-SW-Template.xlsx');
const PRE_ACCOUNTING_SHEET = 'Pre-Contabilización';
const PRACTICES_SHEET = 'Practicas Nuevas 2026';
const FIRST_LINE_ROW = 11;
const TEMPLATE_LINE_ROWS = 3;
const ORIGINAL_TOTAL_ROW = 15;
const CATALOG_FIRST_ROW = 4;
const CATALOG_LAST_ROW = 207;

export type SwFormCatalogItem = {
  tipoSw: string;
  practica: string;
};

export type SwFormCatalogAdminItem = SwFormCatalogItem & {
  id: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GeneratedSwForm = {
  buffer: Buffer;
  fileName: string;
};

@Injectable()
export class SwFormsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(): Promise<SwFormCatalogItem[]> {
    await this.ensureCatalogSeeded();
    const items = await this.prisma.swFormCatalogItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { tipoSw: 'asc' }],
      select: { tipoSw: true, practica: true },
    });
    return items;
  }

  async listCatalogAdmin(): Promise<SwFormCatalogAdminItem[]> {
    await this.ensureCatalogSeeded();
    return this.prisma.swFormCatalogItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { tipoSw: 'asc' }],
      select: { id: true, tipoSw: true, practica: true, sortOrder: true, createdAt: true, updatedAt: true },
    });
  }

  async createCatalogItem(dto: CreateSwFormCatalogItemDto): Promise<SwFormCatalogAdminItem> {
    const sortOrder = dto.sortOrder ?? (await this.nextCatalogSortOrder());
    try {
      return await this.prisma.swFormCatalogItem.create({
        data: {
          tipoSw: dto.tipoSw.trim(),
          practica: dto.practica.trim(),
          sortOrder,
        },
        select: { id: true, tipoSw: true, practica: true, sortOrder: true, createdAt: true, updatedAt: true },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new BadRequestException('Ya existe un tipo de SW con ese nombre.');
      }
      throw err;
    }
  }

  async updateCatalogItem(id: string, dto: UpdateSwFormCatalogItemDto): Promise<SwFormCatalogAdminItem> {
    try {
      return await this.prisma.swFormCatalogItem.update({
        where: { id },
        data: {
          ...(dto.tipoSw !== undefined && { tipoSw: dto.tipoSw.trim() }),
          ...(dto.practica !== undefined && { practica: dto.practica.trim() }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
        select: { id: true, tipoSw: true, practica: true, sortOrder: true, createdAt: true, updatedAt: true },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new BadRequestException('Ya existe un tipo de SW con ese nombre.');
      }
      if (isNotFoundError(err)) {
        throw new BadRequestException('El tipo de SW no existe.');
      }
      throw err;
    }
  }

  private async ensureCatalogSeeded(): Promise<void> {
    const count = await this.prisma.swFormCatalogItem.count();
    if (count > 0) return;
    const catalog = await this.loadTemplateCatalog();
    await this.prisma.swFormCatalogItem.createMany({
      data: catalog,
      skipDuplicates: true,
    });
  }

  private async loadTemplateCatalog(): Promise<Array<SwFormCatalogItem & { sortOrder: number }>> {
    const workbook = await this.loadTemplateWorkbook();
    const sheet = workbook.getWorksheet(PRACTICES_SHEET);
    if (!sheet) {
      throw new InternalServerErrorException('La plantilla no contiene la hoja de prácticas.');
    }

    const catalog: Array<SwFormCatalogItem & { sortOrder: number }> = [];
    const seen = new Set<string>();
    for (let rowIndex = CATALOG_FIRST_ROW; rowIndex <= CATALOG_LAST_ROW; rowIndex += 1) {
      const tipoSw = cellText(sheet.getCell(`C${rowIndex}`));
      const practica = cellText(sheet.getCell(`D${rowIndex}`));
      if (!tipoSw || !practica || seen.has(tipoSw)) continue;
      seen.add(tipoSw);
      catalog.push({ tipoSw, practica, sortOrder: rowIndex - CATALOG_FIRST_ROW });
    }

    return catalog;
  }

  private async nextCatalogSortOrder(): Promise<number> {
    const last = await this.prisma.swFormCatalogItem.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  async generate(dto: GenerateSwFormDto): Promise<GeneratedSwForm> {
    const catalog = await this.getCatalog();
    const practiceByType = new Map(catalog.map((item) => [item.tipoSw, item.practica]));
    const workbook = await this.loadTemplateWorkbook();
    const sheet = workbook.getWorksheet(PRE_ACCOUNTING_SHEET);
    if (!sheet) {
      throw new InternalServerErrorException('La plantilla no contiene la hoja de pre-contabilización.');
    }

    this.validateLines(dto, practiceByType);
    this.fillHeader(sheet, dto);
    this.prepareLineRows(sheet, dto.lineas.length);
    this.fillLines(sheet, dto, practiceByType);
    this.fillTotals(sheet, dto);

    const generated = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(generated),
      fileName: `Formulario de SW - ${safeFilePart(dto.clienteFacturar)}.xlsx`,
    };
  }

  private async loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
    const templatePath = resolveTemplatePath();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    return workbook;
  }

  private validateLines(dto: GenerateSwFormDto, practiceByType: Map<string, string>): void {
    for (const [index, line] of dto.lineas.entries()) {
      const expectedPractice = practiceByType.get(line.tipoSw);
      if (!expectedPractice) {
        throw new BadRequestException(`La línea ${index + 1} usa un tipo de SW que no existe en la plantilla.`);
      }
      if (line.practica !== expectedPractice) {
        throw new BadRequestException(`La práctica de la línea ${index + 1} no coincide con el catálogo.`);
      }
    }
  }

  private fillHeader(sheet: ExcelJS.Worksheet, dto: GenerateSwFormDto): void {
    setText(sheet, 'C3', dto.clienteFacturar);
    setDate(sheet, 'C4', dto.fechaAceptacion);
    setDate(sheet, 'C5', dto.fechaReconocimiento);
    setText(sheet, 'G3', dto.codigoOferta);
    if (dto.tipo === SwFormDeploymentType.ON_PREMISE && dto.fechaInicioMantenimiento && dto.fechaFinMantenimiento) {
      setDate(sheet, 'C6', dto.fechaInicioMantenimiento);
      setDate(sheet, 'C7', dto.fechaFinMantenimiento);
    } else {
      clearCell(sheet, 'C6');
      clearCell(sheet, 'C7');
    }
    if (dto.tipo === SwFormDeploymentType.ON_PREMISE && dto.codigoMantenimiento) {
      setText(sheet, 'G4', dto.codigoMantenimiento);
    } else {
      clearCell(sheet, 'G4');
    }
    setNumber(sheet, 'C8', dto.aniosReconocer);
    if (dto.comentarios?.trim()) {
      setMultilineText(sheet, 'B18', dto.comentarios);
    } else {
      clearCell(sheet, 'B18');
    }
  }

  private prepareLineRows(sheet: ExcelJS.Worksheet, lineCount: number): void {
    const requiredRows = Math.max(lineCount, TEMPLATE_LINE_ROWS);
    const extraRows = requiredRows - TEMPLATE_LINE_ROWS;
    if (extraRows > 0) {
      sheet.insertRows(FIRST_LINE_ROW + TEMPLATE_LINE_ROWS, Array.from({ length: extraRows }, () => []), 'i');
      for (let rowIndex = FIRST_LINE_ROW + TEMPLATE_LINE_ROWS; rowIndex < FIRST_LINE_ROW + requiredRows; rowIndex += 1) {
        copyRowStyle(sheet, FIRST_LINE_ROW + TEMPLATE_LINE_ROWS - 1, rowIndex);
      }
    }

    for (let rowIndex = FIRST_LINE_ROW; rowIndex < FIRST_LINE_ROW + requiredRows; rowIndex += 1) {
      clearLineRow(sheet, rowIndex);
    }
  }

  private fillLines(sheet: ExcelJS.Worksheet, dto: GenerateSwFormDto, practiceByType: Map<string, string>): void {
    dto.lineas.forEach((line, index) => {
      const rowIndex = FIRST_LINE_ROW + index;
      const practice = practiceByType.get(line.tipoSw) ?? line.practica;
      const target = targetFromTipoSw(line.tipoSw);

      setText(sheet, `B${rowIndex}`, line.tipoSw);
      setText(sheet, `I${rowIndex}`, practice);

      if (target === 'maintenance') {
        setFormula(sheet, `E${rowIndex}`, `C${rowIndex}-D${rowIndex}`, 0);
        setNumber(sheet, `F${rowIndex}`, line.precioVenta);
        setNumber(sheet, `G${rowIndex}`, line.coste);
        setFormula(sheet, `H${rowIndex}`, `F${rowIndex}-G${rowIndex}`, line.precioVenta - line.coste);
        return;
      }

      setNumber(sheet, `C${rowIndex}`, line.precioVenta);
      setNumber(sheet, `D${rowIndex}`, line.coste);
      setFormula(sheet, `E${rowIndex}`, `C${rowIndex}-D${rowIndex}`, line.precioVenta - line.coste);
      setFormula(sheet, `H${rowIndex}`, `F${rowIndex}-G${rowIndex}`, 0);
    });
  }

  private fillTotals(sheet: ExcelJS.Worksheet, dto: GenerateSwFormDto): void {
    const lineRows = Math.max(dto.lineas.length, TEMPLATE_LINE_ROWS);
    const first = FIRST_LINE_ROW;
    const last = FIRST_LINE_ROW + lineRows - 1;
    const totalRow = ORIGINAL_TOTAL_ROW + Math.max(0, lineRows - TEMPLATE_LINE_ROWS);
    const totals = dto.lineas.reduce(
      (acc, line) => {
        const target = targetFromTipoSw(line.tipoSw);
        if (target === 'maintenance') {
          acc.maintenancePrice += line.precioVenta;
          acc.maintenanceCost += line.coste;
          return acc;
        }
        acc.licensePrice += line.precioVenta;
        acc.licenseCost += line.coste;
        return acc;
      },
      { licensePrice: 0, licenseCost: 0, maintenancePrice: 0, maintenanceCost: 0 },
    );

    const resultByColumn: Record<string, number> = {
      C: totals.licensePrice,
      D: totals.licenseCost,
      E: totals.licensePrice - totals.licenseCost,
      F: totals.maintenancePrice,
      G: totals.maintenanceCost,
      H: totals.maintenancePrice - totals.maintenanceCost,
    };

    for (const column of ['C', 'D', 'E', 'F', 'G', 'H']) {
      setFormula(sheet, `${column}${totalRow}`, `SUM(${column}${first}:${column}${last})`, resultByColumn[column]);
    }
  }
}

function targetFromTipoSw(tipoSw: string): 'license' | 'maintenance' {
  const isMaintenance = /maintenance/i.test(tipoSw);
  const isLicense = /licen[cs]e/i.test(tipoSw);
  return isMaintenance && !isLicense ? 'maintenance' : 'license';
}

function resolveTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), TEMPLATE_RELATIVE_PATH),
    path.resolve(process.cwd(), 'backend', TEMPLATE_RELATIVE_PATH),
    path.resolve(__dirname, '..', '..', TEMPLATE_RELATIVE_PATH),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new InternalServerErrorException('No se encontró la plantilla de Formularios de SW.');
  }
  return found;
}

function clearLineRow(sheet: ExcelJS.Worksheet, rowIndex: number): void {
  for (const column of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
    sheet.getCell(`${column}${rowIndex}`).value = null;
  }
}

function copyRowStyle(sheet: ExcelJS.Worksheet, sourceRowIndex: number, targetRowIndex: number): void {
  const sourceRow = sheet.getRow(sourceRowIndex);
  const targetRow = sheet.getRow(targetRowIndex);
  targetRow.height = sourceRow.height;
  sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
    const targetCell = targetRow.getCell(colNumber);
    targetCell.style = { ...sourceCell.style };
  });
}

function setText(sheet: ExcelJS.Worksheet, ref: string, value: string): void {
  sheet.getCell(ref).value = value.trim();
}

function setMultilineText(sheet: ExcelJS.Worksheet, ref: string, value: string): void {
  const cell = sheet.getCell(ref);
  cell.value = value.trim();
  cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
}

function setDate(sheet: ExcelJS.Worksheet, ref: string, value: string): void {
  const date = new Date(`${value}T00:00:00`);
  const cell = sheet.getCell(ref);
  cell.value = date;
  cell.numFmt = 'dd/mm/yyyy';
}

function setNumber(sheet: ExcelJS.Worksheet, ref: string, value: number): void {
  const cell = sheet.getCell(ref);
  cell.value = value;
  cell.numFmt = '#,##0.00';
}

function setFormula(sheet: ExcelJS.Worksheet, ref: string, formula: string, result: number | undefined): void {
  sheet.getCell(ref).value = result == null ? { formula } : { formula, result };
}

function clearCell(sheet: ExcelJS.Worksheet, ref: string): void {
  sheet.getCell(ref).value = null;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('').trim();
  return String(value).trim();
}

function safeFilePart(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .trim();
  return normalized || 'cliente';
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}
