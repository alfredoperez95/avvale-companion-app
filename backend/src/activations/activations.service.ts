import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';

@Injectable()
export class ActivationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    return this.prisma.activation.create({
      data: {
        createdByUserId: userId,
        createdBy: createdByLabel,
        status: ActivationStatus.DRAFT,
        projectName: dto.projectName,
        offerCode: dto.offerCode,
        hubspotUrl: dto.hubspotUrl ?? null,
        recipientTo: dto.recipientTo,
        recipientCc: dto.recipientCc ?? null,
        subject: dto.subject,
        templateCode: dto.templateCode,
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
