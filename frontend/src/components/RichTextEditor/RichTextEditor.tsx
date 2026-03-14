'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import styles from './RichTextEditor.module.css';

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formato">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Negrita"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Cursiva"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Lista"
      >
        • Lista
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Lista numerada"
      >
        1. Lista
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('URL del enlace:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={editor.isActive('link') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Enlace"
      >
        Enlace
      </button>
    </div>
  );
}

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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value ?? '',
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className={styles.richTextEditorWrapper} style={{ minHeight }} data-rich-editor>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
