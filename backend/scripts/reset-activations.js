/**
 * Borra todas las activaciones (cascada en tablas hijas) y reinicia
 * activation_number para que la próxima activación sea 1.
 *
 * Uso: desde la raíz del repo: node backend/scripts/reset-activations.js
 *      o: cd backend && node scripts/reset-activations.js
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

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.activation.deleteMany({});
  console.log(`Activaciones eliminadas: ${deleted.count}`);
  await prisma.$executeRawUnsafe('ALTER TABLE `activations` AUTO_INCREMENT = 1');
  console.log('Contador activation_number reiniciado a 1 (próxima activación será #1).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
