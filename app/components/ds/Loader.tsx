import styles from './loader.module.css';

// Loader du site (design system) : l'éclair CZF qui se trace en boucle, avec un libellé.
// tone : 'light' sur fond clair (défaut), 'dark' sur fond sombre.
// block : chargement d'une page, l'éclair sur un panneau dark (ombre orange) qui prend la place du contenu.
export default function Loader({ label = 'Chargement', tone = 'light', block = false }: { label?: string; tone?: 'light' | 'dark'; block?: boolean }) {
  return (
    <div className={`${styles.loader} ${tone === 'dark' || block ? styles.dark : ''} ${block ? styles.block : ''}`} role="status" aria-live="polite">
      <div className={block ? styles.panel : styles.inline}>
        <svg className={styles.bolt} viewBox="0 0 60 90" aria-hidden="true">
          <path d="M36 4 10 50h20l-8 36 28-48H30z" />
        </svg>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
