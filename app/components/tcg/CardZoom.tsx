'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createPortal } from 'react-dom';
import Loader from '@/app/components/ds/Loader';
import CloseIcon from '@/app/components/icons/CloseIcon';
import { RARITY_LABELS, type TcgCard } from '@/lib/tcg/cards';
import PlayerCard from './PlayerCard';
import CardElectric from './CardElectric';
import { fontVariables } from '@/app/fonts';
import styles from './cardZoom.module.css';

type Owner = { profileId: string; name: string; avatar: string | null; count: number };
type Owners = { owners: Owner[]; totalOwners: number; totalCopies: number };

function OwnerAvatar({ owner }: { owner: Owner }) {
  const [broken, setBroken] = useState(false);
  return owner.avatar && !broken ? (
    <img className={styles.avatar} src={`${owner.avatar}?size=64`} alt="" loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span className={styles.avatar}>{owner.name.charAt(0).toUpperCase()}</span>
  );
}

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

  // Top 20 des détenteurs de la carte (les plus d'exemplaires en haut).
  const [owners, setOwners] = useState<Owners | null>(null);
  const [ownersError, setOwnersError] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => {
    if (!card.id) return;
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error();
      if (alive) setMyId(session.user.id);
      const response = await fetch(`/api/tcg/cards/${card.id}/owners`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await response.json();
      if (!json.success) throw new Error();
      if (alive) setOwners(json);
    })().catch(() => alive && setOwnersError(true));
    return () => {
      alive = false;
    };
  }, [card.id]);

  const missing = count === 0;
  const meta = [
    RARITY_LABELS[card.rarity],
    card.number && card.season_total ? `n° ${card.number}/${card.season_total}` : null,
    count === undefined ? null : missing ? 'Pas encore obtenue' : `${count} exemplaire${count > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ');

  // Rendu hors de <main> (portail) : on remet les variables de police du site (fontVariables).
  return createPortal(
    <div className={`${styles.backdrop} ${fontVariables}`} role="dialog" aria-modal="true" aria-label={card.name} onClick={onClose}>
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

      {card.id && (
        <aside className={styles.owners} onClick={(event) => event.stopPropagation()}>
          <div className={styles.ownersTitle}>Qui l’a</div>
          {ownersError ? (
            <p className={styles.ownersEmpty}>Détenteurs indisponibles.</p>
          ) : !owners ? (
            <Loader label="Chargement des détenteurs" />
          ) : !owners.owners.length ? (
            <p className={styles.ownersEmpty}>Personne ne l’a encore obtenue.</p>
          ) : (
            <>
              <div className={styles.ownersSummary}>
                {owners.totalOwners} joueur{owners.totalOwners > 1 ? 's' : ''} · {owners.totalCopies} exemplaire{owners.totalCopies > 1 ? 's' : ''}
              </div>
              <ol className={styles.ownersList}>
                {owners.owners.map((owner, index) => (
                  <li key={owner.profileId} className={owner.profileId === myId ? styles.ownerMe : undefined}>
                    <span className={styles.rank}>{index + 1}</span>
                    <OwnerAvatar owner={owner} />
                    <Link href={`/collection?profil=${owner.profileId}`} className={styles.ownerName} onClick={onClose}>
                      {owner.name}
                    </Link>
                    <b>x{owner.count}</b>
                  </li>
                ))}
              </ol>
              {owners.totalOwners > owners.owners.length && (
                <p className={styles.ownersEmpty}>Top {owners.owners.length} sur {owners.totalOwners} joueurs.</p>
              )}
            </>
          )}
        </aside>
      )}
    </div>,
    document.body
  );
}
