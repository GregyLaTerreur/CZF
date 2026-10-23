'use client';

import { useEffect, useState } from 'react';
import type { DivisionName } from './divisions';

export type StandingTeam = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  division: DivisionName;
  wins: number;
  losses: number;
  gameDiff: number;
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
  division: DivisionName;
  stage: 'pool' | 'playoff';
  bestOf: number;
  playedAt: string;
  mvpRiotId: string | null;
  // null quand l'équipe n'est plus validée par un admin.
  team1: MatchSide | null;
  team2: MatchSide | null;
  winner: { id: number } | null;
};

export type PlayerStat = {
  playerId: number;
  riotId: string;
  teamShortName: string;
  role: string;
  games: number;
  kda: number;
  mvp: number;
};

export type ResultsData = {
  divisions: Record<DivisionName, StandingTeam[]>;
  teams: StandingTeam[];
  history: HistoryMatch[];
  playerStatsByDivision: Record<DivisionName, Record<string, PlayerStat[]>>;
  roles: { id: string; label: string; icon: string }[];
};

// Une seule requête partagée par toutes les sections de la homepage.
let request: Promise<ResultsData> | null = null;

function loadResults() {
  if (!request) {
    request = fetch('/api/results', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Impossible de charger les résultats.');
        }

        return json as ResultsData;
      })
      .catch((error) => {
        request = null;
        throw error;
      });
  }

  return request;
}

export function useResults() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    loadResults()
      .then((json) => active && setData(json))
      .catch((err) => active && setError(err.message));

    return () => {
      active = false;
    };
  }, []);

  return { data, error, loading: !data && !error };
}
