'use client';

import type { Rarity } from '@/lib/tcg/cards';
import styles from './cardElectric.module.css';

// Effet électrique d'une carte : un courant lent fait le tour (maquette « E2 »), plus marqué selon la rareté.
// Les veines lumineuses qui entraient dans la carte (« V5 ») ont été retirées. Rien en commune.
// À poser dans un parent en position relative, de la taille de la carte.
export default function CardElectric({ rarity }: { rarity: Rarity }) {
  if (rarity === 'commune') return null;

  return (
    <div className={`${styles.electric} ${styles[rarity]}`} aria-hidden="true">
      <div className={styles.glow} />
      {rarity === 'legendaire' && <div className={styles.base} />}
      <div className={styles.current} />
    </div>
  );
}
