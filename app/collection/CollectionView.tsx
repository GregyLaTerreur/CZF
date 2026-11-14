'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import CardFilters, { ShowMore, useCardFilters } from '@/app/components/tcg/CardFilters';
import { RARITIES, type Rarity, type TcgCard } from '@/lib/tcg/cards';
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
const ownedCard = (item: OwnedCard) => item.card;

type Section = 'boosters' | 'cartes' | 'doublons';

const RARITY_PLURALS: Record<Rarity, string> = { commune: 'Communes', rare: 'Rares', epique: 'Épiques', legendaire: 'Légendaires' };

const PackIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 3h12l-1 3 1 3-1 3 1 3-1 3 1 3H6l1-3-1-3 1-3-1-3 1-3-1-3Z" />
  </svg>
);
const CardsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="7" y="3" width="12" height="16" rx="2" />
    <path d="M4 7v12a2 2 0 0 0 2 2h9" />
  </svg>
);
const DupIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="7" width="10" height="14" rx="2" />
    <rect x="11" y="3" width="10" height="14" rx="2" />
  </svg>
);

export default function CollectionView() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [boosters, setBoosters] = useState<OwnedBooster[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [seasons, setSeasons] = useState<{ id: number; name: string }[]>([]);
  const [opening, setOpening] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<TcgCard[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState('');
  const firstLoad = useRef(true);
  const [section, setSection] = useState<Section>('cartes');
  const sorted = useMemo(() => [...cards].sort(byRarity), [cards]);
  const dupes = useMemo(() => sorted.filter((item) => item.count > 1), [sorted]);
  const listItems = section === 'doublons' ? dupes : sorted;
  const cardFilters = useCardFilters(listItems, ownedCard, seasons);

  // Raccourcis de la sidebar : ouvrir Mes cartes, éventuellement filtrées sur une rareté.
  function goCards(rarity: Rarity | null) {
    setSection('cartes');
    cardFilters.setRarity(rarity);
  }

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return setLoggedIn(false);
    setLoggedIn(true);

    try {
      const response = await fetch('/api/tcg/me', { cache: 'no-store', headers });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setBoosters(json.boosters);
      if (firstLoad.current) {
        firstLoad.current = false;
        if (json.boosters.length) setSection('boosters');
      }
      setCards(json.cards);
      setTotalCards(json.totalCards);
      setSeasons(json.seasons || []);
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

  const dupCount = cards.filter((item) => item.count > 1).length;
  const SECTION_TITLES: Record<Section, string> = { boosters: 'Mes boosters', cartes: 'Mes cartes', doublons: 'Doublons' };

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={styles.sideTitle}>Ma collection</div>
          <button type="button" className={section === 'boosters' ? styles.sideOn : styles.sideLink} onClick={() => setSection('boosters')}>
            <PackIcon /> Mes boosters <span className={styles.sideCount}>{boosterCount}</span>
          </button>
          <button type="button" className={section === 'cartes' && !cardFilters.filters.rarity ? styles.sideOn : styles.sideLink} onClick={() => goCards(null)}>
            <CardsIcon /> Mes cartes <span className={styles.sideCount}>{ownedCount}</span>
          </button>
          {RARITIES.map((rarity) => (
            <button
              key={rarity}
              type="button"
              className={section === 'cartes' && cardFilters.filters.rarity === rarity ? styles.sideSubOn : styles.sideSub}
              onClick={() => goCards(rarity)}
            >
              {RARITY_PLURALS[rarity]}
            </button>
          ))}
          <button type="button" className={section === 'doublons' ? styles.sideOn : styles.sideLink} onClick={() => setSection('doublons')}>
            <DupIcon /> Doublons <span className={styles.sideCount}>{dupCount}</span>
          </button>
        </aside>

        <div className={styles.main}>
          <div className={ds.sectionLabel}>Collection · Test dev</div>
          <h1 className={styles.title}>{SECTION_TITLES[section]}</h1>
          <p className={styles.sub}>
            {section === 'boosters'
              ? `${boosterCount} booster${boosterCount > 1 ? 's' : ''} à ouvrir`
              : section === 'doublons'
                ? `${dupCount} carte${dupCount > 1 ? 's' : ''} en plusieurs exemplaires`
                : `${ownedCount} carte${ownedCount > 1 ? 's' : ''} différente${ownedCount > 1 ? 's' : ''} sur ${totalCards}`}
          </p>

          {error && <p className={ds.formError}>{error}</p>}

          {section === 'boosters' && (
            <>
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
            </>
          )}

          {section !== 'boosters' && (
            <>
              {!listItems.length && (
                <p className={ds.empty}>
                  {section === 'doublons' ? 'Aucun doublon pour l’instant.' : 'Ouvre un booster pour obtenir tes premières cartes.'}
                </p>
              )}
              {listItems.length > 0 && <CardFilters {...cardFilters} total={listItems.length} />}
              {listItems.length > 0 && !cardFilters.filtered.length && <p className={ds.empty}>Aucune carte avec ces filtres.</p>}
              <div className={styles.grid}>
                {cardFilters.visible.map(({ card, count }) => (
                  <div key={card.id} className={styles.owned}>
                    <PlayerCard card={card} />
                    {count > 1 && <span className={styles.badge}>x{count}</span>}
                  </div>
                ))}
              </div>
              <ShowMore hasMore={cardFilters.hasMore} showMore={cardFilters.showMore} shown={cardFilters.visible.length} total={cardFilters.filtered.length} />
            </>
          )}
        </div>
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
