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

@Injectable()
export class ActivationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    const subject = buildSubject(dto.projectName, dto.client ?? null);
    return this.prisma.activation.create({
      data: {
        createdByUserId: userId,
        createdBy: createdByLabel,
        status: ActivationStatus.DRAFT,
        projectName: dto.projectName,
        client: dto.client ?? null,
        offerCode: dto.offerCode,
        hubspotUrl: dto.hubspotUrl ?? null,
        recipientTo: dto.recipientTo,
        recipientCc: dto.recipientCc ?? null,
        subject,
        templateCode: dto.templateCode,
        body: dto.body ?? null,
        attachmentUrls: dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null,
      },
    });
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
    if (dto.recipientTo !== undefined) data.recipientTo = dto.recipientTo;
    if (dto.recipientCc !== undefined) data.recipientCc = dto.recipientCc || null;
    const projectName = (dto.projectName !== undefined ? dto.projectName : activation.projectName) ?? '';
    const client = dto.client !== undefined ? dto.client : activation.client;
    data.subject = buildSubject(projectName, client);
    if (dto.templateCode !== undefined) data.templateCode = dto.templateCode;
    if (dto.body !== undefined) data.body = dto.body || null;
    if (dto.attachmentUrls !== undefined) {
      data.attachmentUrls = dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null;
    }
    await this.prisma.activation.update({ where: { id: activationId }, data });
    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Obtiene una activación solo si pertenece al usuario. */
  async findOneByIdAndUser(activationId: string, userId: string) {
    const activation = await this.prisma.activation.findFirst({
      where: { id: activationId, createdByUserId: userId },
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
}
