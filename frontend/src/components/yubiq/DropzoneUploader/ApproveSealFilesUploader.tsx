'use client';

import { useRef, useState } from 'react';
import { validateUploadFile } from '@/lib/validate-upload';
import styles from './ApproveSealFilesUploader.module.css';
import { truncateFileNameMiddle } from './truncate-file-name';

const ACCEPT_APPROVE_SEAL_FILES = '.pdf,.xlsx,.xls';

function FileIcon() {
  return (
    <div className={styles.iconWrap} aria-hidden>
      <svg className={styles.pdfIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
        <path d="M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function FileChip({
  label,
  kind,
  file,
  onRemove,
  disabled,
}: {
  label: string;
  kind: 'pdf' | 'pfe';
  file: File;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const displayName = truncateFileNameMiddle(file.name, 36);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  return (
    <div
      className={`${styles.fileChip} ${kind === 'pdf' ? styles.fileChipPdf : styles.fileChipPfe}`}
      aria-label={`${label}: ${file.name}`}
    >
      <span className={styles.fileKindBadge}>{kind === 'pdf' ? 'PDF' : 'XLS'}</span>
      <span className={styles.fileName} title={file.name}>
        {displayName}
      </span>
      <span className={styles.fileNote}>{sizeMb} MB</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.fileRemove}
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar ${label}`}
          title={`Quitar ${label}`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function EmptySlot({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className={`${styles.fileSlotEmpty} ${required ? styles.fileSlotRequired : ''}`} aria-hidden>
      <span className={styles.fileSlotLabel}>{label}</span>
      <span className={styles.fileSlotHint}>{required ? 'Obligatorio' : 'Opcional'}</span>
    </div>
  );
}

export function ApproveSealFilesUploader({
  pdfFile,
  pfeFile,
  disabled,
  onPdfFileSelected,
  onPfeFileSelected,
  onPdfFileCleared,
  onPfeFileCleared,
}: {
  pdfFile: File | null;
  pfeFile: File | null;
  disabled?: boolean;
  onPdfFileSelected: (file: File) => void;
  onPfeFileSelected: (file: File) => void;
  onPdfFileCleared?: () => void;
  onPfeFileCleared?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();
  const hasFiles = Boolean(pdfFile || pfeFile);

  const acceptFiles = (list: FileList | File[] | null | undefined) => {
    if (!list) return;
    const files = Array.from(list);
    if (files.length === 0) return;

    let nextPdf: File | null = null;
    let nextPfe: File | null = null;

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        if (nextPdf) {
          setError('Solo puedes cargar un PDF de oferta.');
          return;
        }
        const validationError = validateUploadFile('yubiq', file);
        if (validationError) {
          setError(validationError);
          return;
        }
        nextPdf = file;
        continue;
      }

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (nextPfe) {
          setError('Solo puedes cargar un Excel PFE.');
          return;
        }
        const validationError = validateUploadFile('yubiqPfe', file);
        if (validationError) {
          setError(validationError);
          return;
        }
        nextPfe = file;
        continue;
      }

      setError(`${file.name}: formato no permitido. Usa PDF o Excel PFE (.xlsx/.xls).`);
      return;
    }

    setError('');
    if (nextPdf) onPdfFileSelected(nextPdf);
    if (nextPfe) onPfeFileSelected(nextPfe);
  };

  return (
    <div
      className={`${styles.dropzone} ${active ? styles.dropzoneActive : ''} ${hasFiles ? styles.dropzoneFilled : ''} ${disabled ? styles.dropzoneDisabled : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        setActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
        if (disabled) return;
        acceptFiles(e.dataTransfer.files);
      }}
      role="group"
      aria-label="Carga de PDF y Excel PFE"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_APPROVE_SEAL_FILES}
        className={styles.hiddenInput}
        disabled={disabled}
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {!hasFiles ? (
        <div className={styles.dropzoneIdle}>
          <FileIcon />
          <div className={styles.idleCopy}>
            <div className={styles.title}>Arrastra el PDF de oferta y, si aplica, el Excel PFE</div>
            <div className={styles.hint}>O usa el botón para elegir los archivos desde tu equipo</div>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={pick} disabled={disabled}>
            Seleccionar archivos
          </button>
        </div>
      ) : (
        <div className={styles.dropzoneToolbar}>
          <button type="button" className={styles.btnGhost} onClick={pick} disabled={disabled}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
              <path
                d="M12 16V4M12 4l-4 4M12 4l4 4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Añadir o sustituir</span>
          </button>
        </div>
      )}

      {error ? (
        <div className={styles.uploadError} role="alert">
          {error}
        </div>
      ) : null}

      {hasFiles ? (
        <div className={styles.fileChipGrid}>
          {pdfFile ? (
            <FileChip
              label="PDF"
              kind="pdf"
              file={pdfFile}
              disabled={disabled}
              onRemove={onPdfFileCleared}
            />
          ) : (
            <EmptySlot label="PDF oferta" required />
          )}
          {pfeFile ? (
            <FileChip
              label="PFE"
              kind="pfe"
              file={pfeFile}
              disabled={disabled}
              onRemove={onPfeFileCleared}
            />
          ) : (
            <EmptySlot label="Excel PFE" />
          )}
        </div>
      ) : null}
    </div>
  );
}
