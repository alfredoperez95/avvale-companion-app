'use client';

import { useRef, useState } from 'react';
import styles from './DropzoneUploader.module.css';

function PdfIcon() {
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
}: {
  file: File | null;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const pick = () => inputRef.current?.click();

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
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
      aria-label="Carga de PDF"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className={styles.hiddenInput}
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <PdfIcon />
      <div className={styles.title}>Arrastra y suelta tu PDF aquí</div>
      <div className={styles.hint}>o elige un archivo desde el equipo</div>
      <button type="button" className={styles.btnPrimary} onClick={pick} disabled={disabled}>
        Seleccionar PDF
      </button>
      <div className={styles.meta}>Solo PDF · Máx. 20&nbsp;MB</div>

      {file && (
        <div className={styles.fileChip} aria-label="Archivo seleccionado">
          <span className={styles.fileIcon} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <div className={styles.fileMeta}>
            <div className={styles.fileName}>{file.name}</div>
            <div className={styles.fileNote}>{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
          </div>
        </div>
      )}
    </div>
  );
}
