import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Activaciones</h1>
      <p className={styles.lead}>
        Gestión de activaciones por email. Inicia sesión para continuar.
      </p>
      <Link href="/login" className={styles.link}>
        Iniciar sesión
      </Link>
    </main>
  );
}
