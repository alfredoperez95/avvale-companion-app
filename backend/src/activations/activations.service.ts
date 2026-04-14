import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { BillingAdminContactsService } from '../billing-admin-contacts/billing-admin-contacts.service';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';
import { UpdateActivationDto } from './dto/update-activation.dto';
import { EmailSignatureService } from '../email-signature/email-signature.service';
import { formatActivationCode } from './activation-code';
import { ActivationSendProducer } from '../queue/producers/activation-send-producer.service';
import { ActivationLookupService } from './activation-lookup.service';

/** Asunto provisional antes de conocer activationNumber (misma forma legacy sin código). */
function buildSubjectWithoutCode(projectName: string, client: string | null): string {
  const clientPart = (client ?? '').trim().toUpperCase();
  const projectPart = (projectName ?? '').trim();
  return `Activación AEP - ${clientPart} - ${projectPart}`;
}

/** Asunto con código visible al final: Activación AEP - CLIENTE - Proyecto [ACT-000124] */
function buildSubject(projectName: string, client: string | null, activationNumber: number): string {
  const clientPart = (client ?? '').trim().toUpperCase();
  const projectPart = (projectName ?? '').trim();
  const code = formatActivationCode(activationNumber);
  return `Activación AEP - ${clientPart} - ${projectPart} [${code}]`;
}

const PLACEHOLDER_RECIPIENT = 'sin-destinatarios@pendiente';

/** Misma semántica que el parse de `attachmentUrls` en frontend (`activation-attachment-urls`). */
function parseActivationAttachmentUrlsField(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((u) => String(u).trim()).filter(Boolean);
    }
    return [String(parsed).trim()].filter(Boolean);
  } catch {
    return raw.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
  }
}

type ProjectJpResolution = { name: string; email: string; source: 'AUTO' | 'MANUAL' } | null;
type ActivationRecipients = { recipientTo: string; recipientCc: string | null };

@Injectable()
export class ActivationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly attachmentsService: AttachmentsService,
    private readonly billingAdminContactsService: BillingAdminContactsService,
    private readonly emailSignatureService: EmailSignatureService,
    private readonly activationLookup: ActivationLookupService,
    @Inject(forwardRef(() => ActivationSendProducer))
    private readonly activationSendProducer: ActivationSendProducer,
  ) {}

  /** Áreas y subáreas de una activación deben pertenecer al árbol personal del usuario (no al catálogo sistema). */
  private async assertActivationAreasOwnedByUser(
    userId: string,
    areaIds: string[],
    subAreaIds: string[],
  ): Promise<void> {
    if (areaIds.length > 0) {
      const areas = await this.prisma.area.findMany({
        where: { id: { in: areaIds } },
        select: { id: true, ownerUserId: true },
      });
      if (areas.length !== areaIds.length) {
        throw new BadRequestException('Una o más áreas no existen');
      }
      for (const a of areas) {
        const allowed =
          a.ownerUserId === null || a.ownerUserId === userId; /* legado: copias personales antiguas */
        if (!allowed) {
          throw new BadRequestException(
            'Las áreas deben ser del catálogo global o de tu configuración anterior',
          );
        }
      }
    }
    if (subAreaIds.length > 0) {
      const subAreas = await this.prisma.subArea.findMany({
        where: { id: { in: subAreaIds } },
        select: { id: true, area: { select: { ownerUserId: true } } },
      });
      if (subAreas.length !== subAreaIds.length) {
        throw new BadRequestException('Una o más subáreas no existen');
      }
      for (const s of subAreas) {
        const allowed =
          s.area.ownerUserId === null || s.area.ownerUserId === userId; /* legado */
        if (!allowed) {
          throw new BadRequestException(
            'Las subáreas deben ser del catálogo global o de tu configuración anterior',
          );
        }
      }
    }
  }

  /** Obtiene emails: areaIds = área completa (director + todos contactos subáreas); subAreaIds = solo director del área + contactos de esas subáreas. */
  private async getRecipientsFromAreasAndSubAreas(
    areaIds: string[],
    subAreaIds: string[] = [],
  ): Promise<{ subAreaContacts: string[]; directors: string[] }> {
    const subAreaContactEmails = new Set<string>();
    const directorEmails = new Set<string>();

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
        if (area.directorEmail?.trim()) directorEmails.add(area.directorEmail.trim().toLowerCase());
        for (const sub of area.subAreas) {
          for (const c of sub.contacts) {
            if (c.email?.trim()) subAreaContactEmails.add(c.email.trim().toLowerCase());
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
          directorEmails.add(areaRow.area.directorEmail.trim().toLowerCase());
        }
      }
      for (const sub of subAreas) {
        for (const c of sub.contacts) {
          if (c.email?.trim()) subAreaContactEmails.add(c.email.trim().toLowerCase());
        }
      }
    }

    return {
      subAreaContacts: [...subAreaContactEmails].filter(Boolean),
      directors: [...directorEmails].filter(Boolean),
    };
  }

  /** Obtiene los emails de Facturación y Administración (To). */
  private async getBillingAdminEmails(): Promise<string[]> {
    const billingEmails = await this.billingAdminContactsService.findAllEmails();
    return billingEmails.filter(Boolean);
  }

  private splitEmails(raw: string | null | undefined): string[] {
    return (raw ?? '')
      .split(/[,\n;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .filter((e) => e !== PLACEHOLDER_RECIPIENT);
  }

  private mergeEmailLists(...lists: Array<string[] | null | undefined>): string[] {
    const merged = new Set<string>();
    for (const list of lists) {
      for (const email of list ?? []) {
        const normalized = email.trim().toLowerCase();
        if (normalized) merged.add(normalized);
      }
    }
    return [...merged];
  }

  private async buildRecipients(
    areaIds: string[],
    subAreaIds: string[],
    createdByEmail: string | null | undefined,
    projectJpEmail: string | null | undefined,
    manualCcRaw: string | null | undefined,
  ): Promise<ActivationRecipients> {
    const areaRecipients = await this.getRecipientsFromAreasAndSubAreas(areaIds, subAreaIds);
    const billingAdminEmails = await this.getBillingAdminEmails();

    const toList = this.mergeEmailLists(
      billingAdminEmails,
      this.splitEmails(createdByEmail),
      this.splitEmails(projectJpEmail),
    );
    const ccList = this.mergeEmailLists(
      areaRecipients.directors,
      areaRecipients.subAreaContacts,
      this.splitEmails(manualCcRaw),
    );

    const recipientTo = toList.length > 0 ? toList.join(', ') : PLACEHOLDER_RECIPIENT;
    const recipientCc = ccList.length > 0 ? ccList.join(', ') : null;
    return { recipientTo, recipientCc };
  }

  private async resolveProjectJp(
    areaIds: string[],
    subAreaIds: string[],
    projectJpContactId?: string | null,
    projectJpAutoSubAreaContactId?: string | null,
  ): Promise<ProjectJpResolution> {
    if (projectJpContactId) {
      const manual = await this.prisma.ccContact.findUnique({
        where: { id: projectJpContactId },
        select: { name: true, email: true },
      });
      if (!manual) {
        throw new BadRequestException('El contacto manual de JP no existe');
      }
      return { name: manual.name, email: manual.email.trim().toLowerCase(), source: 'MANUAL' };
    }

    if (subAreaIds.length > 0) {
      const firstSubAreaId = subAreaIds[0];
      const firstSubArea = await this.prisma.subArea.findUnique({
        where: { id: firstSubAreaId },
        select: {
          contacts: {
            where: { isProjectJp: true },
            orderBy: [{ name: 'asc' }, { email: 'asc' }],
            select: { id: true, name: true, email: true },
          },
        },
      });
      const winner =
        firstSubArea?.contacts.find((c) => c.id === projectJpAutoSubAreaContactId) ??
        firstSubArea?.contacts[0];
      if (winner) {
        return { name: winner.name, email: winner.email.trim().toLowerCase(), source: 'AUTO' };
      }
    }

    if (areaIds.length > 0) {
      const firstAreaId = areaIds[0];
      const firstArea = await this.prisma.area.findUnique({
        where: { id: firstAreaId },
        select: {
          subAreas: {
            select: {
              contacts: {
                where: { isProjectJp: true },
                select: { name: true, email: true },
              },
            },
          },
        },
      });
      const candidates =
        firstArea?.subAreas
          .flatMap((s) => s.contacts)
          .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email)) ?? [];
      if (candidates.length > 0) {
        const winner = candidates[0];
        return { name: winner.name, email: winner.email.trim().toLowerCase(), source: 'AUTO' };
      }
    }

    return null;
  }

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    const areaIds = dto.areaIds ?? [];
    const subAreaIds = dto.subAreaIds ?? [];
    if (areaIds.length === 0 && subAreaIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un área o subárea involucrada');
    }
    await this.assertActivationAreasOwnedByUser(userId, areaIds, subAreaIds);
    const projectJp = await this.resolveProjectJp(
      areaIds,
      subAreaIds,
      dto.projectJpContactId,
      dto.projectJpAutoSubAreaContactId,
    );
    const { recipientTo, recipientCc } = await this.buildRecipients(
      areaIds,
      subAreaIds,
      createdByLabel,
      projectJp?.email,
      dto.recipientCc,
    );

    const activation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.activation.create({
        data: {
          createdByUserId: userId,
          createdBy: createdByLabel,
          status: ActivationStatus.DRAFT,
          projectName: dto.projectName,
          client: dto.client ?? null,
          offerCode: dto.offerCode,
          projectAmount: dto.projectAmount.trim() || null,
          projectType: dto.projectType,
          hubspotUrl: dto.hubspotUrl ?? null,
          projectJpName: projectJp?.name ?? null,
          projectJpEmail: projectJp?.email ?? null,
          projectJpSource: projectJp?.source ?? null,
          recipientTo,
          recipientCc,
          subject: buildSubjectWithoutCode(dto.projectName, dto.client ?? null),
          body: dto.body ?? null,
          attachmentUrls: dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null,
          attachmentNames: dto.attachmentNames?.length ? JSON.stringify(dto.attachmentNames) : null,
        },
      });
      await tx.activation.update({
        where: { id: created.id },
        data: {
          subject: buildSubject(dto.projectName, dto.client ?? null, created.activationNumber),
        },
      });
      if (areaIds.length > 0) {
        await tx.activationArea.createMany({
          data: areaIds.map((areaId) => ({ activationId: created.id, areaId })),
        });
      }
      if (subAreaIds.length > 0) {
        await tx.activationSubArea.createMany({
          data: subAreaIds.map((subAreaId) => ({ activationId: created.id, subAreaId })),
        });
      }
      return created;
    });

    if (dto.attachmentUrls?.length) {
      await this.attachmentsService.saveActivationAttachments(activation.id, dto.attachmentUrls);
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
      include: {
        createdByUser: { select: { name: true, lastName: true, email: true } },
      },
    });
  }

  /** Lista todas las activaciones (solo para ADMIN). */
  async findAllForAdmin(filters?: { status?: ActivationStatus }) {
    return this.prisma.activation.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { name: true, lastName: true, email: true } },
      },
    });
  }

  /** Obtiene una activación por id sin filtrar por usuario (para ADMIN). */
  async findOneById(activationId: string) {
    return this.activationLookup.findOneById(activationId);
  }

  async previewProjectJp(
    userId: string,
    areaIds: string[],
    subAreaIds: string[],
    projectJpContactId?: string | null,
    projectJpAutoSubAreaContactId?: string | null,
  ) {
    if (areaIds.length > 0 || subAreaIds.length > 0) {
      await this.assertActivationAreasOwnedByUser(userId, areaIds, subAreaIds);
    }
    const projectJp = await this.resolveProjectJp(
      areaIds,
      subAreaIds,
      projectJpContactId,
      projectJpAutoSubAreaContactId,
    );
    let autoCandidates: { id: string; name: string; email: string }[] = [];
    if (!projectJpContactId && subAreaIds.length > 0) {
      const firstSubArea = await this.prisma.subArea.findUnique({
        where: { id: subAreaIds[0] },
        select: {
          contacts: {
            where: { isProjectJp: true },
            orderBy: [{ name: 'asc' }, { email: 'asc' }],
            select: { id: true, name: true, email: true },
          },
        },
      });
      autoCandidates =
        firstSubArea?.contacts.map((c) => ({ id: c.id, name: c.name, email: c.email })) ?? [];
    }
    return {
      projectJpName: projectJp?.name ?? null,
      projectJpEmail: projectJp?.email ?? null,
      projectJpSource: projectJp?.source ?? null,
      autoCandidates,
    };
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
    if (dto.projectAmount !== undefined) data.projectAmount = dto.projectAmount.trim() || null;
    if (dto.projectType !== undefined) data.projectType = dto.projectType;
    if (dto.hubspotUrl !== undefined) data.hubspotUrl = dto.hubspotUrl || null;
    const projectName = (dto.projectName !== undefined ? dto.projectName : activation.projectName) ?? '';
    const client = dto.client !== undefined ? dto.client : activation.client;
    data.subject = buildSubject(projectName, client, activation.activationNumber);
    const manualCcRaw = dto.recipientCc !== undefined ? dto.recipientCc : activation.recipientCc;
    if (dto.body !== undefined) data.body = dto.body || null;
    if (dto.attachmentUrls !== undefined) {
      data.attachmentUrls = dto.attachmentUrls?.length ? JSON.stringify(dto.attachmentUrls) : null;
      await this.attachmentsService.deleteAttachmentsForActivation(activationId);
      if (dto.attachmentUrls.length > 0) {
        await this.attachmentsService.saveActivationAttachments(activationId, dto.attachmentUrls);
      }
    }
    if (dto.attachmentNames !== undefined) {
      data.attachmentNames = dto.attachmentNames?.length ? JSON.stringify(dto.attachmentNames) : null;
    }
    if (
      dto.areaIds !== undefined ||
      dto.subAreaIds !== undefined ||
      dto.projectJpContactId !== undefined ||
      dto.projectJpAutoSubAreaContactId !== undefined ||
      dto.recipientCc !== undefined
    ) {
      const areaIds = dto.areaIds ?? activation.activationAreas?.map((a) => a.areaId) ?? [];
      const subAreaIds = dto.subAreaIds ?? activation.activationSubAreas?.map((a) => a.subAreaId) ?? [];
      if (areaIds.length === 0 && subAreaIds.length === 0) {
        throw new BadRequestException('Selecciona al menos un área o subárea involucrada');
      }
      if (dto.areaIds !== undefined || dto.subAreaIds !== undefined) {
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
      }
      const projectJp = await this.resolveProjectJp(
        areaIds,
        subAreaIds,
        dto.projectJpContactId,
        dto.projectJpAutoSubAreaContactId,
      );
      const { recipientTo, recipientCc } = await this.buildRecipients(
        areaIds,
        subAreaIds,
        activation.createdByUser?.email,
        projectJp?.email,
        manualCcRaw,
      );
      data.recipientTo = recipientTo;
      data.recipientCc = recipientCc;
      data.projectJpName = projectJp?.name ?? null;
      data.projectJpEmail = projectJp?.email ?? null;
      data.projectJpSource = projectJp?.source ?? null;
    }
    await this.prisma.activation.update({ where: { id: activationId }, data });
    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Obtiene una activación solo si pertenece al usuario, con áreas, subáreas y adjuntos. */
  async findOneByIdAndUser(activationId: string, userId: string) {
    return this.activationLookup.findOneByIdAndUser(activationId, userId);
  }

  /**
   * Publica adjuntos y encola el envío al webhook de Make (BullMQ). Respuesta rápida en QUEUED;
   * el worker pasa a PROCESSING / PENDING_CALLBACK o FAILED / RETRYING.
   */
  async requestSend(activationId: string, userId: string) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    const canSend =
      activation.status === ActivationStatus.DRAFT ||
      activation.status === ActivationStatus.FAILED ||
      activation.status === ActivationStatus.RETRYING;
    if (!canSend) {
      throw new BadRequestException(
        `No se puede enviar: estado actual es ${activation.status}. Solo DRAFT, FAILED o RETRYING.`,
      );
    }
    if (!activation.body?.trim()) {
      throw new BadRequestException(
        'Debes seleccionar una plantilla (o definir el cuerpo del correo) antes de enviar la activación.',
      );
    }

    const restorableStatus = activation.status;

    await this.attachmentsService.publishForActivation(activationId);
    await this.findOneByIdAndUser(activationId, userId);

    await this.prisma.activation.update({
      where: { id: activationId },
      data: {
        status: ActivationStatus.QUEUED,
        queuedAt: new Date(),
        processingStartedAt: null,
        errorMessage: null,
        lastStatusAt: new Date(),
      },
    });

    try {
      const bullJobId = await this.activationSendProducer.enqueueSendActivation({
        activationId,
        userId,
      });
      await this.prisma.activation.update({
        where: { id: activationId },
        data: { bullJobId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.activation.update({
        where: { id: activationId },
        data: {
          status: restorableStatus,
          errorMessage: `No se pudo encolar el envío (¿Redis caído?). ${msg}`.slice(0, 2000),
          lastStatusAt: new Date(),
        },
      });
      throw err;
    }

    return this.findOneByIdAndUser(activationId, userId);
  }

  /**
   * Descarga en servidor las URLs escaneadas guardadas en la activación (excluye HubSpot)
   * y las registra como adjuntos; omite URLs ya importadas.
   */
  async importScannedAttachmentUrls(activationId: string, userId: string) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    const urls = parseActivationAttachmentUrlsField(activation.attachmentUrls);
    if (urls.length === 0) {
      return {
        saved: [] as string[],
        failed: [] as { url: string; error: string }[],
        skippedHubSpot: [] as string[],
        skippedAlreadyPresent: [] as string[],
      };
    }
    return this.attachmentsService.saveActivationAttachments(activationId, urls);
  }

  /** Elimina una activación solo si pertenece al usuario. */
  async remove(activationId: string, userId: string): Promise<void> {
    await this.findOneByIdAndUser(activationId, userId);
    await this.attachmentsService.deleteAttachmentsForActivation(activationId);
    await this.prisma.activation.delete({ where: { id: activationId } });
  }
}
