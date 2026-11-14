'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import { RARITIES, RARITY_LABELS, type Rarity, type TcgCard } from '@/lib/tcg/cards';
import { boosterImage, type TcgBooster } from '@/lib/tcg/boosters';
import styles from './collection.module.css';

type OwnedBooster = { quantity: number; booster: TcgBooster };
type OwnedCard = { card: TcgCard; count: number };

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

const byRarity = (a: OwnedCard, b: OwnedCard) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity);

export default function CollectionView() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [boosters, setBoosters] = useState<OwnedBooster[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [filter, setFilter] = useState<Rarity | 'toutes'>('toutes');
  const [opening, setOpening] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<TcgCard[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return setLoggedIn(false);
    setLoggedIn(true);

    try {
      const response = await fetch('/api/tcg/me', { cache: 'no-store', headers });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setBoosters(json.boosters);
      setCards(json.cards);
      setTotalCards(json.totalCards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Les cartes tirées se retournent une par une.
  useEffect(() => {
    if (!drawn || revealed >= drawn.length) return;
    const timer = window.setTimeout(() => setRevealed((count) => count + 1), revealed === 0 ? 500 : 650);
    return () => window.clearTimeout(timer);
  }, [drawn, revealed]);

  async function open(boosterId: number) {
    if (opening !== null) return;
    setOpening(boosterId);
    setError('');

    try {
      const headers = await authHeaders();
      if (!headers) throw new Error('Reconnecte-toi avec Discord.');
      const response = await fetch('/api/tcg/open', { method: 'POST', headers, body: JSON.stringify({ booster_id: boosterId }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setRevealed(0);
      setDrawn(json.cards);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setOpening(null);
    }
  }

  const ownedCount = cards.length;
  const shown = cards.filter((item) => filter === 'toutes' || item.card.rarity === filter).sort(byRarity);
  const boosterCount = boosters.reduce((sum, item) => sum + item.quantity, 0);

  if (loggedIn === null) return <div className={`${ds.container} ${styles.wrap}`}><p className={ds.empty}>Chargement…</p></div>;

  if (!loggedIn) {
    return (
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Collection</div>
        <h1 className={styles.title}>Ma collection</h1>
        <p className={styles.sub}>Connecte-toi pour ouvrir tes boosters et voir tes cartes.</p>
        <Link href="/login" className={ds.btnPrimary}>Se connecter</Link>
      </div>
    );
  }

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={ds.sectionLabel}>Collection · Test dev</div>
      <h1 className={styles.title}>Ma collection</h1>
      <p className={styles.sub}>
        {ownedCount} carte{ownedCount > 1 ? 's' : ''} différente{ownedCount > 1 ? 's' : ''} sur {totalCards} · {boosterCount} booster{boosterCount > 1 ? 's' : ''} à ouvrir
      </p>

      {error && <p className={ds.formError}>{error}</p>}

      <div className={ds.sectionLabel}>Mes boosters</div>
      {!boosters.length && <p className={ds.empty}>Aucun booster pour l’instant.</p>}
      <div className={styles.boosters}>
        {boosters.map(({ booster, quantity }) => (
          <div key={booster.id} className={styles.booster}>
            <div className={styles.boosterPack}>
              <img src={boosterImage(booster, 400)} alt="" />
              <span className={styles.badge}>x{quantity}</span>
            </div>
            <div className={styles.boosterName}>{booster.name}</div>
            <button type="button" className={ds.btnPrimary} disabled={opening !== null} onClick={() => booster.id && open(booster.id)}>
              {opening === booster.id ? 'Ouverture…' : 'Ouvrir'}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.cardsHead}>
        <div className={ds.sectionLabel}>Mes cartes</div>
        <div className={ds.tabs}>
          {(['toutes', ...RARITIES] as const).map((key) => (
            <button key={key} type="button" className={filter === key ? ds.tabActive : ds.tab} onClick={() => setFilter(key)}>
              {key === 'toutes' ? 'Toutes' : RARITY_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {!shown.length && <p className={ds.empty}>{ownedCount ? 'Aucune carte de cette rareté.' : 'Ouvre un booster pour obtenir tes premières cartes.'}</p>}
      <div className={styles.grid}>
        {shown.map(({ card, count }) => (
          <div key={card.id} className={styles.owned}>
            <PlayerCard card={card} />
            {count > 1 && <span className={styles.badge}>x{count}</span>}
          </div>
        ))}
      </div>

      {drawn && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.overlayInner}>
            <div className={styles.overlayTitle}>Booster ouvert</div>
            <div className={styles.drawn}>
              {drawn.map((card, index) => (
                <div key={`${card.id}-${index}`} className={`${styles.flip} ${index < revealed ? styles.flipped : ''}`}>
                  <div className={styles.flipBack}>
                    <img src={boosterImage({ image_url: null }, 300)} alt="" />
                  </div>
                  <div className={styles.flipFront}>
                    <PlayerCard card={card} />
                  </div>
                </div>
              ))}
            </div>
            <div className={ds.formActions}>
              {revealed < drawn.length ? (
                <button type="button" className={ds.btnOutline} onClick={() => setRevealed(drawn.length)}>Tout révéler</button>
              ) : (
                <button type="button" className={ds.btnPrimary} onClick={() => setDrawn(null)}>Ajouter à ma collection</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
