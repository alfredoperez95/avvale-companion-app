#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

const BATCH_SIZE = clampInt(process.env.BATCH_SIZE, 1, 1000, 250);
const DRY_RUN = process.env.DRY_RUN !== '0' && process.env.DRY_RUN !== 'false';
const FROM_ID = parseOptionalBigInt(process.env.FROM_ID, 'FROM_ID');
const UNTIL_ID = parseOptionalBigInt(process.env.UNTIL_ID, 'UNTIL_ID');

function usage() {
  console.log(`
Backfill KYC audit logs hacia audit_logs global.

Uso seguro:
  DRY_RUN=1 npm run audit:backfill:kyc
  DRY_RUN=0 npm run audit:backfill:kyc

Variables opcionales:
  BATCH_SIZE=250   Tamaño de lote, entre 1 y 1000.
  FROM_ID=1        Primer kyc_audit_logs.id a procesar.
  UNTIL_ID=123     Último kyc_audit_logs.id a procesar.

Notas:
  - DRY_RUN está activo por defecto.
  - El script es idempotente: omite eventos ya backfilleados por meta.kycAuditLogId.
  - También omite duplicados probables creados por la duplicación KYC -> audit_logs post-deploy.
`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  console.log(`Backfill KYC audit -> audit_logs`);
  console.log(`Modo: ${DRY_RUN ? 'DRY_RUN (no escribe)' : 'ESCRITURA REAL'}`);
  console.log(`BATCH_SIZE=${BATCH_SIZE} FROM_ID=${FROM_ID?.toString() ?? '-'} UNTIL_ID=${UNTIL_ID?.toString() ?? '-'}`);

  let lastId = FROM_ID ? FROM_ID - 1n : 0n;
  let scanned = 0;
  let inserted = 0;
  let skippedBackfilled = 0;
  let skippedProbableDuplicate = 0;

  while (true) {
    const where = { id: { gt: lastId } };
    if (UNTIL_ID != null) where.id.lte = UNTIL_ID;
    const rows = await prisma.kycAuditLog.findMany({
      where,
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      include: {
        actor: { select: { id: true, email: true, role: true } },
      },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      lastId = row.id;

      if (await isAlreadyBackfilled(row.id)) {
        skippedBackfilled += 1;
        continue;
      }
      if (await hasProbableGlobalDuplicate(row)) {
        skippedProbableDuplicate += 1;
        continue;
      }

      const data = toGlobalAuditData(row);
      if (!DRY_RUN) {
        await prisma.auditLog.create({ data });
      }
      inserted += 1;
    }

    console.log(
      `Procesado hasta kyc_audit_logs.id=${lastId.toString()} scanned=${scanned} insert${DRY_RUN ? 'aría' : 'ed'}=${inserted} skipped(backfilled=${skippedBackfilled}, duplicate=${skippedProbableDuplicate})`,
    );
  }

  console.log('Resumen backfill KYC audit -> audit_logs');
  console.log({
    dryRun: DRY_RUN,
    scanned,
    insertedOrWouldInsert: inserted,
    skippedBackfilled,
    skippedProbableDuplicate,
    lastId: lastId.toString(),
  });
}

async function isAlreadyBackfilled(kycAuditLogId) {
  const rows = await prisma.$queryRaw`
    SELECT id
    FROM audit_logs
    WHERE JSON_UNQUOTE(JSON_EXTRACT(meta, '$.backfilledFrom')) = 'kyc_audit_logs'
      AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.kycAuditLogId')) = ${kycAuditLogId.toString()}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function hasProbableGlobalDuplicate(row) {
  const createdFrom = new Date(row.createdAt.getTime() - 1000);
  const createdTo = new Date(row.createdAt.getTime() + 10_000);
  const globalAction = toGlobalAction(row.action);
  const entityId = row.entityId == null ? null : String(row.entityId);
  const candidates = await prisma.auditLog.findMany({
    where: {
      actorUserId: row.actorUserId ?? null,
      module: 'kyc',
      action: globalAction,
      entity: row.entity,
      entityId,
      createdAt: { gte: createdFrom, lte: createdTo },
    },
    select: { id: true, meta: true },
    take: 5,
  });

  return candidates.some((candidate) => {
    const meta = candidate.meta && typeof candidate.meta === 'object' && !Array.isArray(candidate.meta)
      ? candidate.meta
      : {};
    return meta.kycAction === row.action || meta.kycCompanyId === (row.companyId == null ? null : row.companyId.toString());
  });
}

function toGlobalAuditData(row) {
  const actorRole = row.actor?.role ?? null;
  const actorType = row.actorUserId ? (actorRole === 'ADMIN' ? 'admin' : 'user') : 'system';
  const baseMeta = row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta) ? row.meta : {};
  return {
    actorUserId: row.actorUserId ?? null,
    actorEmail: row.actor?.email ?? null,
    actorRole,
    actorType,
    module: 'kyc',
    action: toGlobalAction(row.action),
    entity: row.entity,
    entityId: row.entityId == null ? null : String(row.entityId),
    method: null,
    path: `/kyc/${row.entity}`,
    route: null,
    statusCode: null,
    requestId: null,
    ip: null,
    userAgent: null,
    tokenHash: null,
    before: toJson(row.before),
    after: toJson(row.after),
    meta: toJson({
      ...baseMeta,
      backfilledFrom: 'kyc_audit_logs',
      kycAuditLogId: row.id.toString(),
      kycAction: row.action,
      kycCompanyId: row.companyId == null ? null : row.companyId.toString(),
    }),
    createdAt: row.createdAt,
  };
}

function toGlobalAction(action) {
  return action.startsWith('ai.') ? 'ai' : action;
}

function toJson(value) {
  if (value === undefined) return undefined;
  const normalized = JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Prisma.Decimal) return v.toString();
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'string') return v.length > 1000 ? `${v.slice(0, 1000)}...(truncado)` : v;
      return v;
    }),
  );
  return normalized === undefined ? null : normalized;
}

function clampInt(raw, min, max, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseOptionalBigInt(raw, label) {
  if (raw == null || raw === '') return null;
  try {
    const value = BigInt(raw);
    if (value <= 0n) throw new Error('positive required');
    return value;
  } catch {
    console.error(`${label} debe ser un entero positivo.`);
    process.exit(2);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
