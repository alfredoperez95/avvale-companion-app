import * as fs from 'fs';
import convertHeic = require('heic-convert');

type HeicWorkerRequest = {
  inputPath: string;
  outputPath: string;
  quality: number;
};

process.on('message', async (message: HeicWorkerRequest) => {
  try {
    if (!message?.inputPath || typeof message.inputPath !== 'string') {
      throw new Error('Ruta HEIC de entrada no válida');
    }
    if (!message?.outputPath || typeof message.outputPath !== 'string') {
      throw new Error('Ruta JPEG de salida no válida');
    }

    const quality = Math.min(1, Math.max(0.1, Number(message.quality) || 0.92));
    const buffer = fs.readFileSync(message.inputPath);
    const converted = await convertHeic({ buffer, format: 'JPEG', quality });
    fs.writeFileSync(message.outputPath, Buffer.from(converted));
    process.send?.({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send?.({ ok: false, error: message });
  } finally {
    process.exit(0);
  }
});
