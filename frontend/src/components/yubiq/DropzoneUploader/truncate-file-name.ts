export function truncateFileNameMiddle(fileName: string, maxLength = 56): string {
  if (fileName.length <= maxLength) return fileName;

  const separator = '...';
  const available = maxLength - separator.length;
  const startLength = Math.ceil(available * 0.6);
  const endLength = available - startLength;

  return `${fileName.slice(0, startLength)}${separator}${fileName.slice(-endLength)}`;
}

