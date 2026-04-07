'use client';

import { useEffect, useState } from 'react';
import { apiFetch, redirectToLogin } from '@/lib/api';
import { useRefreshUser } from '@/contexts/UserContext';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './CredentialsForm.module.css';

type AnthropicCredentialStatus = { configured: boolean; masked: string | null };
type TestConnectionResponse = { ok: boolean; message: string };

type CredentialsFormProps = {
  /** Si true, no dibuja contenedor ni título (p. ej. dentro de una tarjeta de perfil). */
  embedded?: boolean;
};

export function CredentialsForm({ embedded = false }: CredentialsFormProps = {}) {
  const refreshUser = useRefreshUser();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AnthropicCredentialStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

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
      await refreshUser();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!status?.configured || removing) return;
    setShowRemoveConfirm(false);
    setError('');
    setOkMsg('');
    setRemoving(true);
    try {
      const res = await apiFetch('/api/user/ai-credentials/anthropic', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'No se pudo eliminar la clave.');
        return;
      }
      setApiKey('');
      setOkMsg('API key eliminada.');
      await loadStatus();
      await refreshUser();
    } finally {
      setRemoving(false);
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

  const rootClass = embedded ? styles.embeddedRoot : styles.card;

  return (
    <div className={rootClass}>
      {!embedded ? (
        <>
          <h2 className={styles.sectionTitle}>AI Credentials</h2>
          <p className={styles.desc}>
            Guarda tu API key personal de Anthropic (Claude). Se almacena cifrada y solo se usa en el backend.
          </p>
        </>
      ) : (
        <p className={styles.desc}>
          Guarda tu API key personal de Anthropic (Claude). Se almacena cifrada y solo se usa en el backend.
        </p>
      )}

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
          disabled={saving || removing}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleTest}
          disabled={testing || !status?.configured || removing}
          title={!status?.configured ? 'Configura una API key antes de probar' : 'Probar conexión'}
        >
          {testing ? 'Probando…' : 'Test connection'}
        </button>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={() => setShowRemoveConfirm(true)}
          disabled={removing || !status?.configured || saving}
          title={
            !status?.configured ? 'No hay clave guardada' : 'Eliminar la API key de este dispositivo/cuenta'
          }
        >
          {removing ? 'Eliminando…' : 'Eliminar clave'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {okMsg && <p className={styles.ok}>{okMsg}</p>}

      <ConfirmDialog
        open={showRemoveConfirm}
        title="¿Eliminar la API key?"
        message="Se borrará la clave guardada. Los módulos que usan IA (Yubiq, Análisis RFQs) quedarán bloqueados hasta que configures una clave nueva."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void handleRemoveConfirm()}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
}

