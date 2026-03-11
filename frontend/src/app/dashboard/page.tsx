'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_URL ?? '';
    fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: '2rem' }}>Cargando…</p>;
  if (!user) return null;

  return (
    <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Dashboard</h1>
        <span style={{ color: '#6a6d70' }}>{user.email}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <Link
          href="/activations"
          style={{
            padding: '1.5rem',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            color: '#32363a',
          }}
        >
          <strong>Mis activaciones</strong>
          <p style={{ marginTop: 8, fontSize: 14, color: '#6a6d70' }}>Ver listado</p>
        </Link>
        <div
          style={{
            padding: '1.5rem',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <strong>Nueva activación</strong>
          <p style={{ marginTop: 8, fontSize: 14, color: '#6a6d70' }}>Próximamente</p>
        </div>
      </div>
    </main>
  );
}
