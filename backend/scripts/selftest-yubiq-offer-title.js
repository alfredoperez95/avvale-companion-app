/* eslint-disable no-console */
// Self-test rápido (sin framework) para `cleanOfferTitleFromFilename`.
// Ejecutar: node scripts/selftest-yubiq-offer-title.js

const { cleanOfferTitleFromFilename } = require('../dist/yubiq/approve-seal-filler/offer-title.util');

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

const cases = [
  {
    input: 'ESP_25_0807 - Cloud Connector & Integration Suite.pdf',
    expected: 'Cloud Connector & Integration Suite',
  },
  {
    input: 'ESP_26_0373 - Boomi Integration Services España - T&M - GOIKO.pdf',
    expected: 'Boomi Integration Services España - T&M - GOIKO',
  },
  { input: 'ESP_26_0373 -   Boomi   Integration   Services.pdf', expected: 'Boomi Integration Services' },
  { input: 'Cloud Connector.pdf', expected: 'Cloud Connector' },
];

for (const c of cases) {
  assertEq(cleanOfferTitleFromFilename(c.input), c.expected, `Case failed for "${c.input}"`);
}

console.log(`OK (${cases.length} casos)`);

