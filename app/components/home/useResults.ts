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
  teamLogo: string | null;
  role: string;
  games: number;
  kda: number;
  mvp: number;
};

export type ClassementData = {
  totalTeams: number;
  divisions: Record<DivisionName, StandingTeam[]>;
};

export type HistoriqueData = {
  total: number;
  matches: HistoryMatch[];
};

export type StatsJoueursData = {
  roles: Record<string, PlayerStat[]>;
};

// Une requête par URL, partagée par toutes les sections de la homepage.
const requests = new Map<string, Promise<any>>();

function load<T>(url: string): Promise<T> {
  let request = requests.get(url);

  if (!request) {
    request = fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Impossible de charger les résultats.');
        }

        return json;
      })
      .catch((error) => {
        requests.delete(url);
        throw error;
      });

    requests.set(url, request);
  }

  return request;
}

// keepPrevious : garde les données de l'URL précédente pendant le chargement
// (évite que la section se vide quand on change de filtre).
function useApi<T>(url: string, keepPrevious = false) {
  const [state, setState] = useState<{ url: string; data: T | null; error: string }>({
    url: '',
    data: null,
    error: '',
  });

  useEffect(() => {
    let active = true;

    load<T>(url)
      .then((data) => active && setState({ url, data, error: '' }))
      .catch((err) => active && setState({ url, data: null, error: err.message }));

    return () => {
      active = false;
    };
  }, [url]);

  // Données d'une autre URL (changement d'onglet) = encore en chargement.
  const current = state.url === url;
  const data = current || keepPrevious ? state.data : null;
  const error = current ? state.error : '';

  return { data, error, loading: !data && !error };
}

export function useClassement() {
  return useApi<ClassementData>('/api/classement');
}

export function useHistorique(division: DivisionName | null, limit: number) {
  const query = division ? `division=${division}&limit=${limit}` : `limit=${limit}`;

  return useApi<HistoriqueData>(`/api/historique?${query}`, true);
}

export function useStatsJoueurs(division: DivisionName) {
  return useApi<StatsJoueursData>(`/api/stats-joueurs?division=${division}`);
}
