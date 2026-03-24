/**
 * Inserta contactos globales (CC) si no existen ya (mismo email).
 *
 * Uso: cd backend && node scripts/import-cc-contacts.js
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
  console.error('DATABASE_URL no encontrada (.env en raíz o backend/).');
  process.exit(1);
}

const CONTACTS = [
  { name: 'Ricardo Ortiz', email: 'ricardo.ortiz@avvale.com' },
  { name: 'Ricardo Eusse Sanchez', email: 'ricardo.eusse@avvale.com' },
  { name: 'Alfonso Garcia', email: 'alfonso.garciav@avvale.com' },
  { name: 'Jesus Alberto Ortiz', email: 'jesusalberto.ortiz@avvale.com' },
  { name: 'Blas Leiva Beltran', email: 'blas.leiva@avvale.com' },
];

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let skipped = 0;
  for (const { name, email } of CONTACTS) {
    const normalized = email.trim().toLowerCase();
    const existing = await prisma.ccContact.findFirst({
      where: { email: normalized },
    });
    if (existing) {
      console.log(`Omitido (ya existe): ${normalized}`);
      skipped += 1;
      continue;
    }
    await prisma.ccContact.create({
      data: {
        name: name.trim(),
        email: normalized,
        isProjectJp: false,
      },
    });
    console.log(`Creado: ${name} <${normalized}>`);
    created += 1;
  }
  console.log(`\nListo. Creados: ${created}, ya existían: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
