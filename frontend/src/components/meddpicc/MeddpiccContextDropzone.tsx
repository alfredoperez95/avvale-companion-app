'use client';

import { useRef, useState } from 'react';
import dz from '@/components/yubiq/DropzoneUploader/DropzoneUploader.module.css';

/** Alineado con backend MEDDPICC (extracción a Markdown). */
export const MEDDPICC_ATTACH_ACCEPT =
  '.pdf,.xlsx,.xls,.xlsm,.docx,.eml,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,message/rfc822';

function DocumentsGlyph() {
  return (
    <svg className={dz.pdfIcon} width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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

type Props = {
  /** Subida en curso: desactiva la zona y muestra estado en el copy. */
  uploading?: boolean;
  /** Desactiva la zona sin copiar de «subiendo» (p. ej. otro paso del formulario en curso). */
  disabled?: boolean;
  onFilesSelected: (files: FileList) => void;
};

/**
 * Misma estética que Yubiq Approve & Seal Filler / RFQ: borde discontinuo, gradiente, arrastrar y soltar.
 */
export function MeddpiccContextDropzone({ uploading, disabled, onFilesSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const isDisabled = Boolean(uploading || disabled);

  const pick = () => inputRef.current?.click();

  const addFiles = (list: FileList | null | undefined) => {
    if (!list?.length) return;
    onFilesSelected(list);
  };

  return (
    <div
      className={active && !isDisabled ? `${dz.dropzone} ${dz.dropzoneActive}` : dz.dropzone}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabled) return;
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabled) return;
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
        if (isDisabled) return;
        addFiles(e.dataTransfer.files);
      }}
      role="group"
      aria-label="Adjuntar archivos al contexto del deal"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEDDPICC_ATTACH_ACCEPT}
        className={dz.hiddenInput}
        disabled={isDisabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className={dz.iconWrap}>
        <DocumentsGlyph />
      </div>
      <div className={dz.title}>
        {uploading
          ? 'Subiendo y extrayendo texto…'
          : disabled
            ? 'Espera a terminar el paso actual'
            : 'Arrastra y suelta archivos aquí'}
      </div>
      <div className={dz.hint}>
        {uploading
          ? 'Espera a que termine la subida.'
          : disabled
            ? 'Cuando puedas de nuevo, añade archivos a la cola o pulsa Crear deal.'
            : 'o elige uno o varios desde el equipo'}
      </div>
      <button type="button" className={dz.btnPrimary} onClick={pick} disabled={isDisabled}>
        {uploading ? 'Procesando…' : disabled ? 'No disponible' : 'Seleccionar archivos'}
      </button>
      <div className={dz.meta}>
        PDF, Excel, Word (.docx), correo (.eml) · El texto se extrae a Markdown · Hasta 25 adjuntos por deal · 25&nbsp;MB por archivo
      </div>
    </div>
  );
}
