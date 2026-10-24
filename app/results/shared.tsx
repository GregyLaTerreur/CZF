'use client';

// Socle commun des pages Résultats et Stats : données par division, onglets, blocs.

import { useEffect, useState } from 'react';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import styles from './results.module.css';

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
  stage: 'pool' | 'playoff';
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
};

export type ChampionStat = {
  championId: string;
  name: string;
  image: string | null;
  picks: number;
  pickRate: number;
  winRate: number;
};

export type DivisionData = {
  teams: Team[];
  history: HistoryMatch[];
  playerStats: Record<Role, PlayerStats[]>;
  champions: Record<Role, ChampionStat[]>;
};

export type StatKey = 'kda' | 'goldPerMin' | 'dpm' | 'csPerMin' | 'visionScore';

/* =========================================================
   CHARGEMENT
========================================================= */

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Impossible de charger les résultats.');
  }

  return json;
}

// Une requête par division (et par BO ouvert), partagée entre chargement et préchargement.
const divisionRequests = new Map<DivisionName, Promise<DivisionData>>();
const gameRequests = new Map<number, Promise<Game[]>>();

function loadDivision(division: DivisionName): Promise<DivisionData> {
  let request = divisionRequests.get(division);

  if (!request) {
    request = getJson(`/api/resultats?division=${division}`).catch((error) => {
      divisionRequests.delete(division);
      throw error;
    });

    divisionRequests.set(division, request);
  }

  return request;
}

export function loadGames(matchId: number): Promise<Game[]> {
  let request = gameRequests.get(matchId);

  if (!request) {
    request = getJson(`/api/historique/${matchId}`)
      .then((json) => json.match.games as Game[])
      .catch((error) => {
        gameRequests.delete(matchId);
        throw error;
      });

    gameRequests.set(matchId, request);
  }

  return request;
}

function readDivisionFromUrl(): DivisionName {
  const value = new URLSearchParams(window.location.search).get('division');
  const match = DIVISIONS.find((division) => division.toLowerCase() === value?.toLowerCase());

  return match ?? 'Yordle';
}

// Division choisie (synchronisée avec ?division=) et ses données, avec préchargement des autres.
export function useDivisionData() {
  const [division, setDivision] = useState<DivisionName>('Yordle');
  const [cache, setCache] = useState<Partial<Record<DivisionName, DivisionData>>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    // Données fraîches à chaque arrivée sur la page.
    divisionRequests.clear();
    gameRequests.clear();
    setDivision(readDivisionFromUrl());
  }, []);

  // Lien partageable : ?division=Ixtal.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('division', division);
    window.history.replaceState(null, '', url.toString());
  }, [division]);

  useEffect(() => {
    if (cache[division]) return;

    let active = true;
    setError('');

    loadDivision(division)
      .then((data) => {
        if (!active) return;

        setCache((previous) => ({ ...previous, [division]: data }));

        // Précharge les autres divisions pour un changement d'onglet instantané.
        for (const other of DIVISIONS) {
          if (other === division) continue;

          loadDivision(other)
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
  }, [division, cache]);

  const data = cache[division] ?? null;

  return { division, setDivision, data, error, loading: !data && !error };
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

export function TeamLogo({ logo, size = 'md' }: { logo: string | null; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? styles.logoSm : styles.logo;

  return logo ? (
    <img src={logo} alt="" className={className} loading="lazy" />
  ) : (
    <span className={`${className} ${styles.logoEmpty}`} />
  );
}
