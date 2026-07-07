export function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return mime === 'image/heic' || mime === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) {
    throw new Error('No se pudo convertir el archivo HEIC a JPG.');
  }
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'receipt.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
