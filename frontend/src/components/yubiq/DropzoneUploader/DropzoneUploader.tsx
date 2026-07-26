'use client';

import { useRef, useState } from 'react';
import { uploadAccept, validateUploadFile } from '@/lib/validate-upload';
import type { UploadKind } from '@/lib/validate-upload';
import styles from './DropzoneUploader.module.css';
import { truncateFileNameMiddle } from './truncate-file-name';

function FileIcon() {
  return (
    <div className={styles.iconWrap} aria-hidden>
      <svg className={styles.pdfIcon} width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export function DropzoneUploader({
  file,
  disabled,
  onFileSelected,
  kind = 'yubiq',
  title = 'Arrastra y suelta tu PDF aquí',
  hint = 'o elige un archivo desde el equipo',
  buttonLabel = 'Seleccionar PDF',
  meta = 'Solo PDF · Máx. 20 MB',
  ariaLabel = 'Carga de PDF',
}: {
  file: File | null;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  kind?: UploadKind;
  title?: string;
  hint?: string;
  buttonLabel?: string;
  meta?: string;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const displayFileName = file ? truncateFileNameMiddle(file.name) : '';

  const pick = () => inputRef.current?.click();

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    const validationError = validateUploadFile(kind, f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    onFileSelected(f);
  };

  return (
    <div
      className={active ? `${styles.dropzone} ${styles.dropzoneActive}` : styles.dropzone}
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
        const f = e.dataTransfer.files?.[0];
        acceptFile(f);
      }}
      role="group"
      aria-label={ariaLabel}
    >
      <input
        ref={inputRef}
        type="file"
        accept={uploadAccept(kind)}
        className={styles.hiddenInput}
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <FileIcon />
      <div className={styles.title}>{title}</div>
      <div className={styles.hint}>{hint}</div>
      <button type="button" className={styles.btnPrimary} onClick={pick} disabled={disabled}>
        {buttonLabel}
      </button>
      <div className={styles.meta}>{meta}</div>
      {error ? <div className={styles.fileNote} role="alert">{error}</div> : null}

      {file && (
        <div className={styles.fileChip} aria-label="Archivo seleccionado">
          <span className={styles.fileIcon} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div className={styles.fileMeta}>
            <div className={styles.fileName} title={file.name}>{displayFileName}</div>
            <div className={styles.fileNote}>{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
          </div>
        </div>
      )}
    </div>
  );
}
