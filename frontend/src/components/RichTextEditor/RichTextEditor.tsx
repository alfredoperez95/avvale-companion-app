'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { VariableHighlightExtension } from './variableHighlightExtension';
import styles from './RichTextEditor.module.css';

/** 9 colores estándar para email (3x3) */
const TEXT_COLORS = [
  '#000000',
  '#333333',
  '#0066cc',
  '#008000',
  '#cc0000',
  '#e67e00',
  '#6b2d5c',
  '#008080',
  '#795548',
];

/** Emojis por categoría (Objetos y oficina primero; resto como en teclado móvil) */
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Objetos y oficina',
    emojis: ['📧', '✉️', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '💼', '📅', '📆', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📂', '📁', '📄', '📃', '📑', '🔒', '🔓', '✏️', '🖊️', '🖍️', '📝', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '📱', '☎️', '📞', '📟', '🔔', '🔕', '💰', '💵', '💴', '💶', '💷', '💳', '🧾', '✂️', '🗃️', '🗄️', '🗑️', '🔖', '📓', '📔', '📒', '📕', '🔗', '⛓️', '🛠️', '🔧', '🔩', '⚙️'],
  },
  {
    label: 'Caras y emociones',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '🤤', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  },
  {
    label: 'Gestos y manos',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
  },
  {
    label: 'Personas y familia',
    emojis: ['👶', '🧒', '👦', '👧', '🧒', '👨', '👩', '🧑', '👴', '👵', '🧓', '👲', '👳', '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍💼', '👨‍💼', '👩‍💻', '👨‍💻', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫', '👩‍🏭', '👨‍🏭', '👩‍🔧', '👨‍🔧', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '🤶', '🎅', '👸', '🤴', '👰', '🤵', '👼', '🤰', '🙇', '💁', '🙅', '🙆', '🙋', '🧏', '🙇‍♂️', '🙇‍♀️'],
  },
  {
    label: 'Corazones y símbolos',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '❓', '❗', '‼️', '⁉️', '💡', '⚠️', '🚸', '🔱', '⚜️', '📛', '🔰', '♻️', '✳️', '❇️', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️'],
  },
  {
    label: 'Naturaleza y animales',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🌍', '🌎', '🌏', '🌱', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌸', '🌺', '🌻', '🌼', '🌷', '☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️', '❄️', '🔥', '💧', '🌈'],
  },
  {
    label: 'Comida y bebida',
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '☕', '🍵', '🍶', '🥤', '🍺', '🍷', '🥂', '🍾', '🍰', '🎂', '🍮', '🍩', '🍪', '🍫', '🍬', '🍭'],
  },
  {
    label: 'Actividades y deportes',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩', '🃏', '🀄', '🎴', '🎭', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎗️', '🎖️', '🏅', '🎫', '🎟️', '🎭'],
  },
  {
    label: 'Viajes y lugares',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '✈️', '🛫', '🛬', '🛩️', '🚀', '🛸', '🚁', '🛶', '⛵', '🛥️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🌄', '🌅', '🌆', '🌇', '🌉', '🎠', '🎡', '🎢', '🚂', '🗺️', '🧭', '⏰', '⏱️', '⌛', '⏳', '📅', '📆', '🗓️'],
  },
  {
    label: 'Símbolos y puntuación',
    emojis: ['💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📵', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✳️', '❇️', '™️', '®️', '©️', '💠', '🔘', '🔳', '🔲', '➿', '✔️', '☑️', '🔇', '🔈', '🔉', '🔊', '🔕', '🔔', '🃏', '🀄', '♠️', '♣️', '♥️', '♦️', '⚙️', '🔧', '🔩', '🔨', '⛏️', '🛠️', '🗡️', '⚔️', '🔫', '🛡️', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩺', '🩹', '🩼', '🩸', '🩷', '🩵', '🩶'],
  },
];

const VARIABLE_REGEX = /\{\{[^}]+\}\}/g;

/** Devuelve el rango { from, to } de la variable que contiene la posición, o null. */
function getVariableRangeAtPos(doc: PMNode, pos: number): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  doc.descendants((node, nodePos) => {
    if (result || !node.isText || !node.text) return;
    const start = nodePos;
    const end = nodePos + node.nodeSize;
    if (pos < start || pos > end) return;
    VARIABLE_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VARIABLE_REGEX.exec(node.text)) !== null) {
      const from = start + m.index;
      const to = start + m.index + m[0].length;
      if (pos >= from && pos <= to) {
        result = { from, to };
        return;
      }
    }
  });
  return result;
}

function Toolbar({
  editor,
  insertableVariables,
}: {
  editor: Editor | null;
  insertableVariables?: readonly { value: string; label: string }[];
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const colorGroupRef = useRef<HTMLSpanElement>(null);
  const emojiGroupRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editor) return;
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (colorGroupRef.current?.contains(t) || emojiGroupRef.current?.contains(t)) return;
      setColorOpen(false);
      setEmojiOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [editor]);

  if (!editor) return null;
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formato">
      {insertableVariables && insertableVariables.length > 0 && (
        <span className={styles.toolbarGroup}>
          <select
            className={styles.toolbarSelect}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                editor.chain().focus().insertContent(v).run();
                e.target.value = '';
              }
            }}
            title="Insertar variable"
            aria-label="Insertar variable"
          >
            <option value="">Insertar variable</option>
            {insertableVariables.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </span>
      )}
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
        <span className={styles.toolbarK}>K</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Subrayado"
      >
        <u>S</u>
      </button>
      <span ref={colorGroupRef} className={styles.toolbarGroup} style={{ position: 'relative' }}>
        <button
          type="button"
          className={colorOpen ? styles.toolbarBtnActive : styles.toolbarBtn}
          onClick={() => { setColorOpen((o) => !o); setEmojiOpen(false); }}
          title="Color del texto"
          aria-label="Color del texto"
          aria-expanded={colorOpen}
        >
          <span className={styles.toolbarColorIcon}>A</span>
        </button>
        {colorOpen && (
          <div className={styles.toolbarDropdown} role="menu">
            <div className={styles.colorGrid}>
              {TEXT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={styles.colorSwatch}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  onClick={() => {
                    editor.chain().focus().setColor(hex).run();
                    setColorOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </span>
      <span ref={emojiGroupRef} className={styles.toolbarGroup} style={{ position: 'relative' }}>
        <button
          type="button"
          className={emojiOpen ? styles.toolbarBtnActive : styles.toolbarBtn}
          onClick={() => { setEmojiOpen((o) => !o); setColorOpen(false); }}
          title="Insertar emoji"
          aria-label="Insertar emoji"
          aria-expanded={emojiOpen}
        >
          😀
        </button>
        {emojiOpen && (
          <div className={styles.toolbarDropdown} role="menu">
            <div className={styles.emojiDropdownScroll}>
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className={styles.emojiCategory}>
                  <div className={styles.emojiCategoryTitle}>{cat.label}</div>
                  <div className={styles.emojiGrid}>
                    {cat.emojis.map((emoji, i) => (
                      <button
                        key={`${cat.label}-${i}`}
                        type="button"
                        className={styles.emojiSwatch}
                        onClick={() => {
                          editor.chain().focus().insertContent(emoji).run();
                          setEmojiOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </span>
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

export type InsertableVariable = { value: string; label: string };

function VariablePicker({
  editor,
  variableRange,
  insertableVariables,
  onReplace,
  onClose,
}: {
  editor: Editor;
  variableRange: { from: number; to: number };
  insertableVariables: readonly InsertableVariable[];
  onReplace: (value: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const coords = editor.view.coordsAtPos(variableRange.from);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (ref.current?.contains(target)) return;
      if (editor.view.dom.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [editor.view.dom, onClose]);

  return (
    <div
      ref={ref}
      className={styles.variablePicker}
      style={{
        position: 'fixed',
        left: coords.left,
        top: coords.bottom + 4,
        zIndex: 1000,
      }}
      role="listbox"
      aria-label="Sustituir variable"
    >
      <div className={styles.variablePickerTitle}>Sustituir por</div>
      <ul className={styles.variablePickerList}>
        {insertableVariables.map((item) => (
          <li key={item.value}>
            <button
              type="button"
              className={styles.variablePickerItem}
              onClick={() => onReplace(item.value)}
              role="option"
            >
              <span className={styles.variablePickerValue}>{item.value}</span>
              <span className={styles.variablePickerLabel}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
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
  insertableVariables?: readonly InsertableVariable[];
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí…',
  minHeight = 120,
  id,
  'aria-label': ariaLabel,
  insertableVariables,
}: RichTextEditorProps) {
  const [variablePicker, setVariablePicker] = useState<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Underline,
      TextStyle,
      Color,
      VariableHighlightExtension,
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

  const handleReplaceVariable = useCallback(
    (newValue: string) => {
      if (!editor || !variablePicker) return;
      editor
        .chain()
        .focus()
        .deleteRange({ from: variablePicker.from, to: variablePicker.to })
        .insertContentAt(variablePicker.from, newValue)
        .run();
      setVariablePicker(null);
    },
    [editor, variablePicker]
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor || !insertableVariables?.length) return;
    const handler = () => {
      const { from } = editor.state.selection;
      const range = getVariableRangeAtPos(editor.state.doc, from);
      setVariablePicker(range);
    };
    editor.on('selectionUpdate', handler);
    handler();
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, insertableVariables?.length]);

  return (
    <div className={styles.richTextEditorWrapper} style={{ minHeight }} data-rich-editor>
      <Toolbar editor={editor} insertableVariables={insertableVariables} />
      <EditorContent editor={editor} className={styles.editorContent} />
      {editor &&
        variablePicker &&
        insertableVariables &&
        insertableVariables.length > 0 && (
          <VariablePicker
            editor={editor}
            variableRange={variablePicker}
            insertableVariables={insertableVariables}
            onReplace={handleReplaceVariable}
            onClose={() => setVariablePicker(null)}
          />
        )}
    </div>
  );
}
