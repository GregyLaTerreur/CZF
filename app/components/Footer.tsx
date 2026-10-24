import Link from 'next/link';
import { RULEBOOK_URL } from './links';
import styles from './footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>© CZF — Clash des Zéros de la Faille</span>
        <nav className={styles.links}>
          <Link href="/teams">Équipes</Link>
          <Link href="/players">Joueurs</Link>
          <Link href="/hall-of-fame">Hall of Fame</Link>
          <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer">
            Rulebook
          </a>
        </nav>
      </div>
    </footer>
  );
}
