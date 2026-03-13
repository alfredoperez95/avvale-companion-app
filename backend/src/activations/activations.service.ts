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

  /** Obtiene emails de contactos de las áreas dadas; devuelve { recipientTo, recipientCc }. */
  private async getRecipientsFromAreaIds(areaIds: string[]): Promise<{ recipientTo: string; recipientCc: string | null }> {
    if (areaIds.length === 0) {
      return { recipientTo: PLACEHOLDER_RECIPIENT, recipientCc: null };
    }
    const contacts = await this.prisma.areaContact.findMany({
      where: { areaId: { in: areaIds } },
      select: { email: true },
    });
    const emails = [...new Set(contacts.map((c) => c.email.trim()))].filter(Boolean);
    const recipientTo = emails.length > 0 ? emails.join(', ') : PLACEHOLDER_RECIPIENT;
    return { recipientTo, recipientCc: null };
  }

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    const subject = buildSubject(dto.projectName, dto.client ?? null);
    const { recipientTo, recipientCc } = await this.getRecipientsFromAreaIds(dto.areaIds);
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
        recipientCc,
        subject,
        body: dto.body ?? null,
        attachmentUrls: dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null,
      },
    });
    await this.prisma.activationArea.createMany({
      data: dto.areaIds.map((areaId) => ({ activationId: activation.id, areaId })),
    });
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
    if (dto.body !== undefined) data.body = dto.body || null;
    if (dto.attachmentUrls !== undefined) {
      data.attachmentUrls = dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null;
    }
    if (dto.areaIds !== undefined) {
      await this.prisma.activationArea.deleteMany({ where: { activationId } });
      if (dto.areaIds.length > 0) {
        await this.prisma.activationArea.createMany({
          data: dto.areaIds.map((areaId) => ({ activationId, areaId })),
        });
      }
      const { recipientTo, recipientCc } = await this.getRecipientsFromAreaIds(dto.areaIds);
      data.recipientTo = recipientTo;
      data.recipientCc = recipientCc;
    }
    await this.prisma.activation.update({ where: { id: activationId }, data });
    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Obtiene una activación solo si pertenece al usuario, con áreas. */
  async findOneByIdAndUser(activationId: string, userId: string) {
    const activation = await this.prisma.activation.findFirst({
      where: { id: activationId, createdByUserId: userId },
      include: {
        activationAreas: { include: { area: { select: { id: true, name: true } } } },
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
