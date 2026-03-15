'use client';

import { useState } from 'react';
import styles from './icons-demo.module.css';

const START = 0xe001;
const END = 0xe2ab; /* demo termina en \e2ab; \e2ac–\e2ff y \e30f–\e999 excluidos */

const MIN_SIZE = 12;
const MAX_SIZE = 48;
const STEP = 4;

export default function DemoIconsPage() {
  const [iconSize, setIconSize] = useState(24);
  const codes = Array.from({ length: END - START + 1 }, (_, i) => START + i);

  return (
    <div data-theme="fiori" className={styles.wrap}>
      <h1 className={styles.title}>{'SAP-icons (\\e001 – \\e2ab)'}</h1>
      <p className={styles.note}>
        Fuente SAP-icons. Algunos códigos pueden no tener glifo.
      </p>
      <div className={styles.controls}>
        <span className={styles.controlsLabel}>Tamaño del icono:</span>
        <button
          type="button"
          className={styles.controlsBtn}
          onClick={() => setIconSize((s) => Math.max(MIN_SIZE, s - STEP))}
          aria-label="Más pequeño"
        >
          −
        </button>
        <span className={styles.controlsValue}>{iconSize}px</span>
        <button
          type="button"
          className={styles.controlsBtn}
          onClick={() => setIconSize((s) => Math.min(MAX_SIZE, s + STEP))}
          aria-label="Más grande"
        >
          +
        </button>
      </div>
      <div className={styles.grid}>
        {codes.map((code) => (
          <div key={code} className={styles.cell}>
            <span
              className={styles.icon}
              style={{ fontSize: `${iconSize}px` }}
              aria-hidden
            >
              {String.fromCharCode(code)}
            </span>
            <span className={styles.code}>
              {'\\e' + code.toString(16).padStart(3, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
