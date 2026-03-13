import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';
import { UpdateActivationDto } from './dto/update-activation.dto';

/** Genera el asunto en formato: Activación AEP - CLIENTE - Proyecto */
function buildSubject(projectName: string, client: string | null): string {
  const clientPart = (client ?? '').trim().toUpperCase();
  const projectPart = (projectName ?? '').trim();
  return `Activación AEP - ${clientPart} - ${projectPart}`;
}

const PLACEHOLDER_RECIPIENT = 'sin-destinatarios@pendiente';

@Injectable()
export class ActivationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Obtiene emails: areaIds = área completa (director + todos contactos subáreas); subAreaIds = solo director del área + contactos de esas subáreas. */
  private async getRecipientsFromAreasAndSubAreas(
    areaIds: string[],
    subAreaIds: string[] = [],
  ): Promise<{ recipientTo: string; recipientCc: string | null }> {
    const emails = new Set<string>();

    if (areaIds.length > 0) {
      const areas = await this.prisma.area.findMany({
        where: { id: { in: areaIds } },
        select: {
          directorEmail: true,
          subAreas: {
            select: {
              contacts: { select: { email: true } },
            },
          },
        },
      });
      for (const area of areas) {
        if (area.directorEmail?.trim()) emails.add(area.directorEmail.trim().toLowerCase());
        for (const sub of area.subAreas) {
          for (const c of sub.contacts) {
            if (c.email?.trim()) emails.add(c.email.trim().toLowerCase());
          }
        }
      }
    }

    if (subAreaIds.length > 0) {
      const subAreas = await this.prisma.subArea.findMany({
        where: { id: { in: subAreaIds } },
        select: {
          areaId: true,
          area: { select: { directorEmail: true } },
          contacts: { select: { email: true } },
        },
      });
      const areaIdsFromSubAreas = new Set(subAreas.map((s) => s.areaId));
      for (const areaId of areaIdsFromSubAreas) {
        const areaRow = subAreas.find((s) => s.areaId === areaId);
        if (areaRow?.area.directorEmail?.trim()) {
          emails.add(areaRow.area.directorEmail.trim().toLowerCase());
        }
      }
      for (const sub of subAreas) {
        for (const c of sub.contacts) {
          if (c.email?.trim()) emails.add(c.email.trim().toLowerCase());
        }
      }
    }

    const list = [...emails].filter(Boolean);
    const recipientTo = list.length > 0 ? list.join(', ') : PLACEHOLDER_RECIPIENT;
    return { recipientTo, recipientCc: null };
  }

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    const areaIds = dto.areaIds ?? [];
    const subAreaIds = dto.subAreaIds ?? [];
    if (areaIds.length === 0 && subAreaIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un área o subárea involucrada');
    }
    const subject = buildSubject(dto.projectName, dto.client ?? null);
    const { recipientTo } = await this.getRecipientsFromAreasAndSubAreas(areaIds, subAreaIds);
    const activation = await this.prisma.activation.create({
      data: {
        createdByUserId: userId,
        createdBy: createdByLabel,
        status: ActivationStatus.DRAFT,
        projectName: dto.projectName,
        client: dto.client ?? null,
        offerCode: dto.offerCode,
        hubspotUrl: dto.hubspotUrl ?? null,
        recipientTo,
        recipientCc: dto.recipientCc?.trim() || null,
        subject,
        body: dto.body ?? null,
        attachmentUrls: dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null,
      },
    });
    if (areaIds.length > 0) {
      await this.prisma.activationArea.createMany({
        data: areaIds.map((areaId) => ({ activationId: activation.id, areaId })),
      });
    }
    if (subAreaIds.length > 0) {
      await this.prisma.activationSubArea.createMany({
        data: subAreaIds.map((subAreaId) => ({ activationId: activation.id, subAreaId })),
      });
    }
    return this.findOneByIdAndUser(activation.id, userId);
  }

  /** Lista solo activaciones del usuario (filtrado server-side). */
  async findAllByUser(userId: string, filters?: { status?: ActivationStatus }) {
    return this.prisma.activation.findMany({
      where: {
        createdByUserId: userId,
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Actualiza una activación solo si es DRAFT y pertenece al usuario. */
  async update(activationId: string, userId: string, dto: UpdateActivationDto) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    if (activation.status !== ActivationStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden editar activaciones en estado DRAFT');
    }
    const data: Record<string, unknown> = {};
    if (dto.projectName !== undefined) data.projectName = dto.projectName;
    if (dto.client !== undefined) data.client = dto.client || null;
    if (dto.offerCode !== undefined) data.offerCode = dto.offerCode;
    if (dto.hubspotUrl !== undefined) data.hubspotUrl = dto.hubspotUrl || null;
    const projectName = (dto.projectName !== undefined ? dto.projectName : activation.projectName) ?? '';
    const client = dto.client !== undefined ? dto.client : activation.client;
    data.subject = buildSubject(projectName, client);
    if (dto.recipientCc !== undefined) data.recipientCc = dto.recipientCc?.trim() || null;
    if (dto.body !== undefined) data.body = dto.body || null;
    if (dto.attachmentUrls !== undefined) {
      data.attachmentUrls = dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null;
    }
    if (dto.areaIds !== undefined || dto.subAreaIds !== undefined) {
      const areaIds = dto.areaIds ?? activation.activationAreas?.map((a) => a.areaId) ?? [];
      const subAreaIds = dto.subAreaIds ?? activation.activationSubAreas?.map((a) => a.subAreaId) ?? [];
      if (areaIds.length === 0 && subAreaIds.length === 0) {
        throw new BadRequestException('Selecciona al menos un área o subárea involucrada');
      }
      await this.prisma.activationArea.deleteMany({ where: { activationId } });
      await this.prisma.activationSubArea.deleteMany({ where: { activationId } });
      if (areaIds.length > 0) {
        await this.prisma.activationArea.createMany({
          data: areaIds.map((areaId) => ({ activationId, areaId })),
        });
      }
      if (subAreaIds.length > 0) {
        await this.prisma.activationSubArea.createMany({
          data: subAreaIds.map((subAreaId) => ({ activationId, subAreaId })),
        });
      }
      const { recipientTo } = await this.getRecipientsFromAreasAndSubAreas(areaIds, subAreaIds);
      data.recipientTo = recipientTo;
    }
    await this.prisma.activation.update({ where: { id: activationId }, data });
    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Obtiene una activación solo si pertenece al usuario, con áreas y subáreas. */
  async findOneByIdAndUser(activationId: string, userId: string) {
    const activation = await this.prisma.activation.findFirst({
      where: { id: activationId, createdByUserId: userId },
      include: {
        activationAreas: { include: { area: { select: { id: true, name: true } } } },
        activationSubAreas: {
          include: {
            subArea: {
              include: { area: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!activation) throw new NotFoundException('Activation no encontrada');
    return activation;
  }

  /** Marca como READY_TO_SEND y opcionalmente llama al webhook de Make. Solo DRAFT o ERROR. */
  async requestSend(activationId: string, userId: string) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    if (activation.status !== ActivationStatus.DRAFT && activation.status !== ActivationStatus.ERROR) {
      throw new BadRequestException(
        `No se puede enviar: estado actual es ${activation.status}. Solo DRAFT o ERROR.`,
      );
    }
    await this.prisma.activation.update({
      where: { id: activationId },
      data: {
        status: ActivationStatus.READY_TO_SEND,
        lastStatusAt: new Date(),
      },
    });
    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Elimina una activación solo si pertenece al usuario. */
  async remove(activationId: string, userId: string): Promise<void> {
    await this.findOneByIdAndUser(activationId, userId);
    await this.prisma.activation.delete({ where: { id: activationId } });
  }
}
