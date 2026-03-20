import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingScreen({ message = 'Cargando contenido...', fullPage = true }: LoadingScreenProps) {
  return (
    <div className={`${styles.container} ${fullPage ? styles.fullPage : styles.inline}`} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.indicatorWrap}>
          <span className={styles.busyIndicator} aria-hidden="true" />
        </div>
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
}
