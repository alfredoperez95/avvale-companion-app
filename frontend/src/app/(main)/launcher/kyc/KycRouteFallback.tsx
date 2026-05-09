import styles from './kyc.module.css';

export function KycRouteFallback() {
  return (
    <div className={`${styles.frame} ${styles.routeFallback}`} role="status" aria-live="polite">
      <span className={`${styles.routeFallbackIcon} sap-icon sap-icon--synchronize`} aria-hidden />
      <span>Cargando KYC…</span>
    </div>
  );
}
