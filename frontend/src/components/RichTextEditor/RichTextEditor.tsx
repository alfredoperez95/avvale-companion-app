'use client';

import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { useMemo } from 'react';
import styles from './RichTextEditor.module.css';

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: 120, border: '1px solid var(--fiori-border)', borderRadius: 4, padding: 8, color: 'var(--fiori-text-secondary)' }}>
      Cargando editor…
    </div>
  ),
});

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'link',
];

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  'aria-label'?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí…',
  minHeight = 120,
  id,
  'aria-label': ariaLabel,
}: RichTextEditorProps) {
  const style = useMemo(() => ({ minHeight }), [minHeight]);

  return (
    <div className={styles.richTextEditorWrapper} data-quill-client>
      <ReactQuill
        id={id}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={QUILL_MODULES}
        formats={QUILL_FORMATS}
        placeholder={placeholder}
        style={style}
        aria-label={ariaLabel}
      />
    </div>
  );
}
