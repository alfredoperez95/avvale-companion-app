'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { VariableHighlightExtension } from './variableHighlightExtension';
import { Icon } from '@/components/Icon/Icon';
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

/** Opciones de tamaño para insertar tabla (filas × columnas) */
const TABLE_SIZES = [
  { rows: 2, cols: 2 },
  { rows: 2, cols: 3 },
  { rows: 3, cols: 2 },
  { rows: 3, cols: 3 },
  { rows: 3, cols: 4 },
  { rows: 4, cols: 3 },
  { rows: 4, cols: 4 },
];

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
  allowImages,
  disableTableFeatures,
}: {
  editor: Editor | null;
  insertableVariables?: readonly { value: string; label: string }[];
  allowImages?: boolean;
  disableTableFeatures?: boolean;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [tableSizeOpen, setTableSizeOpen] = useState(false);
  const colorGroupRef = useRef<HTMLSpanElement>(null);
  const emojiGroupRef = useRef<HTMLSpanElement>(null);
  const linkGroupRef = useRef<HTMLSpanElement>(null);
  const tableSizeGroupRef = useRef<HTMLSpanElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (colorGroupRef.current?.contains(t) || emojiGroupRef.current?.contains(t) || linkGroupRef.current?.contains(t) || tableSizeGroupRef.current?.contains(t)) return;
      setColorOpen(false);
      setEmojiOpen(false);
      setLinkOpen(false);
      setTableSizeOpen(false);
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
          onClick={() => { setColorOpen((o) => !o); setEmojiOpen(false); setTableSizeOpen(false); }}
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
          onClick={() => { setEmojiOpen((o) => !o); setColorOpen(false); setTableSizeOpen(false); }}
          title="Insertar emoji"
          aria-label="Insertar emoji"
          aria-expanded={emojiOpen}
        >
          <Icon name="emoji" size={16} />
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
        aria-label="Lista con viñetas"
      >
        <Icon name="listBullet" size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? styles.toolbarBtnActive : styles.toolbarBtn}
        title="Lista numerada"
        aria-label="Lista numerada"
      >
        <Icon name="listNumber" size={16} />
      </button>
      <span ref={linkGroupRef} className={styles.toolbarGroup} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setLinkOpen((o) => !o);
            setColorOpen(false);
            setEmojiOpen(false);
            setTableSizeOpen(false);
            if (!linkOpen) setLinkUrl(editor.getAttributes('link').href ?? '');
          }}
          className={editor.isActive('link') ? styles.toolbarBtnActive : styles.toolbarBtn}
          title="Enlace"
          aria-label="Insertar o editar enlace"
          aria-expanded={linkOpen}
        >
          <Icon name="link" size={16} />
        </button>
        {linkOpen && (
          <div className={styles.toolbarDropdown} role="dialog" aria-label="URL del enlace">
            <label className={styles.linkLabel} htmlFor="link-url-input">
              URL del enlace
            </label>
            <input
              id="link-url-input"
              type="url"
              className={styles.linkInput}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const url = linkUrl.trim();
                  if (url) editor.chain().focus().setLink({ href: url }).run();
                  setLinkOpen(false);
                }
                if (e.key === 'Escape') setLinkOpen(false);
              }}
            />
            <div className={styles.linkActions}>
              <button
                type="button"
                className={styles.linkBtnPrimary}
                onClick={() => {
                  const url = linkUrl.trim();
                  if (url) editor.chain().focus().setLink({ href: url }).run();
                  setLinkOpen(false);
                }}
              >
                Aplicar
              </button>
              <button
                type="button"
                className={styles.linkBtnSecondary}
                onClick={() => setLinkOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </span>
      {!disableTableFeatures && (
        <span ref={tableSizeGroupRef} className={styles.toolbarGroup} style={{ position: 'relative' }}>
          <button
            type="button"
            className={tableSizeOpen ? styles.toolbarBtnActive : styles.toolbarBtn}
            onClick={() => {
              setTableSizeOpen((o) => !o);
              setColorOpen(false);
              setEmojiOpen(false);
              setLinkOpen(false);
            }}
            title="Insertar tabla"
            aria-label="Insertar tabla"
            aria-expanded={tableSizeOpen}
          >
            <Icon name="table" size={16} />
          </button>
          {tableSizeOpen && (
            <div className={styles.toolbarDropdown} role="menu" aria-label="Tamaño de la tabla">
              <div className={styles.tableSizeTitle}>Filas × Columnas</div>
              <div className={styles.tableSizeGrid}>
                {TABLE_SIZES.map(({ rows, cols }) => (
                  <button
                    key={`${rows}-${cols}`}
                    type="button"
                    className={styles.tableSizeOption}
                    onClick={() => {
                      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
                      setTableSizeOpen(false);
                    }}
                  >
                    {rows}×{cols}
                  </button>
                ))}
              </div>
            </div>
          )}
        </span>
      )}
      {allowImages && (
        <>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className={styles.toolbarFileInput}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || !file.type.startsWith('image/')) {
                e.target.value = '';
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const src = reader.result as string;
                editor.chain().focus().setImage({ src }).run();
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={styles.toolbarBtn}
            title="Insertar imagen"
            aria-label="Insertar imagen"
            onClick={() => {
              setColorOpen(false);
              setEmojiOpen(false);
              setLinkOpen(false);
              setTableSizeOpen(false);
              imageFileInputRef.current?.click();
            }}
          >
            <span className={styles.toolbarImageGlyph} aria-hidden>
              🖼
            </span>
          </button>
        </>
      )}
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
  /** Si es true, permite insertar imágenes (data URL, p. ej. firma de correo). */
  allowImages?: boolean;
  /** Si es true, no incluye extensiones de tabla ni UI de tablas (p. ej. firma con HTML fuente aparte). */
  disableTableFeatures?: boolean;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe aquí…',
  minHeight = 120,
  id,
  'aria-label': ariaLabel,
  insertableVariables,
  allowImages = false,
  disableTableFeatures = false,
}: RichTextEditorProps) {
  const [variablePicker, setVariablePicker] = useState<{ from: number; to: number } | null>(null);
  const [showTableToolbar, setShowTableToolbar] = useState(false);
  /** Evita setContent cuando value ya es el HTML emitido por onUpdate pero getHTML() difiere por normalización TipTap. */
  const lastEmittedHtmlRef = useRef<string | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Underline,
      TextStyle,
      Color,
      ...(disableTableFeatures
        ? []
        : [
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
          ]),
      VariableHighlightExtension,
      ...(allowImages
        ? [
            Image.configure({
              inline: false,
              allowBase64: true,
            }),
          ]
        : []),
    ],
    [allowImages, placeholder, disableTableFeatures],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value ?? '',
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      lastEmittedHtmlRef.current = html;
      onChange(html);
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
    if (value === current) {
      lastEmittedHtmlRef.current = current;
      return;
    }
    if (value === lastEmittedHtmlRef.current) {
      return;
    }
    editor.commands.setContent(value || '', { emitUpdate: false });
    lastEmittedHtmlRef.current = editor.getHTML();
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

  useEffect(() => {
    if (!editor || disableTableFeatures) return;
    const handler = () => setShowTableToolbar(editor.isActive('table'));
    editor.on('selectionUpdate', handler);
    handler();
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, disableTableFeatures]);

  return (
    <div className={styles.richTextEditorWrapper} style={{ minHeight }} data-rich-editor>
      <Toolbar
        editor={editor}
        insertableVariables={insertableVariables}
        allowImages={allowImages}
        disableTableFeatures={disableTableFeatures}
      />
      {editor && !disableTableFeatures && showTableToolbar && (
        <div className={styles.tableToolbar} role="toolbar" aria-label="Acciones de tabla">
          <button
            type="button"
            className={styles.tableToolbarBtn}
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title="Añadir fila arriba"
          >
            Fila arriba
          </button>
          <button
            type="button"
            className={styles.tableToolbarBtn}
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Añadir fila abajo"
          >
            Fila abajo
          </button>
          <button
            type="button"
            className={styles.tableToolbarBtn}
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Añadir columna antes"
          >
            Col antes
          </button>
          <button
            type="button"
            className={styles.tableToolbarBtn}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Añadir columna después"
          >
            Col después
          </button>
          <span className={styles.tableToolbarSep} aria-hidden="true" />
          <button
            type="button"
            className={styles.tableToolbarBtnDanger}
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Eliminar fila"
          >
            Quitar fila
          </button>
          <button
            type="button"
            className={styles.tableToolbarBtnDanger}
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Eliminar columna"
          >
            Quitar col
          </button>
          <button
            type="button"
            className={styles.tableToolbarBtnDanger}
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Eliminar tabla"
          >
            Quitar tabla
          </button>
        </div>
      )}
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
