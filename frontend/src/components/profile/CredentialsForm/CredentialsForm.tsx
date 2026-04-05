'use client';

import { useEffect, useState } from 'react';
import { apiFetch, redirectToLogin } from '@/lib/api';
import styles from './CredentialsForm.module.css';

type AnthropicCredentialStatus = { configured: boolean; masked: string | null };
type TestConnectionResponse = { ok: boolean; message: string };

export function CredentialsForm() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AnthropicCredentialStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const loadStatus = async () => {
    const res = await apiFetch('/api/user/ai-credentials/anthropic');
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    if (!res.ok) return;
    const data = (await res.json().catch(() => null)) as AnthropicCredentialStatus | null;
    if (data) setStatus(data);
  };

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError('');
    setOkMsg('');
    const key = apiKey.trim();
    if (!key) {
      setError('Pega tu API key de Anthropic.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/user/ai-credentials/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'No se pudo guardar la API key.');
        return;
      }
      setApiKey('');
      setOkMsg('API key guardada.');
      await loadStatus();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setError('');
    setOkMsg('');
    setTesting(true);
    try {
      const res = await apiFetch('/api/user/ai-credentials/anthropic/test', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as TestConnectionResponse | null;
      if (!res.ok) {
        setError(data?.message ?? 'Test fallido.');
        return;
      }
      if (data?.ok) setOkMsg(data.message || 'Conexión OK');
      else setError(data?.message ?? 'Test fallido.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>AI Credentials</h2>
      <p className={styles.desc}>
        Guarda tu API key personal de Anthropic (Claude). Se almacena cifrada y solo se usa en el backend.
      </p>

      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="anthropic-api-key">
            Anthropic API Key
          </label>
          {!loading && (
            <span className={styles.masked}>
              {status?.configured ? (status.masked ?? 'Configurada') : 'No configurada'}
            </span>
          )}
        </div>
        <input
          id="anthropic-api-key"
          type="password"
          className={styles.input}
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError('');
            setOkMsg('');
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleTest}
          disabled={testing || !status?.configured}
          title={!status?.configured ? 'Configura una API key antes de probar' : 'Probar conexión'}
        >
          {testing ? 'Probando…' : 'Test connection'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {okMsg && <p className={styles.ok}>{okMsg}</p>}
    </div>
  );
}

