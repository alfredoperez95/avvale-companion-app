import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Activaciones</h1>
      <p style={{ marginBottom: '1.5rem', color: '#6a6d70' }}>
        Gestión de activaciones por email. Inicia sesión para continuar.
      </p>
      <Link
        href="/login"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          background: '#0854a0',
          color: '#fff',
          borderRadius: 4,
        }}
      >
        Iniciar sesión
      </Link>
    </main>
  );
}
