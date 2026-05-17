'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from './login.module.css';

export const LOGIN_EMAIL_DOMAINS = ['@avvale.com', '@axazure.com'] as const;
export type LoginEmailDomain = (typeof LOGIN_EMAIL_DOMAINS)[number];

type EmailDomainPickerProps = {
  id?: string;
  value: LoginEmailDomain;
  onChange: (domain: LoginEmailDomain) => void;
  'aria-label'?: string;
};

export function EmailDomainPicker({ id, value, onChange, 'aria-label': ariaLabel }: EmailDomainPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const triggerId = id ?? undefined;

  const close = useCallback(() => setOpen(false), []);

  const selectDomain = useCallback(
    (domain: LoginEmailDomain) => {
      onChange(domain);
      close();
    },
    [onChange, close],
  );

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
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (!wrapRef.current?.contains(document.activeElement)) return;
      const idx = LOGIN_EMAIL_DOMAINS.indexOf(value);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = LOGIN_EMAIL_DOMAINS[(idx + 1) % LOGIN_EMAIL_DOMAINS.length];
        onChange(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = LOGIN_EMAIL_DOMAINS[(idx - 1 + LOGIN_EMAIL_DOMAINS.length) % LOGIN_EMAIL_DOMAINS.length];
        onChange(next);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, value, onChange]);

  return (
    <div className={styles.emailDomainWrap} ref={wrapRef}>
      <button
        type="button"
        id={triggerId}
        className={`${styles.emailDomainTrigger} ${open ? styles.emailDomainTriggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={styles.emailDomainValue}>{value}</span>
        <svg className={styles.emailDomainChevron} viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className={styles.emailDomainMenu} role="listbox" aria-label={ariaLabel} aria-activedescendant={`${listId}-${value}`}>
          {LOGIN_EMAIL_DOMAINS.map((domain) => {
            const isSelected = domain === value;
            return (
              <li key={domain} id={`${listId}-${domain}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.emailDomainMenuOption} ${isSelected ? styles.emailDomainMenuOptionSelected : ''}`}
                  onClick={() => selectDomain(domain)}
                >
                  <span>{domain}</span>
                  {isSelected ? (
                    <svg className={styles.emailDomainCheck} viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
