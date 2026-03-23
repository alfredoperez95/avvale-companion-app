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

/** Asunto con código visible: Activación AEP [ACT-000124] - CLIENTE - Proyecto */
function buildSubject(projectName: string, client: string | null, activationNumber: number): string {
  const clientPart = (client ?? '').trim().toUpperCase();
  const projectPart = (projectName ?? '').trim();
  const code = formatActivationCode(activationNumber);
  return `Activación AEP [${code}] - ${clientPart} - ${projectPart}`;
}

const PLACEHOLDER_RECIPIENT = 'sin-destinatarios@pendiente';

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
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd7e201' },
      body: JSON.stringify({
        sessionId: 'd7e201',
        runId: 'post-fix',
        hypothesisId: 'A_B',
        location: 'activations.service.ts:getBackendApiBaseUrl',
        message: 'Resolved backend api base URL',
        data: {
          hasBackendPublicUrl: Boolean(this.config.get<string>('BACKEND_PUBLIC_URL')),
          hasNextPublicApiUrl: Boolean(this.config.get<string>('NEXT_PUBLIC_API_URL')),
          raw,
          resolved,
          source,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return resolved;
  }

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

  /** Añade los emails de Facturación y Administración al destinatario Para (To), sin duplicados. */
  private async mergeBillingAdminIntoRecipientTo(areaRecipientTo: string): Promise<string> {
    const billingEmails = await this.billingAdminContactsService.findAllEmails();
    if (billingEmails.length === 0) return areaRecipientTo;
    const areaEmails = areaRecipientTo
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const combined = new Set<string>([...areaEmails, ...billingEmails]);
    const list = [...combined].filter(Boolean);
    return list.length > 0 ? list.join(', ') : areaRecipientTo;
  }

  /** Crea una activación en estado DRAFT para el usuario. */
  async create(userId: string, createdByLabel: string, dto: CreateActivationDto) {
    const areaIds = dto.areaIds ?? [];
    const subAreaIds = dto.subAreaIds ?? [];
    if (areaIds.length === 0 && subAreaIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un área o subárea involucrada');
    }
    const { recipientTo: areaRecipientTo } = await this.getRecipientsFromAreasAndSubAreas(areaIds, subAreaIds);
    const recipientTo = await this.mergeBillingAdminIntoRecipientTo(areaRecipientTo);

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
          recipientTo,
          recipientCc: dto.recipientCc?.trim() || null,
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
    return activation;
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
    if (dto.recipientCc !== undefined) data.recipientCc = dto.recipientCc?.trim() || null;
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
      const { recipientTo: areaRecipientTo } = await this.getRecipientsFromAreasAndSubAreas(areaIds, subAreaIds);
      data.recipientTo = await this.mergeBillingAdminIntoRecipientTo(areaRecipientTo);
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
    return activation;
  }

  /** Dispara el webhook de Make con el payload v3 (incl. firma global); si OK → READY_TO_SEND + makeRunId; si falla → ERROR + errorMessage. Solo DRAFT o ERROR. */
  async requestSend(activationId: string, userId: string) {
    const activation = await this.findOneByIdAndUser(activationId, userId);
    if (activation.status !== ActivationStatus.DRAFT && activation.status !== ActivationStatus.ERROR) {
      throw new BadRequestException(
        `No se puede enviar: estado actual es ${activation.status}. Solo DRAFT o ERROR.`,
      );
    }

    await this.attachmentsService.publishForActivation(activationId);
    const refreshed = await this.findOneByIdAndUser(activationId, userId);

    const signatureHtml = await this.emailSignatureService.getContent();
    const emailSignature = signatureHtml.trim() ? signatureHtml : null;
    const attachmentsBaseUrl = await this.getBackendApiBaseUrl();
    const payload = buildMakeWebhookPayload(refreshed as ActivationForMakePayload, {
      emailSignature,
      attachmentsBaseUrl,
    });
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/4ab151b9-cbda-4400-a5db-364c7cddddff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd7e201' },
      body: JSON.stringify({
        sessionId: 'd7e201',
        runId: 'post-fix',
        hypothesisId: 'C_D',
        location: 'activations.service.ts:requestSend',
        message: 'Attachment URL selected for Make payload',
        data: {
          activationId,
          attachmentsBaseUrl,
          attachmentsCount: payload.attachments.length,
          firstAttachmentUrl: payload.attachments[0]?.url ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
