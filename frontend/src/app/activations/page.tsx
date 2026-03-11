'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Activation = {
  id: string;
  status: string;
  projectName: string;
  offerCode: string;
  recipientTo: string;
  createdAt: string;
};

export default function ActivationsPage() {
  const [list, setList] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/activations')
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return [];
        }
        return r.json();
      })
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link href="/dashboard" style={{ color: '#0854a0' }}>← Dashboard</Link>
      </div>
      <h1 style={{ marginBottom: '1rem' }}>Mis activaciones</h1>
      {loading ? (
        <p>Cargando…</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#6a6d70' }}>No hay activaciones. Crea una desde el dashboard.</p>
      ) : (
        <div style={{ overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Proyecto</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Oferta</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Destinatario</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Estado</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Creado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.75rem' }}>{a.projectName}</td>
                  <td style={{ padding: '0.75rem' }}>{a.offerCode}</td>
                  <td style={{ padding: '0.75rem' }}>{a.recipientTo}</td>
                  <td style={{ padding: '0.75rem' }}>{a.status}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(a.createdAt).toLocaleDateString('es')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
