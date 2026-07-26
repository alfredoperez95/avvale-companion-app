'use client';

import { useRef, useState } from 'react';
import { validateUploadFile } from '@/lib/validate-upload';
import styles from './DropzoneUploader.module.css';
import { truncateFileNameMiddle } from './truncate-file-name';

const ACCEPT_APPROVE_SEAL_FILES = '.pdf,.xlsx,.xls';

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

function FileChip({ label, file }: { label: string; file: File }) {
  const displayName = truncateFileNameMiddle(file.name);
  return (
    <div className={styles.fileChip} aria-label={`${label}: ${file.name}`}>
      <span className={styles.fileIcon} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
      <div className={styles.fileMeta}>
        <div className={styles.fileRole}>{label}</div>
        <div className={styles.fileName} title={file.name}>{displayName}</div>
        <div className={styles.fileNote}>{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
      </div>
    </div>
  );
}

export function ApproveSealFilesUploader({
  pdfFile,
  pfeFile,
  disabled,
  onPdfFileSelected,
  onPfeFileSelected,
}: {
  pdfFile: File | null;
  pfeFile: File | null;
  disabled?: boolean;
  onPdfFileSelected: (file: File) => void;
  onPfeFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();

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
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <FileIcon />
      <div className={styles.title}>Arrastra el PDF y el Excel PFE aquí</div>
      <div className={styles.hint}>El PDF es obligatorio; el Excel PFE es opcional y se usa solo para extraer el margen.</div>
      <button type="button" className={styles.btnPrimary} onClick={pick} disabled={disabled}>
        Seleccionar archivos
      </button>
      <div className={styles.meta}>PDF + Excel .xlsx/.xls · Máx. 20 MB por archivo</div>
      {error ? <div className={styles.fileNote} role="alert">{error}</div> : null}

      {pdfFile || pfeFile ? (
        <div className={styles.fileChipGrid}>
          {pdfFile ? <FileChip label="PDF de oferta" file={pdfFile} /> : null}
          {pfeFile ? <FileChip label="Excel PFE" file={pfeFile} /> : null}
        </div>
      ) : null}
    </div>
  );
}

