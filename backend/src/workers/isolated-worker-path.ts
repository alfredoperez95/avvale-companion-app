import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';

const requireFromHere = createRequire(__filename);

export function resolveIsolatedWorkerPath(currentDir: string, workerBaseName: string): string {
  const localCompiled = path.join(currentDir, `${workerBaseName}.js`);
  if (fs.existsSync(localCompiled)) return localCompiled;

  const distCompiled = resolveDistWorkerPath(currentDir, workerBaseName);
  if (distCompiled && fs.existsSync(distCompiled)) return distCompiled;

  const source = path.join(currentDir, `${workerBaseName}.ts`);
  if (!fs.existsSync(source)) {
    throw new Error(`Worker no encontrado: ${workerBaseName}`);
  }
  return transpileWorkerForLocalDev(source, workerBaseName);
}

function resolveDistWorkerPath(currentDir: string, workerBaseName: string): string | null {
  const normalized = currentDir.split(path.sep).join('/');
  const marker = '/src/';
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) return null;
  const root = currentDir.slice(0, idx);
  const relativeFromSrc = currentDir.slice(idx + marker.length);
  return path.join(root, 'dist', relativeFromSrc, `${workerBaseName}.js`);
}

function transpileWorkerForLocalDev(sourcePath: string, workerBaseName: string): string {
  let ts: typeof import('typescript');
  try {
    ts = requireFromHere('typescript') as typeof import('typescript');
  } catch {
    throw new Error(
      `El worker ${workerBaseName}.ts requiere un build previo o TypeScript instalado para ejecución local.`,
    );
  }

  const source = fs.readFileSync(sourcePath, 'utf8');
  const hash = createHash('sha256').update(sourcePath).update('\0').update(source).digest('hex').slice(0, 16);
  const outDir = path.join(os.tmpdir(), 'avvale-worker-cache');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${workerBaseName}-${hash}.js`);
  if (fs.existsSync(outPath)) return outPath;

  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: sourcePath,
  });
  fs.writeFileSync(outPath, result.outputText, 'utf8');
  return outPath;
}
