/**
 * Tras aplicar la migración SQL user_scoped_config:
 * - Firma: una fila por usuario (contenido de la firma global previa).
 * - Plantillas: copia de cada plantilla con user_id null para cada usuario.
 * - Áreas: clon del árbol sistema (owner_user_id null) por usuario y remapeo de activation_areas/subareas.
 *
 * Idempotente: usuarios que ya tengan áreas propias o plantillas propias se omiten en cada bloque.
 *
 * Uso: cd backend && node scripts/migrate-user-scoped-config.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadDatabaseUrl() {
  const candidates = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const raw = fs.readFileSync(envPath, 'utf8');
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?\s*$/m);
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
      return;
    }
  }
}

loadDatabaseUrl();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no encontrada.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function migrateSignatures() {
  const legacy = await prisma.emailSignature.findFirst({ where: { userId: null } });
  const content = legacy?.content ?? '';
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    const exists = await prisma.emailSignature.findUnique({ where: { userId: u.id } });
    if (!exists) {
      await prisma.emailSignature.create({
        data: { userId: u.id, content },
      });
      console.log(`Firma creada para usuario ${u.id}`);
    }
  }
  // Se conserva la fila con user_id NULL como plantilla para nuevos usuarios (bootstrap).
}

async function migrateTemplates() {
  const systemTemplates = await prisma.emailTemplate.findMany({
    where: { userId: null },
    orderBy: { createdAt: 'asc' },
  });
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    const count = await prisma.emailTemplate.count({ where: { userId: u.id } });
    if (count > 0) continue;
    for (const t of systemTemplates) {
      await prisma.emailTemplate.create({
        data: {
          name: t.name,
          content: t.content,
          userId: u.id,
        },
      });
    }
    console.log(`Plantillas clonadas para usuario ${u.id}: ${systemTemplates.length}`);
  }
}

async function migrateAreasAndActivations() {
  const systemAreas = await prisma.area.findMany({
    where: { ownerUserId: null },
    include: {
      subAreas: {
        orderBy: { createdAt: 'asc' },
        include: { contacts: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const u of users) {
    const hasOwned = await prisma.area.count({ where: { ownerUserId: u.id } });
    if (hasOwned > 0) {
      console.log(`Usuario ${u.id} ya tiene áreas propias; omitido.`);
      continue;
    }

    const areaMap = new Map();
    const subMap = new Map();

    for (const a of systemAreas) {
      const newArea = await prisma.area.create({
        data: {
          name: a.name,
          directorName: a.directorName,
          directorEmail: a.directorEmail,
          ownerUserId: u.id,
        },
      });
      areaMap.set(a.id, newArea.id);

      for (const s of a.subAreas) {
        const newSub = await prisma.subArea.create({
          data: { areaId: newArea.id, name: s.name },
        });
        subMap.set(s.id, newSub.id);
        for (const c of s.contacts) {
          await prisma.subAreaContact.create({
            data: {
              subAreaId: newSub.id,
              name: c.name,
              email: c.email,
              isProjectJp: c.isProjectJp,
            },
          });
        }
      }
    }

    const activations = await prisma.activation.findMany({
      where: { createdByUserId: u.id },
      select: { id: true },
    });

    for (const act of activations) {
      const pairsArea = await prisma.activationArea.findMany({ where: { activationId: act.id } });
      for (const row of pairsArea) {
        const newAid = areaMap.get(row.areaId);
        if (newAid) {
          await prisma.$transaction([
            prisma.activationArea.delete({
              where: { activationId_areaId: { activationId: act.id, areaId: row.areaId } },
            }),
            prisma.activationArea.create({
              data: { activationId: act.id, areaId: newAid },
            }),
          ]);
        }
      }

      const pairsSub = await prisma.activationSubArea.findMany({ where: { activationId: act.id } });
      for (const row of pairsSub) {
        const newSid = subMap.get(row.subAreaId);
        if (newSid) {
          await prisma.$transaction([
            prisma.activationSubArea.delete({
              where: { activationId_subAreaId: { activationId: act.id, subAreaId: row.subAreaId } },
            }),
            prisma.activationSubArea.create({
              data: { activationId: act.id, subAreaId: newSid },
            }),
          ]);
        }
      }
    }

    console.log(`Árbol de áreas clonado y activaciones remapeadas para usuario ${u.id}`);
  }
}

async function main() {
  await migrateSignatures();
  await migrateTemplates();
  await migrateAreasAndActivations();
  console.log('Migración user-scoped config completada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
