import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { BillingAdminContactsService } from '../billing-admin-contacts/billing-admin-contacts.service';
import { ActivationStatus } from '@prisma/client';
import { CreateActivationDto } from './dto/create-activation.dto';
import { UpdateActivationDto } from './dto/update-activation.dto';
import { MakeService } from '../make/make.service';
import { buildMakeWebhookPayload, ActivationForMakePayload } from '../make/make-webhook-payload';
import { EmailSignatureService } from '../email-signature/email-signature.service';
import { formatActivationCode } from './activation-code';

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
type ProjectJpResolution = { name: string; email: string; source: 'AUTO' | 'MANUAL' } | null;
type ActivationRecipients = { recipientTo: string; recipientCc: string | null };

function normalizeEmailHtmlSpacing(
  html: string | null,
  options?: { preserveTrailingBreaks?: boolean },
): string | null {
  if (!html?.trim()) return html ?? null;
  let out = html;
  const preserveTrailingBreaks = options?.preserveTrailingBreaks ?? false;
  // Normaliza párrafos vacíos a un salto explícito.
  out = out.replace(
    /<p\b[^>]*>\s*(?:&nbsp;|\s|<span>\s*&nbsp;\s*<\/span>|<span>\s*<\/span>|<br\s*\/?>)*\s*<\/p>/gi,
    '<br>',
  );
  // Convierte estructura de párrafos a saltos <br> para que cada salto de línea sea explícito.
  out = out.replace(/<p\b[^>]*>/gi, '');
  out = out.replace(/<\/p>/gi, '<br>');
  // Mantiene saltos simples o dobles; evita ráfagas largas.
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
  // Evita saltos sobrantes al principio/fin.
  out = out.replace(/^\s*(?:<br\s*\/?>\s*)+/i, '');
  if (!preserveTrailingBreaks) {
    out = out.replace(/(?:<br\s*\/?>\s*)+\s*$/i, '');
  }
  return out;
}

@Injectable()
export class ActivationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly attachmentsService: AttachmentsService,
    private readonly billingAdminContactsService: BillingAdminContactsService,
    private readonly makeService: MakeService,
    private readonly emailSignatureService: EmailSignatureService,
  ) {}

  /** Devuelve la base pública del backend con sufijo /api (exactamente una vez). */
  private async getBackendApiBaseUrl(): Promise<string> {
    const raw =
      this.config.get<string>('BACKEND_PUBLIC_URL') ??
      this.config.get<string>('NEXT_PUBLIC_API_URL') ??
      'http://localhost:4000';
    const clean = raw.trim().replace(/\/+$/, '');
    const withoutApiSuffix = clean.replace(/\/api$/i, '');
    let resolved = `${withoutApiSuffix}/api`;
    let source: 'env' | 'ngrok' = 'env';
    const looksLocalhost =
      /^https?:\/\/localhost(?::\d+)?(\/|$)/i.test(withoutApiSuffix) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?(\/|$)/i.test(withoutApiSuffix);
    if (looksLocalhost) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1200);
        const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = (await res.json()) as {
            tunnels?: { public_url?: string; proto?: string }[];
          };
          const tunnel = data.tunnels?.find((t) => t.public_url?.startsWith('https://'));
          if (tunnel?.public_url) {
            resolved = `${tunnel.public_url.replace(/\/+$/, '')}/api`;
            source = 'ngrok';
          }
        }
      } catch {
        // fallback a localhost si ngrok no está disponible
      }
    }
    return resolved;
  }

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
        if (a.ownerUserId !== userId) {
          throw new BadRequestException('Las áreas deben pertenecer a tu configuración personal');
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
        if (s.area.ownerUserId !== userId) {
          throw new BadRequestException('Las subáreas deben pertenecer a tu configuración personal');
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

  /** Emails de CC automáticos: directores de práctica + contactos de subárea involucrados. */
  private async getAutoCcEmails(areaIds: string[], subAreaIds: string[]): Promise<string[]> {
    const { directors, subAreaContacts } = await this.getRecipientsFromAreasAndSubAreas(
      areaIds,
      subAreaIds,
    );
    return this.mergeEmailLists(directors, subAreaContacts);
  }

  /** Parte de CC introducida manualmente (excluye auto), para rellenar el formulario de edición. */
  private async computeManualCcEmails(
    recipientCc: string | null | undefined,
    areaIds: string[],
    subAreaIds: string[],
  ): Promise<string[]> {
    const autoSet = new Set(await this.getAutoCcEmails(areaIds, subAreaIds));
    return this.splitEmails(recipientCc).filter((e) => !autoSet.has(e));
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
    const activation = await this.prisma.activation.findFirst({
      where: { id: activationId },
      include: {
        activationAreas: { include: { area: { select: { id: true, name: true } } } },
        activationSubAreas: {
          include: {
            subArea: {
              include: { area: { select: { id: true, name: true } } },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            fileName: true,
            originalUrl: true,
            contentType: true,
            createdAt: true,
            publicToken: true,
          },
        },
        createdByUser: { select: { name: true, lastName: true, email: true } },
      },
    });
    if (!activation) throw new NotFoundException('Activation no encontrada');
    const areaIds = activation.activationAreas.map((a) => a.areaId);
    const subAreaIds = activation.activationSubAreas.map((a) => a.subAreaId);
    const manualCcEmails = await this.computeManualCcEmails(
      activation.recipientCc,
      areaIds,
      subAreaIds,
    );
    return { ...activation, manualCcEmails };
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
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            fileName: true,
            originalUrl: true,
            contentType: true,
            createdAt: true,
            publicToken: true,
          },
        },
        createdByUser: { select: { name: true, lastName: true, email: true } },
      },
    });
    if (!activation) throw new NotFoundException('Activation no encontrada');
    const areaIds = activation.activationAreas.map((a) => a.areaId);
    const subAreaIds = activation.activationSubAreas.map((a) => a.subAreaId);
    const manualCcEmails = await this.computeManualCcEmails(
      activation.recipientCc,
      areaIds,
      subAreaIds,
    );
    return { ...activation, manualCcEmails };
  }

  /** Dispara el webhook de Make con el payload v4 (incl. firma global); si OK → READY_TO_SEND + makeRunId; si falla → ERROR + errorMessage. Solo DRAFT o ERROR. */
  async requestSend(activationId: string, userId: string) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    if (activation.status !== ActivationStatus.DRAFT && activation.status !== ActivationStatus.ERROR) {
      throw new BadRequestException(
        `No se puede enviar: estado actual es ${activation.status}. Solo DRAFT o ERROR.`,
      );
    }

    await this.attachmentsService.publishForActivation(activationId);
    const refreshed = await this.findOneByIdAndUser(activationId, userId);

    const signatureHtml = await this.emailSignatureService.getContent(userId);
    const emailSignature = signatureHtml.trim() ? signatureHtml : null;
    const attachmentsBaseUrl = await this.getBackendApiBaseUrl();
    const payload = buildMakeWebhookPayload(refreshed as ActivationForMakePayload, {
      emailSignature,
      attachmentsBaseUrl,
    });
    const normalizedPayload = {
      ...payload,
      body: normalizeEmailHtmlSpacing(payload.body, { preserveTrailingBreaks: true }),
      emailSignature: normalizeEmailHtmlSpacing(payload.emailSignature),
    };
    const result = await this.makeService.triggerWebhook(normalizedPayload);

    if (result.success) {
      await this.prisma.activation.update({
        where: { id: activationId },
        data: {
          status: ActivationStatus.READY_TO_SEND,
          makeRunId: result.makeRunId ?? null,
          errorMessage: null,
          lastStatusAt: new Date(),
        },
      });
    } else {
      await this.prisma.activation.update({
        where: { id: activationId },
        data: {
          status: ActivationStatus.ERROR,
          errorMessage: result.errorMessage ?? 'Error desconocido al contactar con Make',
          lastStatusAt: new Date(),
        },
      });
    }

    return this.findOneByIdAndUser(activationId, userId);
  }

  /** Elimina una activación solo si pertenece al usuario. */
  async remove(activationId: string, userId: string): Promise<void> {
    await this.findOneByIdAndUser(activationId, userId);
    await this.attachmentsService.deleteAttachmentsForActivation(activationId);
    await this.prisma.activation.delete({ where: { id: activationId } });
  }
}
