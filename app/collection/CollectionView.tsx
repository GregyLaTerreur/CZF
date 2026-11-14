'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import CardElectric from '@/app/components/tcg/CardElectric';
import { branching, rand } from '@/app/components/tcg/lightning';
import CardFilters, { ShowMore, useCardFilters } from '@/app/components/tcg/CardFilters';
import { RARITIES, type Rarity, type TcgCard } from '@/lib/tcg/cards';
import { boosterImage, type TcgBooster } from '@/lib/tcg/boosters';
import { isMuted, playCharge, playOpen, playReveal, playTap, setMuted } from './sounds';
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

// Clics nécessaires pour ouvrir un sachet selon sa meilleure carte (paliers cumulés).
const TAPS = { commune: 5, epique: 11, legendaire: 18 } as const;

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
const SoundOnIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4Z" />
    <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
  </svg>
);
const SoundOffIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4Z" />
    <path d="m17 9 5 6M22 9l-5 6" />
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
  // Avant les cartes : le sachet à déchirer, qui annonce sa meilleure carte (halo épique / légendaire).
  const [pack, setPack] = useState<{ image: string; best: Rarity } | null>(null);
  const [phase, setPhase] = useState<'pack' | 'tearing' | 'cards'>('cards');
  const [taps, setTaps] = useState(0);
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

  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);

  function toggleMute() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  // Tout révéler : un seul son, celui de la meilleure carte encore cachée.
  function revealAll() {
    if (!drawn) return;
    const hidden = drawn.filter((_, i) => !revealed.has(i));
    const best = hidden.reduce<Rarity | null>((top, card) => (!top || RARITIES.indexOf(card.rarity) > RARITIES.indexOf(top) ? card.rarity : top), null);
    if (best) playReveal(best);
    setRevealed(new Set(drawn.map((_, i) => i)));
  }

  function reveal(index: number) {
    if (!drawn || revealed.has(index)) return;
    playReveal(drawn[index].rarity);
    setRevealed((current) => new Set(current).add(index));
  }

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
      const sortedDraw = [...json.cards].sort((a: TcgCard, b: TcgCard) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
      const booster = boosters.find((item) => item.booster.id === boosterId)?.booster;
      setPack({ image: boosterImage(booster ?? { image_url: null }, 500), best: sortedDraw[sortedDraw.length - 1]?.rarity ?? 'commune' });
      setTaps(0);
      setPhase('pack');
      setDrawn(sortedDraw);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setOpening(null);
    }
  }

  // Ouvrir le sachet en cliquant vite : il résiste plus longtemps s'il cache une épique, encore plus une légendaire.
  // Il ne trahit son contenu qu'en cours de route (passe en orange, puis en or).
  const packStage: Rarity = !pack
    ? 'commune'
    : pack.best === 'legendaire' && taps >= TAPS.epique
      ? 'legendaire'
      : (pack.best === 'legendaire' || pack.best === 'epique') && taps >= TAPS.commune
        ? 'epique'
        : 'commune';
  const tapsNeeded = pack ? TAPS[pack.best === 'legendaire' ? 'legendaire' : pack.best === 'epique' ? 'epique' : 'commune'] : 1;

  // Avancée dans le palier en cours (0 à 1) : fait grossir le sachet et monter son halo.
  const bounds = [0, TAPS.commune, TAPS.epique, TAPS.legendaire].filter((b) => b <= tapsNeeded);
  const segStart = [...bounds].reverse().find((b) => b <= taps && b < tapsNeeded) ?? 0;
  const segEnd = bounds.find((b) => b > segStart) ?? tapsNeeded;
  const meter = Math.min(1, (taps - segStart) / Math.max(1, segEnd - segStart));

  const packFx = useRef<SVGGElement>(null);

  // Éclair ramifié qui part de l'endroit cliqué, plus dense à mesure qu'on avance (repère du sachet : 200 x 300).
  function strike(event: MouseEvent<HTMLButtonElement>, next: number) {
    const g = packFx.current;
    if (!g) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX > 0 || event.clientY > 0; // clic clavier : centre du sachet
    const x = inside ? ((event.clientX - box.left) / box.width) * 200 : 100;
    const y = inside ? ((event.clientY - box.top) / box.height) * 300 : 150;
    const level = Math.min(1, next / TAPS.legendaire);
    const paths: string[] = [];
    for (let k = 0; k < 2 + Math.round(level * 2); k++) branching(x, y, rand(0, Math.PI * 2), rand(28, 45), 2 + Math.round(level * 2), paths);
    g.innerHTML = paths.map((d) => `<path d="${d}"/>`).join('');
  }

  function tapPack(event: MouseEvent<HTMLButtonElement>) {
    if (phase !== 'pack' || !pack) return;
    const next = taps + 1;
    setTaps(next);
    strike(event, next);

    if (next >= tapsNeeded) {
      playOpen();
      setPhase('tearing');
      window.setTimeout(() => setPhase('cards'), pack.best === 'legendaire' ? 1200 : pack.best === 'epique' ? 900 : 650);
      return;
    }

    // Paliers : le sachet change de couleur quand il « résiste ».
    if (next === TAPS.commune && (pack.best === 'epique' || pack.best === 'legendaire')) playCharge('epique');
    else if (next === TAPS.epique && pack.best === 'legendaire') playCharge('legendaire');
    else playTap(next / tapsNeeded);
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
          {section === 'boosters' ? null : (
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
                  // Clic direct sur le sachet pour l'ouvrir.
                  <button
                    key={booster.id}
                    type="button"
                    className={styles.booster}
                    disabled={opening !== null}
                    onClick={() => booster.id && open(booster.id)}
                    aria-label={`Ouvrir un booster ${booster.name}`}
                  >
                    <div className={styles.boosterPack}>
                      <img src={boosterImage(booster, 400)} alt="" />
                      <span className={styles.badge}>x{quantity}</span>
                    </div>
                    <div className={styles.boosterName}>{opening === booster.id ? 'Ouverture…' : booster.name}</div>
                  </button>
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
                    {/* Effet électrique de la rareté, seulement sur les cartes possédées. */}
                    {count > 0 && <CardElectric rarity={card.rarity} />}
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

      {drawn && pack && phase !== 'cards' && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.packStage}>
            <p className={styles.packHint}>
              {packStage === 'legendaire' ? 'Encore ! Quelque chose de légendaire…' : packStage === 'epique' ? 'Ça résiste… continue !' : 'Clique vite pour l’ouvrir !'}
            </p>
            <button
              type="button"
              className={`${styles.pack} ${styles[`stage_${packStage}`]} ${phase === 'tearing' ? styles.tearing : ''}`}
              style={{ ['--p' as string]: meter }}
              onClick={tapPack}
              aria-label="Cliquer pour ouvrir le booster"
            >
              {/* Clé = nombre de clics : relance la secousse à chaque clic. */}
              <span key={taps} className={taps ? styles.packHit : undefined}>
                <img src={pack.image} alt="" />
              </span>
              {/* Éclairs du clic : blancs, puis orange (palier épique), puis or (palier légendaire). */}
              <svg className={styles.packBolts} viewBox="-24 -36 248 372" aria-hidden="true">
                <g ref={packFx} />
              </svg>
            </button>
          </div>
          {phase === 'tearing' && <span className={`${styles.flash} ${styles[`flash_${pack.best}`]}`} aria-hidden="true" />}
        </div>
      )}

      {drawn && phase === 'cards' && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.overlayInner}>
            <div className={styles.overlayHead}>
              <div className={styles.overlayTitle}>Booster ouvert</div>
              <button type="button" className={styles.mute} onClick={toggleMute} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
                {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                {muted ? 'Son coupé' : 'Son'}
              </button>
            </div>
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
                    className={`${styles.flip} ${isRevealed ? `${styles.flipped} ${styles[`reveal_${card.rarity}`] ?? ''}` : ''}`}
                    onClick={() => !isRevealed && reveal(index)}
                    aria-label={isRevealed ? card.name : 'Retourner la carte'}
                  >
                    <div className={styles.flipBack}>
                      <img src={boosterImage({ image_url: null }, 300)} alt="" />
                    </div>
                    <div className={styles.flipFront}>
                      <PlayerCard card={card} />
                    </div>
                    {/* Effet électrique selon la rareté : annonce la carte sur le dos, l'accompagne une fois révélée. */}
                    <CardElectric rarity={card.rarity} />
                  </button>
                );
              })}
            </div>
            <div className={ds.formActions}>
              {revealed.size < drawn.length ? (
                <button type="button" className={ds.btnOutline} onClick={revealAll}>Tout révéler</button>
              ) : (
                <button type="button" className={ds.btnPrimary} onClick={() => { setDrawn(null); setPack(null); }}>Ajouter à ma collection</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
