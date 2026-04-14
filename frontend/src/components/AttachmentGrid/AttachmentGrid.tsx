'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AttachmentGrid.module.css';

export type AttachmentItem = {
  id: string;
  fileName: string;
  originalUrl: string;
  contentType: string | null;
  createdAt: string;
  /** Tamaño en bytes (API); si no viene, no se muestra. */
  fileSizeBytes?: number | null;
};

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ApiFetchFn = (path: string, init?: RequestInit) => Promise<Response>;

function isImageType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/');
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext ? `.${ext.toUpperCase()}` : '';
}

function getFileIcon(contentType: string | null, fileName: string) {
  const type = (contentType ?? '').toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return (
      <svg className={styles.previewIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  /* PDF: documento con líneas de texto */
  if (type.includes('pdf') || ext === 'pdf') {
    return (
      <svg className={styles.previewIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
        <path d="M14 2v4h4" />
        <path d="M8 10h8M8 14h5M8 18h6" strokeLinecap="round" />
      </svg>
    );
  }
  /* PPTX: presentación / diapositiva con título y viñetas */
  if (['ppt', 'pptx'].includes(ext) || type.includes('presentation') || type.includes('powerpoint')) {
    return (
      <svg className={styles.previewIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="3" width="16" height="16" rx="1" />
        <path d="M7 7h10M7 11h8M7 14h6M7 17h9" strokeLinecap="round" />
      </svg>
    );
  }
  /* XLSX: hoja de cálculo / tabla con números */
  if (['xls', 'xlsx'].includes(ext) || type.includes('spreadsheet') || type.includes('excel')) {
    return (
      <svg className={styles.previewIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 8h18M3 12h18M3 16h18M8 8v12M12 8v12M16 8v12" />
      </svg>
    );
  }
  return (
    <svg className={styles.previewIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M12 18v-6M9 15h6" />
    </svg>
  );
}

function ImagePreview({
  activationId,
  attachmentId,
  apiFetch,
  contentType,
}: {
  activationId: string;
  attachmentId: string;
  apiFetch: ApiFetchFn;
  contentType: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isImageType(contentType)) return;
    let cancelled = false;
    apiFetch(`/api/activations/${activationId}/attachments/${attachmentId}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          setObjectUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setObjectUrl(null);
    };
  }, [activationId, attachmentId, apiFetch, contentType]);
  if (!objectUrl) return null;
  return <img src={objectUrl} alt="" className={styles.previewImage} />;
}

function SingleCard({
  att,
  activationId,
  apiFetch,
  onDeleted,
}: {
  att: AttachmentItem;
  activationId: string;
  apiFetch: ApiFetchFn;
  onDeleted?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const showImagePreview = isImageType(att.contentType);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/activations/${activationId}/attachments/${att.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    const res = await apiFetch(`/api/activations/${activationId}/attachments/${att.id}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <li className={styles.card}>
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={handleDelete}
        disabled={deleting}
        title="Eliminar adjunto"
        aria-label="Eliminar adjunto"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <span className={styles.extensionBadge} title="Avvale Companion">
        <svg className={styles.puzzleIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19 11h-4V7a2 2 0 00-2-2h-2a2 2 0 00-2 2v4H5a2 2 0 00-2 2v2a2 2 0 002 2h4v4a2 2 0 002 2h2a2 2 0 002-2v-4h4a2 2 0 002-2v-2a2 2 0 00-2-2z" />
        </svg>
        Companion
      </span>
      <div className={styles.preview}>
        {showImagePreview && (
          <>
            <span className={styles.previewIconWrap}>
              {getFileIcon(att.contentType, att.fileName)}
            </span>
            <ImagePreview
              activationId={activationId}
              attachmentId={att.id}
              apiFetch={apiFetch}
              contentType={att.contentType}
            />
          </>
        )}
        {!showImagePreview && getFileIcon(att.contentType, att.fileName)}
      </div>
      <div className={styles.footer}>
        <p className={styles.fileName} title={att.fileName}>
          {att.fileName}
        </p>
        {typeof att.fileSizeBytes === 'number' && att.fileSizeBytes >= 0 ? (
          <p className={styles.fileSize} title={`${att.fileSizeBytes} bytes`}>
            {formatAttachmentSize(att.fileSizeBytes)}
          </p>
        ) : null}
        <div className={styles.footerActions}>
          <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
            Descargar
          </button>
          {getFileExtension(att.fileName) && (
            <span className={styles.extCajita}>{getFileExtension(att.fileName)}</span>
          )}
        </div>
      </div>
    </li>
  );
}

interface AttachmentGridProps {
  attachments: AttachmentItem[];
  activationId: string;
  apiFetch: ApiFetchFn;
  /** Llamado tras eliminar un adjunto para que el padre actualice la lista */
  onDeleted?: () => void;
}

export function AttachmentGrid({ attachments, activationId, apiFetch, onDeleted }: AttachmentGridProps) {
  if (!attachments?.length) return null;
  return (
    <ul className={styles.grid}>
      {attachments.map((att) => (
        <SingleCard
          key={att.id}
          att={att}
          activationId={activationId}
          apiFetch={apiFetch}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
  );
}
