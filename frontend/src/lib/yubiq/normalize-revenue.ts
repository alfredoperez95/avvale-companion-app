export type ParseAmountAndCurrencyResult = {
  /** Valor numérico legible para `document.amount` (sin símbolos de moneda). */
  amount: string;
  /** Código ISO si se detecta; vacío si no. */
  currency: string;
  /** Texto para `prefill.revenue` (pegar en input): limpio, separadores razonables. */
  revenue: string;
  warnings: string[];
};

function detectCurrency(raw: string): string {
  const s = raw.toUpperCase();
  if (/€|EUR/.test(s)) return 'EUR';
  if (/\$|USD/.test(s)) return 'USD';
  if (/£|GBP/.test(s)) return 'GBP';
  return '';
}

/**
 * Quita símbolos y letras de moneda; conserva dígitos y un separador decimal razonable.
 */
function extractNumericCore(raw: string): string {
  let t = raw.trim();
  t = t.replace(/€|EUR|USD|GBP|\$|£/gi, '');
  t = t.replace(/[^\d.,-]/g, '');
  t = t.replace(/\s+/g, '');
  if (!t || t === '-') return '';

  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let normalized = t;

  if (hasComma && hasDot) {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = t.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      normalized = t.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    const parts = t.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/,/g, '')}.${parts[1]}`;
    } else {
      normalized = t.replace(/\./g, '');
    }
  }

  const n = Number.parseFloat(normalized);
  if (Number.isNaN(n)) {
    return t.replace(/[^0-9]/g, '') || '';
  }
  if (Number.isInteger(n)) {
    return String(Math.round(n));
  }
  return String(n);
}

/**
 * Parsea `importeOferta` (texto libre) para amount, currency y revenue pegable.
 */
export function parseAmountAndCurrency(raw: string): ParseAmountAndCurrencyResult {
  const warnings: string[] = [];
  if (!raw || !String(raw).trim()) {
    warnings.push('revenue_empty');
    return { amount: '', currency: '', revenue: '', warnings };
  }

  const currency = detectCurrency(raw);
  const numericOnly = extractNumericCore(raw);
  if (!numericOnly) {
    warnings.push('revenue_unparsed');
    return { amount: '', currency: currency || '', revenue: '', warnings };
  }

  if (!currency) {
    warnings.push('currency_not_detected');
  }

  return {
    amount: numericOnly,
    currency,
    revenue: numericOnly,
    warnings,
  };
}
