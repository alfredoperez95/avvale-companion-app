'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUpload, redirectToLogin } from '@/lib/api';
import {
  clearTempFilesInExtension,
  DOWNLOAD_TIMEOUT_MS,
  downloadFilesWithExtension,
  fetchTempFilesFromExtension,
  isExtensionAvailable,
} from '@/lib/browser-extension';
import type { DownloadFileItem } from '@/types/browser-extension-protocol';

export type ExtensionDownloadPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'uploading'
  | 'done'
  | 'error'
  | 'stale_batch';

export type ExtensionUploadOutcome =
  | { kind: 'success'; saved: string[] }
  | {
      kind: 'partial';
      saved: string[];
      failed: { url: string; error: string }[];
    }
  | { kind: 'failed'; message: string; suggestUpdateExtension?: boolean }
  | { kind: 'skipped' };

function errorMessageForUser(code: string, timedOut: boolean): { message: string; suggestUpdate: boolean } {
  if (timedOut) {
    return {
      message:
        'La extensión no respondió a tiempo. Instala o actualiza Avvale Companion a la versión que soporta descargas con la sesión del navegador.',
      suggestUpdate: true,
    };
  }
  switch (code) {
    case 'invalid_payload':
      return { message: 'Datos no válidos para la extensión.', suggestUpdate: false };
    case 'download_failed':
      return { message: 'La extensión no pudo descargar uno o más archivos.', suggestUpdate: false };
    case 'batch_not_found':
      return { message: 'No hay archivos temporales para este lote en la extensión.', suggestUpdate: false };
    default:
      return { message: 'Error al comunicar con la extensión.', suggestUpdate: false };
  }
}

function isBlockingPhase(p: ExtensionDownloadPhase): boolean {
  return p === 'downloading' || p === 'ready' || p === 'stale_batch' || p === 'uploading';
}

export type UploadBatchOptions = {
  alreadyImportedOriginalUrls?: Set<string>;
  /** Progreso 0–100 durante la subida (y tramo previo si aplica). */
  progressRange?: { start: number; end: number };
  /** Tras descargar en el mismo tick, `phaseRef` aún no está en `ready`; solo uso interno del encadenado. */
  skipPhaseGuard?: boolean;
};

export function useActivationExtensionDownloads() {
  const [phase, setPhase] = useState<ExtensionDownloadPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestUpdateExtension, setSuggestUpdateExtension] = useState(false);
  const [lastUploadOutcome, setLastUploadOutcome] = useState<ExtensionUploadOutcome | null>(null);
  /** Progreso del flujo descarga+subida (null = ocultar barra). */
  const [chainProgress, setChainProgress] = useState<number | null>(null);

  const batchIdRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  const downloadRampIntervalRef = useRef<number | null>(null);
  /** Segundos en fase checking/downloading (para UI y diagnóstico). */
  const [bridgeWaitSeconds, setBridgeWaitSeconds] = useState(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'downloading' && phase !== 'checking') {
      setBridgeWaitSeconds(0);
      return;
    }
    setBridgeWaitSeconds(0);
    const intervalId = window.setInterval(() => {
      setBridgeWaitSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [phase]);

  const clearDownloadRamp = useCallback(() => {
    if (downloadRampIntervalRef.current != null) {
      window.clearInterval(downloadRampIntervalRef.current);
      downloadRampIntervalRef.current = null;
    }
  }, []);

  const resetLocalState = useCallback(() => {
    clearDownloadRamp();
    batchIdRef.current = null;
    setPhase('idle');
    setErrorMessage(null);
    setSuggestUpdateExtension(false);
    setLastUploadOutcome(null);
    setChainProgress(null);
  }, [clearDownloadRamp]);

  const startDownload = useCallback(async (items: DownloadFileItem[]) => {
    if (items.length === 0) {
      setErrorMessage('No hay URLs para descargar.');
      setPhase('error');
      setChainProgress(null);
      return;
    }
    if (isBlockingPhase(phaseRef.current)) {
      setErrorMessage(
        'Ya hay un lote en curso o archivos pendientes. Descarta los temporales de la extensión antes de iniciar otra descarga.',
      );
      setPhase('error');
      setChainProgress(null);
      return;
    }

    setPhase('checking');
    setErrorMessage(null);
    setSuggestUpdateExtension(false);
    setLastUploadOutcome(null);

    const available = await isExtensionAvailable({ timeoutMs: 800 });
    if (!available) {
      setErrorMessage('No se detecta la extensión Avvale Companion en esta pestaña.');
      setPhase('error');
      setChainProgress(null);
      return;
    }

    const batchId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    batchIdRef.current = batchId;
    setPhase('downloading');

    const result = await downloadFilesWithExtension({ batchId, items });
    if (!result.ok) {
      const { message, suggestUpdate } = errorMessageForUser(result.error, result.timedOut);
      setErrorMessage(message);
      setSuggestUpdateExtension(suggestUpdate);
      setPhase('error');
      batchIdRef.current = null;
      setChainProgress(null);
      return;
    }

    setPhase('ready');
  }, []);

  const uploadBatchToActivation = useCallback(
    async (activationId: string, options?: UploadBatchOptions): Promise<ExtensionUploadOutcome> => {
    const batchId = batchIdRef.current;
    const p = phaseRef.current;
    const pr = options?.progressRange;
    const bumpProgress = (t: number) => {
      if (pr) {
        const { start, end } = pr;
        setChainProgress(Math.min(100, Math.round(start + (end - start) * t)));
      }
    };

    if (
      !batchId ||
      (!options?.skipPhaseGuard && p !== 'ready' && p !== 'stale_batch')
    ) {
      const out: ExtensionUploadOutcome = { kind: 'skipped' };
      setLastUploadOutcome(out);
      return out;
    }

    setPhase('uploading');
    setErrorMessage(null);
    setSuggestUpdateExtension(false);
    if (pr) bumpProgress(0.05);

    const fetched = await fetchTempFilesFromExtension(batchId);
    if (!fetched.ok) {
      const { message, suggestUpdate } = errorMessageForUser(fetched.error, fetched.timedOut);
      setErrorMessage(message);
      setSuggestUpdateExtension(suggestUpdate);
      setPhase('stale_batch');
      setChainProgress(null);
      const out: ExtensionUploadOutcome = { kind: 'failed', message, suggestUpdateExtension: suggestUpdate };
      setLastUploadOutcome(out);
      return out;
    }

    const saved: string[] = [];
    const failed: { url: string; error: string }[] = [];

    const skip = options?.alreadyImportedOriginalUrls;

    const workItems = fetched.items.filter(({ originalUrl }) => {
      const ou = originalUrl?.trim();
      if (ou && skip?.has(ou)) return false;
      return true;
    });
    const totalWork = workItems.length;
    let workDone = 0;

    if (pr) bumpProgress(0.12);

    for (const { file, originalUrl } of fetched.items) {
      const ou = originalUrl?.trim();
      if (ou && skip?.has(ou)) {
        saved.push(ou);
        continue;
      }
      const formData = new FormData();
      formData.append('file', file);
      if (ou) {
        formData.append('originalUrl', ou);
      }
      const fileSize = Math.max(file.size, 1);
      const res = await apiUpload(`/api/activations/${activationId}/attachments/upload`, formData, (loaded, total) => {
        if (!pr || totalWork === 0) return;
        const fileFrac = total != null && total > 0 ? loaded / total : loaded / fileSize;
        const span = 0.88 - 0.12;
        const base = 0.12 + (workDone / totalWork) * span;
        const slice = span / totalWork;
        bumpProgress(Math.min(0.88, base + fileFrac * slice));
      });
      if (res.status === 401) {
        redirectToLogin();
        setPhase('stale_batch');
        setChainProgress(null);
        const out: ExtensionUploadOutcome = {
          kind: 'failed',
          message: 'Sesión caducada.',
        };
        setLastUploadOutcome(out);
        return out;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        const label = ou || file.name;
        failed.push({ url: label, error: msg ?? `Error al subir (HTTP ${res.status})` });
        workDone += 1;
        if (pr) bumpProgress(0.12 + (workDone / Math.max(totalWork, 1)) * 0.76);
        continue;
      }
      if (ou) saved.push(ou);
      else saved.push(`(archivo: ${file.name})`);
      workDone += 1;
      if (pr) bumpProgress(0.12 + (workDone / Math.max(totalWork, 1)) * 0.76);
    }

    if (failed.length === 0) {
      const cleared = await clearTempFilesInExtension(batchId);
      if (!cleared.ok) {
        const { message, suggestUpdate } = errorMessageForUser(cleared.error, cleared.timedOut);
        setErrorMessage(
          `Archivos subidos, pero no se pudieron eliminar los temporales en la extensión: ${message}`,
        );
        setSuggestUpdateExtension(suggestUpdate);
      }
      batchIdRef.current = null;
      setPhase('done');
      if (pr) setChainProgress(pr.end);
      const out: ExtensionUploadOutcome = { kind: 'success', saved };
      setLastUploadOutcome(out);
      return out;
    }

    setPhase('stale_batch');
    setErrorMessage(
      'Algunos archivos no se subieron. Puedes reintentar con el botón o descartar los temporales en la extensión.',
    );
    if (pr) setChainProgress(pr.end);
    const out: ExtensionUploadOutcome = { kind: 'partial', saved, failed };
    setLastUploadOutcome(out);
    return out;
    },
    [],
  );

  const startDownloadAndUploadToActivation = useCallback(
    async (
      activationId: string,
      items: DownloadFileItem[],
      options?: { alreadyImportedOriginalUrls?: Set<string> },
    ): Promise<ExtensionUploadOutcome> => {
      if (items.length === 0) {
        setErrorMessage('No hay URLs para descargar.');
        setPhase('error');
        return { kind: 'failed', message: 'No hay URLs para descargar.' };
      }
      if (isBlockingPhase(phaseRef.current)) {
        setErrorMessage(
          'Ya hay un lote en curso o archivos pendientes. Descarta los temporales de la extensión antes de iniciar otra descarga.',
        );
        setPhase('error');
        return { kind: 'failed', message: 'Ya hay un lote en curso o archivos pendientes.' };
      }

      setChainProgress(0);
      setPhase('checking');
      setErrorMessage(null);
      setSuggestUpdateExtension(false);
      setLastUploadOutcome(null);

      const available = await isExtensionAvailable({ timeoutMs: 800 });
      if (!available) {
        setErrorMessage('No se detecta la extensión Avvale Companion en esta pestaña.');
        setPhase('error');
        setChainProgress(null);
        return { kind: 'failed', message: 'No se detecta la extensión Avvale Companion en esta pestaña.' };
      }

      const batchId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      batchIdRef.current = batchId;
      setPhase('downloading');
      setChainProgress(8);
      clearDownloadRamp();
      downloadRampIntervalRef.current = window.setInterval(() => {
        setChainProgress((prev) => Math.min(36, (prev ?? 0) + 1));
      }, 350);

      const result = await downloadFilesWithExtension({ batchId, items });
      clearDownloadRamp();

      if (!result.ok) {
        const { message, suggestUpdate } = errorMessageForUser(result.error, result.timedOut);
        setErrorMessage(message);
        setSuggestUpdateExtension(suggestUpdate);
        setPhase('error');
        batchIdRef.current = null;
        setChainProgress(null);
        return { kind: 'failed', message, suggestUpdateExtension: suggestUpdate };
      }

      setChainProgress(38);
      setPhase('ready');

      return uploadBatchToActivation(activationId, {
        alreadyImportedOriginalUrls: options?.alreadyImportedOriginalUrls,
        progressRange: { start: 40, end: 100 },
        skipPhaseGuard: true,
      });
    },
    [clearDownloadRamp, uploadBatchToActivation],
  );

  const discardExtensionTempFiles = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    const batchId = batchIdRef.current;
    if (!batchId) {
      resetLocalState();
      return { ok: true };
    }
    const result = await clearTempFilesInExtension(batchId);
    if (!result.ok) {
      const { message } = errorMessageForUser(result.error, result.timedOut);
      return { ok: false, message };
    }
    resetLocalState();
    return { ok: true };
  }, [resetLocalState]);

  const canDiscardTempFiles = phase === 'ready' || phase === 'stale_batch';

  const extensionBusy =
    phase === 'checking' || phase === 'downloading' || phase === 'uploading';

  const downloadTimeoutSeconds = Math.ceil(DOWNLOAD_TIMEOUT_MS / 1000);

  return {
    phase,
    errorMessage,
    suggestUpdateExtension,
    lastUploadOutcome,
    chainProgress,
    canDiscardTempFiles,
    extensionBusy,
    bridgeWaitSeconds,
    downloadTimeoutSeconds,
    startDownload,
    startDownloadAndUploadToActivation,
    uploadBatchToActivation,
    discardExtensionTempFiles,
    resetLocalState,
  };
}
