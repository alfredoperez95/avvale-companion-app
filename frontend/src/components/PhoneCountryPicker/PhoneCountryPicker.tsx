'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PHONE_COUNTRY_OPTIONS, countryNameFromOption, getPhoneCountryByIso } from '@/lib/phone-country-codes';
import { CountryFlag } from './CountryFlag';
import styles from './PhoneCountryPicker.module.css';

type PhoneCountryPickerProps = {
  value: string;
  onChange: (iso: string) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export function PhoneCountryPicker({
  value,
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: PhoneCountryPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = getPhoneCountryByIso(value) ?? getPhoneCountryByIso('ES')!;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <CountryFlag iso={selected.iso} className={styles.flagSvg} />
        <span className={styles.dial}>{selected.dialCode}</span>
        <svg className={styles.chevron} viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul id={listId} className={styles.dropdown} role="listbox" aria-label={ariaLabel}>
          {PHONE_COUNTRY_OPTIONS.map((opt) => {
            const isSel = opt.iso === value;
            return (
              <li key={opt.iso} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`${styles.option} ${isSel ? styles.optionSelected : ''}`}
                  onClick={() => {
                    onChange(opt.iso);
                    close();
                  }}
                >
                  <span className={styles.optionFlag}>
                    <CountryFlag iso={opt.iso} className={styles.flagSvgOption} />
                  </span>
                  <span className={styles.optionName}>{countryNameFromOption(opt)}</span>
                  <span className={styles.optionDial}>{opt.dialCode}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
