'use client';

// Socle commun des pages Résultats et Stats : données par division, onglets, blocs.

import { useEffect, useState } from 'react';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import CloseIcon from '@/app/components/icons/CloseIcon';
import styles from './results.module.css';
import { formatLastUpdate } from '@/app/components/ds/lol';
import { getMyDivision, peekMyDivision } from '@/app/components/ds/myDivision';
import { logoSrc } from '@/lib/logo';

/* =========================================================
   TYPES (réponse de /api/resultats)
========================================================= */


export type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';

export type Team = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  wins: number;
  losses: number;
  rank?: number;
};

export type MatchSide = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  score: number;
};

export type HistoryMatch = {
  id: number;
  stage: 'pool' | 'playoff' | 'tiebreak';
  bracket: 'winner' | 'loser' | 'grand_final' | null;
  bestOf: number;
  playedAt: string;
  mvpRiotId: string | null;
  // null quand l'équipe n'est plus validée par un admin.
  team1: MatchSide | null;
  team2: MatchSide | null;
  winner: { id: number } | null;
};

export type GamePlayer = {
  playerId: number | null;
  riotId: string;
  isSub?: boolean;
  teamId: number;
  role: string | null;
  championName: string;
  championImage: string | null;
  kills: number;
  deaths: number;
  assists: number;
};

export type Game = {
  id: number;
  gameNumber: number;
  durationSeconds: number;
  winnerTeamId: number;
  winnerName: string | null;
  players: GamePlayer[];
};

export type PlayerStats = {
  playerId: number;
  role: Role;
  riotId: string;
  teamShortName: string;
  teamLogo: string | null;
  kda: number;
  goldPerMin: number;
  dpm: number;
  csPerMin: number;
  visionScore: number;
  mvp: number;
  // Au moins 45 % des games de son équipe : sinon absent des classements de stats.
  qualified: boolean;
};

export type ChampionStat = {
  championId: string;
  name: string;
  image: string | null;
  picks: number;
  pickRate: number;
  winRate: number;
  players: ChampionPlayer[];
};

export type ChampionPlayer = {
  playerId: number;
  riotId: string;
  teamShortName: string | null;
  teamLogo: string | null;
  games: number;
  winRate: number;
  kda: number;
};

// Réponse de /api/resultats selon ?view= : chaque page ne charge que ce qu'elle affiche.
export type ResultsData = {
  teams: Team[];
  lastUpdate: string | null;
  history: HistoryMatch[];
};

export type StatsData = {
  lastUpdate: string | null;
  playerStats: Record<Role, PlayerStats[]>;
  champions: Record<Role, ChampionStat[]>;
};

type ViewData = { resultats: ResultsData; stats: StatsData };

export type DivisionView = keyof ViewData;

export type StatKey = 'kda' | 'goldPerMin' | 'dpm' | 'csPerMin' | 'visionScore';

/* =========================================================
   CHARGEMENT
========================================================= */

async function getJson(url: string) {
  // Pas de cache: 'no-store' : l'en-tête no-cache envoyé ferait sauter le cache serveur.
  // La réponse est déjà marquée no-store et la page gère ses propres 60 s.
  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Impossible de charger les résultats.');
  }

  return json;
}

// Réponses gardées 60 s : passer de Résultats à Stats (ou revenir) ne refait pas d'appel.
// Le serveur garde lui aussi les données en cache et les vide à chaque publication.
const CLIENT_TTL_MS = 60_000;

type Entry<T> = { promise: Promise<T>; at: number };

const divisionRequests = new Map<string, Entry<any>>();
const gameRequests = new Map<number, Entry<Game[]>>();

// Une seule requête par clé, partagée entre chargement et préchargement.
function remember<K, T>(store: Map<K, Entry<T>>, key: K, load: () => Promise<T>): Promise<T> {
  const entry = store.get(key);

  if (entry && Date.now() - entry.at < CLIENT_TTL_MS) return entry.promise;

  const promise = load().catch((error) => {
    store.delete(key);
    throw error;
  });

  store.set(key, { promise, at: Date.now() });

  return promise;
}

function loadDivision<V extends DivisionView>(division: DivisionName, view: V): Promise<ViewData[V]> {
  return remember(divisionRequests, `${view}:${division}`, () =>
    getJson(`/api/resultats?division=${division}&view=${view}`)
  );
}

export function loadGames(matchId: number): Promise<Game[]> {
  return remember(gameRequests, matchId, () =>
    getJson(`/api/historique/${matchId}`).then((json) => json.match.games as Game[])
  );
}

// Dernière division vue : gardée en passant de Résultats à Stats (et inversement).
let lastDivision: DivisionName | null = null;

function readDivisionFromUrl(): DivisionName | null {
  const value = new URLSearchParams(window.location.search).get('division');
  const match = DIVISIONS.find((division) => division.toLowerCase() === value?.toLowerCase());

  return match ?? lastDivision;
}

// Division choisie (synchronisée avec ?division=) et ses données, avec préchargement des autres.
export function useDivisionData<V extends DivisionView>(view: V) {
  // null tant que l'URL n'est pas lue : évite de charger Yordle pour rien.
  const [selected, setSelected] = useState<DivisionName | null>(null);
  const [cache, setCache] = useState<Partial<Record<DivisionName, ViewData[V]>>>({});
  const [error, setError] = useState('');

  // Priorité : URL, puis dernière division vue, puis celle de l'équipe du joueur connecté
  // (gardée dans le navigateur dès l'arrivée sur le site, cf. myDivision).
  useEffect(() => {
    const initial = readDivisionFromUrl();
    if (initial) {
      setSelected(initial);
      return;
    }

    const known = peekMyDivision();
    if (known !== undefined) {
      setSelected(known ?? 'Yordle');
      return;
    }

    // Jamais calculée sur cet appareil : on charge les 3 divisions pendant le calcul.
    for (const division of DIVISIONS) loadDivision(division, view).catch(() => {});

    let active = true;
    getMyDivision().then((mine) => {
      if (active) setSelected((current) => current ?? mine ?? 'Yordle');
    });

    return () => {
      active = false;
    };
  }, [view]);

  // Lien partageable : ?division=Ixtal.
  useEffect(() => {
    if (!selected) return;

    lastDivision = selected;
    const url = new URL(window.location.href);
    url.searchParams.set('division', selected);
    window.history.replaceState(null, '', url.toString());
  }, [selected]);

  useEffect(() => {
    if (!selected || cache[selected]) return;

    let active = true;
    setError('');

    loadDivision(selected, view)
      .then((data) => {
        if (!active) return;

        setCache((previous) => ({ ...previous, [selected]: data }));

        // Précharge les autres divisions pour un changement d'onglet instantané.
        for (const other of DIVISIONS) {
          if (other === selected) continue;

          loadDivision(other, view)
            .then((otherData) => setCache((previous) => ({ ...previous, [other]: otherData })))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Erreur de chargement.');
      });

    return () => {
      active = false;
    };
  }, [selected, cache, view]);

  const division = selected ?? 'Yordle';
  const data = selected ? cache[selected] ?? null : null;

  return { division, setDivision: setSelected, data, error, loading: !data && !error };
}

export function DivisionTabs({
  division,
  onChange,
}: {
  division: DivisionName;
  onChange: (division: DivisionName) => void;
}) {
  return (
    <div className={`${ds.tabs} ${ds.filterRowLast}`}>
      {DIVISIONS.map((item) => (
        <button
          key={item}
          type="button"
          className={division === item ? ds.tabActive : ds.tab}
          onClick={() => onChange(item)}
        >
          <span className={ds.dot} style={{ background: DIVISION_COLORS[item] }} />
          {item}
        </button>
      ))}
    </div>
  );
}

// Date du dernier résultat de la division (sous les onglets).
export function LastUpdate({ date }: { date: string | null }) {
  const label = formatLastUpdate(date);

  return (
    <p className={styles.lastUpdate}>
      {label ? `Résultats mis à jour le ${label}` : 'Aucun résultat pour le moment'}
    </p>
  );
}

/* =========================================================
   ICONES
========================================================= */

export function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2.2" fill="none" />
    </svg>
  );
}

/* =========================================================
   BLOCS COMMUNS
========================================================= */

export function BlockHead({ label, title, aside }: { label: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className={styles.blockHead}>
      <div>
        <div className={ds.sectionLabel}>{label}</div>
        <h2 className={styles.blockTitle}>{title}</h2>
      </div>
      {aside && <span className={styles.blockAside}>{aside}</span>}
    </div>
  );
}

export function TeamLogo({ logo, size = 'md' }: { logo: string | null; size?: 'xs' | 'sm' | 'md' }) {
  const className = size === 'xs' ? styles.logoXs : size === 'sm' ? styles.logoSm : styles.logo;

  return logo ? (
    <img src={logoSrc(logo)} alt="" className={className} loading="lazy" />
  ) : (
    <span className={`${className} ${styles.logoEmpty}`} />
  );
}

/* =========================================================
   POP-UP CHAMPIONS (Stats et Mon équipe)
========================================================= */

export type ChampionRow = {
  key: string | number;
  image: string | null;
  name: string;
  sub?: string | null;
  games: number;
  winRate: number;
  kda: number;
};

// Pop-up sombre : en-tête (image, titre, infos) puis tableau games, winrate, KDA.
// Échap ou un clic à côté la ferme ; la page derrière ne défile plus.
export function ChampionRowsModal({
  title,
  image,
  meta,
  label,
  rows,
  rowImage = 'logo',
  onClose,
}: {
  title: string;
  image: string | null;
  meta: string;
  label: string;
  rows: ChampionRow[];
  // logo : logo d'équipe (joueurs d'un champion) ; champion : portrait du champion.
  rowImage?: 'logo' | 'champion';
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.championModal} ${ds.onDark}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>

        <div className={styles.championModalHead}>
          {image ? <img src={image} alt="" /> : <span className={styles.championEmpty} />}
          <div>
            <strong>{title}</strong>
            <small>{meta}</small>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className={ds.empty}>Aucune donnée</div>
        ) : (
          <div>
            <div className={`${styles.championPlayerRow} ${styles.championPlayerHead}`}>
              <span />
              <span />
              <span>{label}</span>
              <span>Games</span>
              <span>Win</span>
              <span>KDA</span>
            </div>

            {rows.map((row, index) => (
              <div key={row.key} className={styles.championPlayerRow}>
                <span className={styles.rankNumber}>{index + 1}</span>
                {rowImage === 'logo' ? (
                  <TeamLogo logo={row.image} size="sm" />
                ) : row.image ? (
                  <img src={row.image} alt="" loading="lazy" className={styles.modalChampion} />
                ) : (
                  <span className={`${styles.modalChampion} ${styles.championEmpty}`} />
                )}
                <span className={styles.playerName}>
                  {row.name}
                  {row.sub && <small>{row.sub}</small>}
                </span>
                <strong className={styles.rankValue}>{row.games}</strong>
                <strong className={`${styles.rankValue} ${row.winRate >= 50 ? ds.win : ds.loss}`}>
                  {Math.round(row.winRate)}%
                </strong>
                <strong className={styles.rankValue}>{row.kda.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
