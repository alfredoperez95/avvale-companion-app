export function cleanOfferTitleFromFilename(fileName: string): string {
  const raw = (fileName ?? '').trim();
  if (!raw) return '';
  const withoutExt = raw.replace(/\.pdf$/i, '');
  const withoutPrefix = withoutExt.replace(/^ESP_\d{2}_\d{4}\s*-\s*/i, '');
  return withoutPrefix.replace(/\s+/g, ' ').trim();
}

