'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

// Des plus rares aux plus communes, puis dans l'ordre de numérotation de la saison.
const byRarity = (a: OwnedCard, b: OwnedCard) =>
  RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity) || (a.card.number ?? 1e9) - (b.card.number ?? 1e9);
const ownedCard = (item: OwnedCard) => item.card;

type Section = 'collection' | 'boosters' | 'cartes' | 'doublons';

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
const GridIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="9" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
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
  const [catalog, setCatalog] = useState<OwnedCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [totalsByRarity, setTotalsByRarity] = useState<Record<string, number>>({});
  const [seasons, setSeasons] = useState<{ id: number; name: string }[]>([]);
  const [opening, setOpening] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<TcgCard[] | null>(null);
  // Index des cartes tirées déjà retournées (c'est le joueur qui clique).
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('cartes');
  const sorted = useMemo(() => [...cards].sort(byRarity), [cards]);
  const dupes = useMemo(() => sorted.filter((item) => item.count > 1), [sorted]);
  const allSorted = useMemo(() => [...catalog].sort(byRarity), [catalog]);
  const listItems = section === 'collection' ? allSorted : section === 'doublons' ? dupes : sorted;
  const cardFilters = useCardFilters(listItems, ownedCard, seasons);

  // Raretés de la sidebar : filtrent la Collection ou Mes cartes (la vue ouverte), sinon ouvrent la Collection.
  const rarityTarget: Section = section === 'cartes' ? 'cartes' : 'collection';
  function goRarity(target: Section, rarity: Rarity | null) {
    setSection(target);
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
      setCards(json.cards);
      setCatalog(json.catalog || []);
      setTotalCards(json.totalCards);
      setTotalsByRarity(json.totalsByRarity || {});
      setSeasons(json.seasons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reveal = (index: number) => setRevealed((current) => new Set(current).add(index));

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
      setRevealed(new Set());
      // Les plus rares à la fin, pour garder le suspense.
      setDrawn([...json.cards].sort((a: TcgCard, b: TcgCard) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)));
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
  const legendaryOwned = cards.filter((item) => item.card.rarity === 'legendaire').length;
  // Cartes différentes possédées par rareté, affichées sous Mes cartes.
  const ownedByRarity = cards.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.card.rarity]: (acc[item.card.rarity] || 0) + 1 }), {});
  const SECTION_TITLES: Record<Section, string> = { collection: 'Collection', boosters: 'Mes boosters', cartes: 'Mes cartes', doublons: 'Doublons' };

  const rarityLinks = (target: Section) =>
    rarityTarget === target &&
    RARITIES.map((rarity) => (
      <button
        key={rarity}
        type="button"
        className={section === target && cardFilters.filters.rarity === rarity ? styles.sideSubOn : styles.sideSub}
        onClick={() => goRarity(target, rarity)}
      >
        {RARITY_PLURALS[rarity]}
        {target === 'cartes' && <span className={styles.sideSubCount}>{ownedByRarity[rarity] || 0}</span>}
      </button>
    ));

  return (
    <div className={styles.full}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={styles.sideInner}>
          <div className={styles.sideTitle}>Ma collection</div>
          <button type="button" className={section === 'boosters' ? styles.sideOn : styles.sideLink} onClick={() => setSection('boosters')}>
            <PackIcon /> Mes boosters <span className={styles.sideCount}>{boosterCount}</span>
          </button>
          <button type="button" className={section === 'cartes' && !cardFilters.filters.rarity ? styles.sideOn : styles.sideLink} onClick={() => goRarity('cartes', null)}>
            <CardsIcon /> Mes cartes
          </button>
          {rarityLinks('cartes')}
          <button type="button" className={section === 'collection' && !cardFilters.filters.rarity ? styles.sideOn : styles.sideLink} onClick={() => goRarity('collection', null)}>
            <GridIcon /> Collection <span className={styles.sideCount}>{ownedCount}/{totalCards}</span>
          </button>
          {rarityLinks('collection')}
          <button type="button" className={section === 'doublons' ? styles.sideOn : styles.sideLink} onClick={() => setSection('doublons')}>
            <DupIcon /> Doublons
          </button>
          </div>
        </aside>

        <div className={styles.main}>
          <div className={ds.sectionLabel}>Collection · Test dev</div>
          <h1 className={styles.title}>{SECTION_TITLES[section]}</h1>
          {section === 'boosters' ? (
            <p className={styles.sub}>{boosterCount} booster{boosterCount > 1 ? 's' : ''} à ouvrir</p>
          ) : (
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <small>Cartes</small>
                <b>{ownedCount}<span> / {totalCards}</span></b>
              </div>
              <div className={styles.tile}>
                <small>Complété</small>
                <b>{totalCards ? Math.round((ownedCount / totalCards) * 100) : 0}<span> %</span></b>
              </div>
              <div className={styles.tileCream}>
                <small>Doublons</small>
                <b>{dupCount}</b>
              </div>
              <div className={styles.tileCream}>
                <small>Légendaires</small>
                <b>{legendaryOwned}<span> / {totalsByRarity.legendaire || 0}</span></b>
              </div>
            </div>
          )}

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
                  {section === 'doublons' ? 'Aucun doublon pour l’instant.' : section === 'collection' ? 'Aucune carte n’existe encore.' : 'Ouvre un booster pour obtenir tes premières cartes.'}
                </p>
              )}
              {listItems.length > 0 && <CardFilters {...cardFilters} total={listItems.length} hideRarity alwaysSeasons />}
              {listItems.length > 0 && !cardFilters.filtered.length && <p className={ds.empty}>Aucune carte avec ces filtres.</p>}
              <div className={styles.grid}>
                {cardFilters.visible.map(({ card, count }) => (
                  <div key={card.id} className={`${styles.owned} ${count === 0 ? styles.missing : ''}`}>
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
            <p className={styles.overlayHint}>
              {revealed.size < drawn.length ? `Clique sur une carte pour la retourner · ${drawn.length - revealed.size} restante${drawn.length - revealed.size > 1 ? 's' : ''}` : 'Toutes tes cartes sont révélées.'}
            </p>
            <div className={`${styles.drawn} ${drawn.length > 8 ? styles.drawnMany : ''}`}>
              {drawn.map((card, index) => {
                const isRevealed = revealed.has(index);
                return (
                  <button
                    key={`${card.id}-${index}`}
                    type="button"
                    className={`${styles.flip} ${isRevealed ? `${styles.flipped} ${styles[`reveal_${card.rarity}`]}` : styles[`back_${card.rarity}`]}`}
                    onClick={() => !isRevealed && reveal(index)}
                    aria-label={isRevealed ? card.name : 'Retourner la carte'}
                  >
                    <div className={styles.flipBack}>
                      <img src={boosterImage({ image_url: null }, 300)} alt="" />
                    </div>
                    <div className={styles.flipFront}>
                      <PlayerCard card={card} />
                    </div>
                    {/* Effet de révélation selon la rareté (joué une fois, au retournement). */}
                    {isRevealed && card.rarity !== 'commune' && (
                      <>
                        <span className={styles.burst} aria-hidden="true" />
                        <span className={styles.ring} aria-hidden="true" />
                        {card.rarity === 'legendaire' && <span className={styles.rays} aria-hidden="true" />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={ds.formActions}>
              {revealed.size < drawn.length ? (
                <button type="button" className={ds.btnOutline} onClick={() => setRevealed(new Set(drawn.map((_, i) => i)))}>Tout révéler</button>
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
