'use client';

import { useCallback, useRef, useState } from 'react';
import dz from '@/components/yubiq/DropzoneUploader/DropzoneUploader.module.css';
import styles from './MultiDropzoneUploader.module.css';

/** Extensiones alineadas con extracción backend (PDF, texto, hojas, etc.). */
export const RFQ_SOURCES_ACCEPT =
  '.pdf,.txt,.text,.md,.csv,.tsv,.json,.xml,.html,.htm,.xlsx,.xls,.log';

function fileKey(f: File) {
  return `${f.name}\0${f.size}\0${f.lastModified}`;
}

function mergeUnique(prev: File[], added: File[]): File[] {
  const keys = new Set(prev.map(fileKey));
  const out = [...prev];
  for (const f of added) {
    const k = fileKey(f);
    if (!keys.has(k)) {
      keys.add(k);
      out.push(f);
    }
  }
  return out;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DocumentsGlyph() {
  return (
    <svg className={styles.docIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

export function MultiDropzoneUploader({
  files,
  onFilesChange,
  disabled,
  accept = RFQ_SOURCES_ACCEPT,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const pick = () => inputRef.current?.click();

  const addFiles = useCallback(
    (list: FileList | null | undefined) => {
      if (!list?.length) return;
      onFilesChange(mergeUnique(files, Array.from(list)));
    },
    [files, onFilesChange],
  );

  const removeAt = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const clearAll = () => onFilesChange([]);

  return (
    <div
      className={active ? `${dz.dropzone} ${dz.dropzoneActive}` : dz.dropzone}
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
        addFiles(e.dataTransfer.files);
      }}
      role="group"
      aria-label="Carga de documentación"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className={dz.hiddenInput}
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className={dz.iconWrap}>
        <DocumentsGlyph />
      </div>
      <div className={dz.title}>Arrastra y suelta archivos aquí</div>
      <div className={dz.hint}>o elige uno o varios desde el equipo</div>
      <button type="button" className={dz.btnPrimary} onClick={pick} disabled={disabled}>
        Seleccionar archivos
      </button>
      <div className={dz.meta}>
        PDF, texto, Excel… · Varios adjuntos · Máx. ~50&nbsp;MB por archivo (límite del servidor)
      </div>

      {files.length > 0 ? (
        <>
          <ul className={styles.fileList}>
            {files.map((f, i) => (
              <li key={`${fileKey(f)}-${i}`} className={styles.fileRow}>
                <div className={styles.fileRowMain}>
                  <div className={styles.fileRowName}>{f.name}</div>
                  <div className={styles.fileRowNote}>{formatSize(f.size)}</div>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeAt(i)}
                  disabled={disabled}
                  aria-label={`Quitar ${f.name}`}
                  title="Quitar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.btnClear} onClick={clearAll} disabled={disabled}>
            Quitar todos
          </button>
        </>
      ) : null}
    </div>
  );
}
