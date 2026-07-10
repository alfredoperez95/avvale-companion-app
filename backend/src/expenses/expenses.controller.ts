import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { ExpensesService } from './expenses.service';
import { ExpenseExportService } from './expense-export.service';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { GenerateExpenseExportDto } from './dto/generate-expense-export.dto';
import { SyncExpenseImportStatusDto } from './dto/sync-expense-import-status.dto';
import { EXPENSE_DEFAULT_MAX_FILE_BYTES } from './expenses.config';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly expenseExports: ExpenseExportService,
  ) {}

  @Get()
  list(@CurrentUser() user: UserPayload) {
    return this.expenses.list(user.userId);
  }

  @Post('extract')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: EXPENSE_DEFAULT_MAX_FILE_BYTES },
    }),
  )
  extract(@CurrentUser() user: UserPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.expenses.extract(user.userId, file);
  }

  @Post('convert-heic')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: EXPENSE_DEFAULT_MAX_FILE_BYTES },
    }),
  )
  async convertHeic(@UploadedFile() file: Express.Multer.File | undefined, @Res() res: Response) {
    const converted = await this.expenses.convertHeicUpload(file);
    res.setHeader('Content-Type', converted.mimeType);
    res.setHeader('Content-Disposition', attachmentDisposition(converted.fileName));
    res.send(converted.buffer);
  }

  @Post('exports')
  async exportMonth(@CurrentUser() user: UserPayload, @Body() dto: GenerateExpenseExportDto, @Res() res: Response) {
    const generated = await this.expenseExports.generateExport(user.userId, dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', attachmentDisposition(generated.fileName));
    res.setHeader('X-Export-Expires-At', generated.expiresAt.toISOString());
    res.send(generated.csv);
  }

  @Post('import-payload')
  importPayload(@CurrentUser() user: UserPayload, @Body() dto: GenerateExpenseExportDto) {
    return this.expenseExports.generateImportPayload(user.userId, dto);
  }

  @Post('import-status')
  syncImportStatus(@CurrentUser() user: UserPayload, @Body() dto: SyncExpenseImportStatusDto) {
    return this.expenses.syncImportStatus(user.userId, dto);
  }

  @Post(':id/retry-extract')
  retryExtract(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.expenses.retryExtract(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: UserPayload, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(user.userId, id, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.expenses.getOne(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.expenses.remove(user.userId, id);
  }

  @Get(':id/file')
  @Header('Cache-Control', 'private, max-age=300')
  async file(@CurrentUser() user: UserPayload, @Param('id') id: string, @Res() res: Response) {
    const download = await this.expenses.getFile(user.userId, id);
    res.setHeader('Content-Type', download.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(download.fileName));
    res.send(download.buffer);
  }
}

function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\w.\- ]+/g, '_').replace(/"/g, '');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\w.\- ]+/g, '_').replace(/"/g, '');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
