'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '@/app/components/icons/CloseIcon';
import { RARITY_LABELS, type TcgCard } from '@/lib/tcg/cards';
import PlayerCard from './PlayerCard';
import CardElectric from './CardElectric';
import styles from './cardZoom.module.css';

// Carte affichée en grand par-dessus la page. Fermeture : clic à côté, bouton ou Échap.
export default function CardZoom({ card, count, onClose }: { card: TcgCard; count?: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const missing = count === 0;
  const meta = [
    RARITY_LABELS[card.rarity],
    card.number && card.season_total ? `n° ${card.number}/${card.season_total}` : null,
    count === undefined ? null : missing ? 'Pas encore obtenue' : `${count} exemplaire${count > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ');

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={card.name} onClick={onClose}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
        <CloseIcon />
      </button>
      <div className={styles.stage} onClick={(event) => event.stopPropagation()}>
        <div className={`${styles.card} ${missing ? styles.missing : ''}`}>
          {!missing && <CardElectric rarity={card.rarity} />}
          <PlayerCard card={card} large />
        </div>
        <div className={styles.meta}>{meta}</div>
      </div>
    </div>,
    document.body
  );
}
