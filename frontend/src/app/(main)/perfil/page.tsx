'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import styles from './perfil.module.css';

type Profile = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  position: string | null;
  role?: string;
  createdAt?: string;
};

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    position: '',
  });

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          setForm({
            name: data.name ?? '',
            lastName: data.lastName ?? '',
            position: data.position ?? '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          position: form.position.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? 'Error al guardar');
        return;
      }
      setProfile(data);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className={styles.loading}>Cargando…</p>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi perfil</h1>
      </header>
      <section className={styles.section} aria-labelledby="perfil-datos">
        <h2 id="perfil-datos" className={styles.sectionTitle}>
          Datos del usuario
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className={styles.input}
              placeholder="Tu nombre"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="lastName">
              Apellido
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={handleChange}
              className={styles.input}
              placeholder="Tu apellido"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="text"
              value={profile?.email ?? ''}
              readOnly
              className={styles.inputReadOnly}
              aria-readonly="true"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="position">
              Puesto
            </label>
            <input
              id="position"
              name="position"
              type="text"
              value={form.position}
              onChange={handleChange}
              className={styles.input}
              placeholder="Ej. Consultor, Analista..."
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="submit" disabled={saving} className={styles.btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
