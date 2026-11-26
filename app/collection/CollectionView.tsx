'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import Loader from '@/app/components/ds/Loader';
import CardZoom from '@/app/components/tcg/CardZoom';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import Switch from '@/app/components/ds/Switch';
import { BOOSTERS_CHANGED } from '@/app/components/beta';
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

// Par numéro de carte croissant (1, 2, 3…) ; sans numéro, des communes aux légendaires.
const byRarity = (a: OwnedCard, b: OwnedCard) =>
  (a.card.number ?? 1e9) - (b.card.number ?? 1e9) || RARITIES.indexOf(a.card.rarity) - RARITIES.indexOf(b.card.rarity);
const ownedCard = (item: OwnedCard) => item.card;

type Section = 'collection' | 'boosters' | 'doublons' | 'classement' | 'echanges' | 'boutique';

// Onglets pas encore prêts : page « en travaux ».
const WIP: Section[] = ['echanges', 'boutique'];

// Clics nécessaires pour ouvrir un sachet selon sa meilleure carte (paliers cumulés).
const TAPS = { commune: 5, epique: 11, legendaire: 18 } as const;

const RARITY_PLURALS: Record<Rarity, string> = { commune: 'Communes', rare: 'Rares', epique: 'Épiques', legendaire: 'Légendaires' };

const PackIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 3h12l-1 3 1 3-1 3 1 3-1 3 1 3H6l1-3-1-3 1-3-1-3 1-3-1-3Z" />
  </svg>
);
const ArrowIcon = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
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
const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M15 5 8 12l7 7" />
  </svg>
);
const SwapIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
);
const ShopIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8" />
  </svg>
);
const DupIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="7" width="10" height="14" rx="2" />
    <rect x="11" y="3" width="10" height="14" rx="2" />
  </svg>
);

type LeaderboardEntry = {
  profileId: string;
  name: string;
  avatar: string | null;
  teamId: number | null;
  division: string | null;
  cards: number;
  boosters: number;
};

// Anneau de complétion (pourcentage de la collection).
function Ring({ value, dark = false }: { value: number; dark?: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg className={styles.ring} viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r={r} fill="none" stroke={dark ? 'rgba(224,216,204,.18)' : 'rgba(8,20,40,.14)'} strokeWidth="5" />
      <circle cx="23" cy="23" r={r} fill="none" stroke="#F05010" strokeWidth="5" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 23 23)" />
      <text x="23" y="27" textAnchor="middle" className={styles.ringText} fill={dark ? '#fff' : '#081428'}>{value}%</text>
    </svg>
  );
}

// Avatar Discord (celui de la dernière connexion), ou initiale du pseudo si on ne l'a pas
// ou si l'image n'existe plus chez Discord (avatar changé depuis).
function Avatar({ entry }: { entry: LeaderboardEntry }) {
  const [broken, setBroken] = useState(false);
  return entry.avatar && !broken ? (
    <img className={styles.avatar} src={`${entry.avatar}?size=64`} alt="" loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span className={styles.avatar}>{entry.name.charAt(0).toUpperCase()}</span>
  );
}

// viewProfileId : collection d'un autre joueur (lecture seule, sans ses boosters). Absent : la mienne.
export default function CollectionView({ viewProfileId }: { viewProfileId?: string }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  // Carte affichée en grand (clic sur une carte).
  const [zoom, setZoom] = useState<{ card: TcgCard; count?: number } | null>(null);
  // Accès aux boosters et aux cartes : connecté avec Discord ET compte Riot lié.
  const [access, setAccess] = useState<'full' | 'riot'>('full');
  // TCG en bêta : page fermée si on n'est pas connecté ou pas bêta-testeur.
  const [gate, setGate] = useState<'login' | 'beta' | null>(null);
  // Première réponse reçue (collection, classement) : avant, on affiche le loader au lieu d'une page vide.
  const [loaded, setLoaded] = useState(false);
  const [boardLoaded, setBoardLoaded] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null); // nom du joueur consulté (null = ma collection)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [boardFilter, setBoardFilter] = useState<'tous' | 'equipe' | 'division'>('tous');
  const [boardSearch, setBoardSearch] = useState('');
  const [boardLimit, setBoardLimit] = useState(30);
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
  const [section, setSection] = useState<Section>('collection');
  // Nombre de boosters ouverts d'un coup (« Tout ouvrir »).
  const [openedCount, setOpenedCount] = useState(1);
  // Booster affiché en grand dans le carrousel de « Mes boosters ».
  const [boosterIndex, setBoosterIndex] = useState(0);
  const swipeX = useRef<number | null>(null);
  const swiped = useRef(false);
  const sorted = useMemo(() => [...cards].sort(byRarity), [cards]);
  const dupes = useMemo(() => sorted.filter((item) => item.count > 1), [sorted]);
  const allSorted = useMemo(() => [...catalog].sort(byRarity), [catalog]);
  // Collection : les cartes possédées ; l'interrupteur ajoute les non possédées (en gris).
  // Sans compte Riot (aucune carte possible), tout le catalogue en gris.
  const [showMissing, setShowMissing] = useState(false);
  const limitedView = access !== 'full' && !viewProfileId;
  const collectionItems = useMemo(
    () => (showMissing || limitedView ? allSorted : allSorted.filter((item) => item.count > 0)),
    [allSorted, showMissing, limitedView]
  );
  const listItems = section === 'doublons' ? dupes : collectionItems;
  const cardFilters = useCardFilters(listItems, ownedCard, seasons);

  function goRarity(target: Section, rarity: Rarity | null) {
    setSection(target);
    cardFilters.setRarity(rarity);
  }

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const { data: { session } } = await supabase.auth.getSession();
    const me = session?.user.id ?? null;
    setMyId(me);
    const viewingOther = Boolean(viewProfileId && viewProfileId !== me);
    setLoggedIn(Boolean(headers));
    if (!headers) return setGate('login');

    try {
      // Sa collection (catalogue seul sans compte Riot), ou celle d'un autre joueur.
      const response = viewingOther
        ? await fetch(`/api/tcg/collection/${viewProfileId}`, { cache: 'no-store', headers })
        : await fetch('/api/tcg/me', { cache: 'no-store', headers });
      const json = await response.json();
      if (json.code === 'BETA_REQUISE') return setGate('beta');
      if (!json.success) throw new Error(json.message);
      if (!viewingOther) {
        const nextAccess = json.linked === false ? 'riot' : 'full';
        setAccess(nextAccess);
        if (nextAccess !== 'full') setSection('collection');
      }
      setOwner(viewingOther ? json.owner?.name ?? 'Joueur' : null);
      setBoosters(json.boosters || []);
      setCards(json.cards);
      setCatalog(json.catalog || []);
      setTotalCards(json.totalCards);
      setTotalsByRarity(json.totalsByRarity || {});
      setSeasons(json.seasons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Classement des collectionneurs (sidebar), rechargé après chaque ouverture.
  const loadLeaderboard = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const json = await fetch('/api/tcg/leaderboard', { cache: 'no-store', headers }).then((res) => res.json()).catch(() => null);
    if (json?.success) setLeaderboard(json.leaderboard);
    setBoardLoaded(true);
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  // En changeant de joueur, on revient sur sa collection.
  useEffect(() => {
    setSection('collection');
  }, [viewProfileId]);

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

  async function open(boosterId: number, count = 1) {
    if (opening !== null) return;
    setOpening(boosterId);
    setError('');

    try {
      const headers = await authHeaders();
      if (!headers) throw new Error('Reconnecte-toi avec Discord.');
      const response = await fetch('/api/tcg/open', { method: 'POST', headers, body: JSON.stringify({ booster_id: boosterId, count }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setRevealed(new Set());
      setOpenedCount(json.opened ?? 1);
      // Les plus rares à la fin, pour garder le suspense.
      const sortedDraw = [...json.cards].sort((a: TcgCard, b: TcgCard) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
      const booster = boosters.find((item) => item.booster.id === boosterId)?.booster;
      setPack({ image: boosterImage(booster ?? { image_url: null }, 500), best: sortedDraw[sortedDraw.length - 1]?.rarity ?? 'commune' });
      setTaps(0);
      setPhase('pack');
      setDrawn(sortedDraw);
      void load();
      void loadLeaderboard();
      window.dispatchEvent(new Event(BOOSTERS_CHANGED)); // pastille du header
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

  if (gate) {
    return (
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Collection · Bêta</div>
        <h1 className={styles.title}>Collection</h1>
        <p className={styles.sub}>
          {gate === 'login'
            ? 'Le jeu de cartes est en bêta. Connecte-toi pour y accéder si tu fais partie des bêta-testeurs.'
            : 'Le jeu de cartes est en bêta : il est réservé pour l’instant aux bêta-testeurs.'}
        </p>
        {gate === 'login' && <Link href="/login" className={ds.btnPrimary}>Se connecter</Link>}
      </div>
    );
  }

  if (loggedIn === null || (loggedIn && !loaded && !gate)) return <Loader label="Chargement de la collection" block />;

  const viewingOther = owner !== null;

  // Pas de compte Riot lié : collection globale et classement seulement.
  const limited = !viewingOther && access !== 'full';

  const dupCount = cards.filter((item) => item.count > 1).length;
  const legendaryOwned = cards.filter((item) => item.card.rarity === 'legendaire').length;
  // Cartes différentes possédées par rareté, affichées sous Collection.
  const ownedByRarity = cards.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.card.rarity]: (acc[item.card.rarity] || 0) + 1 }), {});
  const SECTION_TITLES: Record<Section, string> = viewingOther
    ? { collection: `Collection de ${owner}`, boosters: 'Boosters', doublons: `Doublons de ${owner}`, classement: 'Classement', echanges: 'Échanges', boutique: 'Boutique' }
    : { collection: 'Collection', boosters: 'Mes boosters', doublons: 'Doublons', classement: 'Classement', echanges: 'Échanges', boutique: 'Boutique' };

  const rarityLinks = (target: Section) =>
    RARITIES.map((rarity) => (
      <button
        key={rarity}
        type="button"
        className={section === target && cardFilters.filters.rarity === rarity ? styles.sideSubOn : styles.sideSub}
        onClick={() => goRarity(target, rarity)}
      >
        {RARITY_PLURALS[rarity]}
        <span className={styles.sideSubCount}>{ownedByRarity[rarity] || 0}/{totalsByRarity[rarity] || 0}</span>
      </button>
    ));

  return (
    <div className={styles.full}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={styles.sideInner}>
          <div className={styles.sideTitle}>{viewingOther ? `Collection de ${owner}` : limited ? 'Collection' : 'Ma collection'}</div>
          {viewingOther && loggedIn && (
            <Link href="/collection" className={styles.sideLink}>
              <BackIcon /> Ma collection
            </Link>
          )}
          {!viewingOther && !limited && (
            <button type="button" className={section === 'boosters' ? styles.sideOn : styles.sideLink} onClick={() => setSection('boosters')}>
              <PackIcon /> Mes boosters <span className={styles.sideCount}>{boosterCount}</span>
            </button>
          )}
          <button type="button" className={section === 'collection' && !cardFilters.filters.rarity ? styles.sideOn : styles.sideLink} onClick={() => goRarity('collection', null)}>
            <GridIcon /> Collection <span className={styles.sideCount}>{ownedCount}/{totalCards}</span>
          </button>
          {rarityLinks('collection')}
          {!limited && (
            <button type="button" className={section === 'doublons' ? styles.sideOn : styles.sideLink} onClick={() => setSection('doublons')}>
              <DupIcon /> Doublons
            </button>
          )}

          <button type="button" className={section === 'classement' ? styles.sideOn : styles.sideLink} onClick={() => setSection('classement')}>
            <TrophyIcon /> Classement
          </button>
          <button type="button" className={section === 'echanges' ? styles.sideOn : styles.sideLink} onClick={() => setSection('echanges')}>
            <SwapIcon /> Échanges
          </button>
          <button type="button" className={section === 'boutique' ? styles.sideOn : styles.sideLink} onClick={() => setSection('boutique')}>
            <ShopIcon /> Boutique
          </button>
          </div>
        </aside>

        <div className={styles.main}>
          <div className={ds.sectionLabel}>{section === 'classement' ? 'Collection · Tous les joueurs' : viewingOther ? `Collection de ${owner}` : 'Collection · Bêta'}</div>
          <h1 className={styles.title}>{SECTION_TITLES[section]}</h1>
          {section === 'boosters' || section === 'classement' || WIP.includes(section) || limited ? null : (
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

          {/* Bêta : visuels provisoires en attendant ceux de la graphiste. */}
          <p className={styles.betaNote}>
            <b>Bêta</b> Les cadres, les boosters et les icônes sont des visuels provisoires, en attendant le rendu de la graphiste.
          </p>

          {/* Pas d'accès aux cartes : on explique quoi faire. */}
          {limited && (
            <div className={styles.access}>
              <p>Lie ton compte Riot à ton profil pour recevoir des boosters et collectionner les cartes.</p>
              <Link href="/onboarding" className={ds.btnPrimary}>Lier mon compte Riot</Link>
            </div>
          )}

          {error && <p className={ds.formError}>{error}</p>}

          {section === 'boosters' && (
            <>
              {!boosters.length && <p className={ds.empty}>Aucun booster pour l’instant.</p>}
              {boosters.length > 0 && (() => {
                // Carrousel : le booster courant en grand, les voisins en retrait ; flèches, clavier ou glisser.
                const count = boosters.length;
                const index = ((boosterIndex % count) + count) % count;
                const current = boosters[index];
                const go = (step: number) => setBoosterIndex((i) => (((i + step) % count) + count) % count);
                const neighbor = (step: number) => boosters[(((index + step) % count) + count) % count];
                return (
                  <div
                    className={styles.carousel}
                    tabIndex={0}
                    aria-roledescription="carrousel"
                    aria-label="Mes boosters"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') go(-1);
                      if (e.key === 'ArrowRight') go(1);
                    }}
                    onPointerDown={(e) => { swipeX.current = e.clientX; }}
                    onPointerUp={(e) => {
                      const dx = swipeX.current === null ? 0 : e.clientX - swipeX.current;
                      swipeX.current = null;
                      if (Math.abs(dx) > 50) {
                        swiped.current = true; // un glisser ne doit pas ouvrir le booster
                        go(dx < 0 ? 1 : -1);
                      }
                    }}
                  >
                    <div className={styles.carouselStage}>
                      {count > 1 && (
                        <button type="button" className={`${styles.carouselArrow} ${styles.carouselPrev}`} onClick={() => go(-1)} aria-label="Booster précédent">
                          <ArrowIcon dir="left" />
                        </button>
                      )}
                      {count > 2 && <img className={`${styles.carouselSide} ${styles.carouselLeft}`} src={boosterImage(neighbor(-1).booster, 300)} alt="" />}
                      <button
                        key={current.booster.id}
                        type="button"
                        className={`${styles.booster} ${styles.carouselMain}`}
                        disabled={opening !== null}
                        onClick={() => {
                          if (swiped.current) {
                            swiped.current = false;
                            return;
                          }
                          if (current.booster.id) open(current.booster.id);
                        }}
                        aria-label={`Ouvrir un booster ${current.booster.name}`}
                      >
                        <div className={styles.boosterPack}>
                          <img src={boosterImage(current.booster, 600)} alt="" />
                          <span className={styles.badge}>x{current.quantity}</span>
                        </div>
                        {/* Infos au survol, dans une bulle à droite du booster. */}
                        <span className={styles.boosterTip} role="tooltip">
                          <strong className={styles.tipMain}><b>{current.quantity}</b> à ouvrir</strong>
                          <span>{current.booster.cards_per_pack} cartes par booster</span>
                          <em>Clique pour l’ouvrir</em>
                        </span>
                      </button>
                      {count > 1 && <img className={`${styles.carouselSide} ${styles.carouselRight}`} src={boosterImage(neighbor(1).booster, 300)} alt="" />}
                      {count > 1 && (
                        <button type="button" className={`${styles.carouselArrow} ${styles.carouselNext}`} onClick={() => go(1)} aria-label="Booster suivant">
                          <ArrowIcon dir="right" />
                        </button>
                      )}
                    </div>
                    <div className={styles.carouselInfo}>
                      <div className={styles.carouselName}>{opening === current.booster.id ? 'Ouverture…' : current.booster.name}</div>
                      {current.quantity > 1 && (
                        <button
                          type="button"
                          className={ds.btnPrimary}
                          disabled={opening !== null}
                          onClick={() => current.booster.id && open(current.booster.id, Math.min(current.quantity, 50))}
                        >
                          Tout ouvrir ({Math.min(current.quantity, 50)})
                        </button>
                      )}
                      {count > 1 && (
                        <div className={styles.carouselDots}>
                          {boosters.map((item, i) => (
                            <button
                              key={item.booster.id}
                              type="button"
                              className={i === index ? styles.dotOn : styles.dot}
                              onClick={() => setBoosterIndex(i)}
                              aria-label={`${item.booster.name} (${i + 1} sur ${count})`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {section === 'classement' && !boardLoaded && <Loader label="Chargement du classement" block />}
          {section === 'classement' && boardLoaded && (() => {
            const pct = (n: number) => (totalCards ? Math.round((n / totalCards) * 100) : 0);
            const mine = leaderboard.find((entry) => entry.profileId === myId);
            const myRank = mine ? leaderboard.indexOf(mine) + 1 : 0;
            const query = boardSearch.trim().toLowerCase();
            const rows = leaderboard
              .map((entry, index) => ({ entry, rank: index + 1 }))
              .filter(({ entry }) => boardFilter !== 'equipe' || (mine?.teamId != null && entry.teamId === mine.teamId))
              .filter(({ entry }) => boardFilter !== 'division' || (mine?.division != null && entry.division === mine.division))
              .filter(({ entry }) => !query || entry.name.toLowerCase().includes(query));

            return (
              <>
                <div className={styles.boardTools}>
                  <div className={ds.tabs}>
                    {([['tous', 'Tous'], ['equipe', 'Mon équipe'], ['division', 'Ma division']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={boardFilter === key ? ds.tabActive : ds.tab}
                        disabled={key !== 'tous' && !(key === 'equipe' ? mine?.teamId : mine?.division)}
                        onClick={() => { setBoardFilter(key); setBoardLimit(30); }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    className={`${ds.input} ${styles.boardSearch}`}
                    value={boardSearch}
                    onChange={(e) => { setBoardSearch(e.target.value); setBoardLimit(30); }}
                    placeholder="Chercher un joueur"
                  />
                </div>

                {/* Ta place, épinglée en haut pendant qu'on descend. */}
                {mine && (
                  <div className={styles.boardPin}>
                    <b>{myRank}e</b>
                    <Ring value={pct(mine.cards)} dark />
                    <span>Ta place · {mine.cards} / {totalCards} cartes · {mine.boosters} boosters</span>
                  </div>
                )}

                {!rows.length && <p className={ds.empty}>{leaderboard.length ? 'Aucun joueur trouvé.' : 'Personne n’a encore de cartes.'}</p>}
                {rows.length > 0 && (
                  <div className={styles.boardList}>
                    {rows.slice(0, boardLimit).map(({ entry, rank }) => {
                      const current = entry.profileId === (viewProfileId ?? myId);
                      return (
                        <Link
                          key={entry.profileId}
                          href={entry.profileId === myId ? '/collection' : `/collection?profil=${entry.profileId}`}
                          className={current ? styles.boardRowOn : styles.boardRow}
                        >
                          <span className={styles.boardRank}>{rank}</span>
                          <Avatar entry={entry} />
                          <Ring value={pct(entry.cards)} dark={current} />
                          <span className={styles.boardMain}>
                            <span className={styles.boardName}>{entry.name}{entry.profileId === myId ? ' (toi)' : ''}</span>
                            <span className={styles.boardBar}><i style={{ width: `${pct(entry.cards)}%` }} /></span>
                          </span>
                          <span className={styles.boardNums}>
                            {entry.cards} / {totalCards}
                            <small>{entry.boosters} boosters</small>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {rows.length > boardLimit && (
                  <div className={styles.boardMore}>
                    <button type="button" className={ds.btnOutline} onClick={() => setBoardLimit((n) => n + 30)}>Voir plus</button>
                  </div>
                )}
              </>
            );
          })()}

          {WIP.includes(section) && (
            <div className={styles.wip}>
              <span className={styles.wipBadge}>En travaux</span>
              <p>
                {section === 'echanges'
                  ? 'Bientôt : échange tes doublons avec les autres joueurs.'
                  : 'Bientôt : de nouveaux boosters et des récompenses à débloquer.'}
              </p>
            </div>
          )}

          {section !== 'boosters' && section !== 'classement' && !WIP.includes(section) && (
            <>
              {!listItems.length && (
                <p className={ds.empty}>
                  {section === 'doublons' ? 'Aucun doublon pour l’instant.' : !catalog.length ? 'Aucune carte n’existe encore.' : viewingOther ? 'Aucune carte pour l’instant.' : 'Ouvre un booster pour obtenir tes premières cartes.'}
                </p>
              )}
              {section === 'collection' && catalog.length > 0 && !limited && (
                <div className={styles.switchRow}>
                  <Switch label="Voir les non possédées" checked={showMissing} onChange={setShowMissing} />
                </div>
              )}
              {listItems.length > 0 && <CardFilters {...cardFilters} total={listItems.length} hideRarity alwaysSeasons hideCount />}
              {listItems.length > 0 && !cardFilters.filtered.length && <p className={ds.empty}>Aucune carte avec ces filtres.</p>}
              <div className={styles.grid}>
                {cardFilters.visible.map(({ card, count }) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`${styles.owned} ${count === 0 ? styles.missing : ''}`}
                    onClick={() => setZoom({ card, count })}
                    aria-label={`Voir ${card.name} en grand`}
                  >
                    {/* Effet électrique de la rareté, seulement sur les cartes possédées. */}
                    {count > 0 && <CardElectric rarity={card.rarity} />}
                    <PlayerCard card={card} />
                    {count > 1 && <span className={styles.badge}>x{count}</span>}
                  </button>
                ))}
              </div>
              <ShowMore hasMore={cardFilters.hasMore} showMore={cardFilters.showMore} shown={cardFilters.visible.length} total={cardFilters.filtered.length} />
            </>
          )}
        </div>
      </div>

      {zoom && <CardZoom card={zoom.card} count={zoom.count} onClose={() => setZoom(null)} />}

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
              <div className={styles.overlayTitle}>{openedCount > 1 ? `${openedCount} boosters ouverts` : 'Booster ouvert'}</div>
              <button type="button" className={styles.mute} onClick={toggleMute} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
                {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                {muted ? 'Son coupé' : 'Son'}
              </button>
            </div>
            {/* Barre collée en haut : on garde les actions sous la main en descendant dans beaucoup de cartes. */}
            <div className={styles.overlayBar}>
              <p className={styles.overlayHint}>
                {revealed.size < drawn.length ? `Clique sur une carte pour la retourner · ${drawn.length - revealed.size} restante${drawn.length - revealed.size > 1 ? 's' : ''}` : `Toutes tes cartes sont révélées · ${drawn.length} carte${drawn.length > 1 ? 's' : ''}.`}
              </p>
              {revealed.size < drawn.length ? (
                <button type="button" className={ds.btnOutline} onClick={revealAll}>Tout révéler</button>
              ) : (
                <button type="button" className={ds.btnPrimary} onClick={() => { setDrawn(null); setPack(null); }}>Ajouter à ma collection</button>
              )}
            </div>
            <div className={`${styles.drawn} ${drawn.length > 8 ? styles.drawnMany : ''} ${drawn.length > 30 ? styles.drawnLots : ''}`}>
              {drawn.map((card, index) => {
                const isRevealed = revealed.has(index);
                return (
                  <button
                    key={`${card.id}-${index}`}
                    type="button"
                    className={`${styles.flip} ${isRevealed ? `${styles.flipped} ${styles[`reveal_${card.rarity}`] ?? ''}` : ''}`}
                    onClick={() => (isRevealed ? setZoom({ card }) : reveal(index))}
                    aria-label={isRevealed ? `Voir ${card.name} en grand` : 'Retourner la carte'}
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
          </div>
        </div>
      )}
    </div>
  );
}
