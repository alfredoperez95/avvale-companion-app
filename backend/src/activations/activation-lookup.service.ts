import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingAdminContactsService } from '../billing-admin-contacts/billing-admin-contacts.service';

/**
 * Lecturas de activación con `manualCcEmails` para API y para el orquestador de envío a Make.
 * Vive en un servicio aparte para evitar dependencias circulares (Queue → Orchestrator → lectura sin ActivationsService).
 */
const PLACEHOLDER_RECIPIENT = 'sin-destinatarios@pendiente';

@Injectable()
export class ActivationLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAdminContactsService: BillingAdminContactsService,
  ) {}

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
}
