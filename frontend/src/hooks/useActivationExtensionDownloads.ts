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

export function useActivationExtensionDownloads() {
  const [phase, setPhase] = useState<ExtensionDownloadPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestUpdateExtension, setSuggestUpdateExtension] = useState(false);
  const [lastUploadOutcome, setLastUploadOutcome] = useState<ExtensionUploadOutcome | null>(null);

  const batchIdRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
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

  const resetLocalState = useCallback(() => {
    batchIdRef.current = null;
    setPhase('idle');
    setErrorMessage(null);
    setSuggestUpdateExtension(false);
    setLastUploadOutcome(null);
  }, []);

  const startDownload = useCallback(async (items: DownloadFileItem[]) => {
    if (items.length === 0) {
      setErrorMessage('No hay URLs para descargar.');
      setPhase('error');
      return;
    }
    if (isBlockingPhase(phaseRef.current)) {
      setErrorMessage(
        'Ya hay un lote en curso o archivos pendientes. Descarta los temporales de la extensión antes de iniciar otra descarga.',
      );
      setPhase('error');
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
      return;
    }

    setPhase('ready');
  }, []);

  const uploadBatchToActivation = useCallback(
    async (
      activationId: string,
      options?: { alreadyImportedOriginalUrls?: Set<string> },
    ): Promise<ExtensionUploadOutcome> => {
    const batchId = batchIdRef.current;
    const p = phaseRef.current;
    if (!batchId || (p !== 'ready' && p !== 'stale_batch')) {
      const out: ExtensionUploadOutcome = { kind: 'skipped' };
      setLastUploadOutcome(out);
      return out;
    }

    setPhase('uploading');
    setErrorMessage(null);
    setSuggestUpdateExtension(false);

    const fetched = await fetchTempFilesFromExtension(batchId);
    if (!fetched.ok) {
      const { message, suggestUpdate } = errorMessageForUser(fetched.error, fetched.timedOut);
      setErrorMessage(message);
      setSuggestUpdateExtension(suggestUpdate);
      setPhase('stale_batch');
      const out: ExtensionUploadOutcome = { kind: 'failed', message, suggestUpdateExtension: suggestUpdate };
      setLastUploadOutcome(out);
      return out;
    }

    const saved: string[] = [];
    const failed: { url: string; error: string }[] = [];

    const skip = options?.alreadyImportedOriginalUrls;

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
      const res = await apiUpload(`/api/activations/${activationId}/attachments/upload`, formData);
      if (res.status === 401) {
        redirectToLogin();
        setPhase('stale_batch');
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
        continue;
      }
      if (ou) saved.push(ou);
      else saved.push(`(archivo: ${file.name})`);
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
      const out: ExtensionUploadOutcome = { kind: 'success', saved };
      setLastUploadOutcome(out);
      return out;
    }

    setPhase('stale_batch');
    setErrorMessage(
      'Algunos archivos no se subieron. Puedes reintentar cargando al flujo o descartar los temporales en la extensión.',
    );
    const out: ExtensionUploadOutcome = { kind: 'partial', saved, failed };
    setLastUploadOutcome(out);
    return out;
    },
    [],
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
    canDiscardTempFiles,
    extensionBusy,
    bridgeWaitSeconds,
    downloadTimeoutSeconds,
    startDownload,
    uploadBatchToActivation,
    discardExtensionTempFiles,
    resetLocalState,
  };
}
