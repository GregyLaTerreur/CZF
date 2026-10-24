// Requêtes Supabase des routes de résultats : uniquement les colonnes utiles.

import { type NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { RESULTS_TAG, RESULTS_TTL_SECONDS } from './cache';
import {
  type AnyObject,
  type Division,
  type PlayerNames,
  type TeamInfo,
  isValidated,
  normalizeDivision,
  toTeamInfo,
} from './core';

export const MATCH_COLUMNS =
  'id, division, team1_id, team2_id, winner_team_id, stage, bracket, round, best_of, played_at, mvp_player_id';

export const GAME_COLUMNS =
  'id, match_id, game_number, duration_seconds, winner_team_id, substitute_stats';

export const STAT_COLUMNS =
  'id, game_id, player_id, team_id, role, champion_id, kills, deaths, assists, cs, gold, damage, vision_score';

type QueryResult = PromiseLike<{ data: any[] | null; error: any }>;

// Supabase plafonne à 1000 lignes par requête.
export async function fetchAll(
  buildQuery: (from: number, to: number) => QueryResult,
  pageSize = 1000
): Promise<AnyObject[]> {
  const all: AnyObject[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) throw error;

    all.push(...(data ?? []));

    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return all;
}

// Filtre `in` découpé en paquets pour ne pas dépasser la longueur d'URL.
export async function fetchByIds(
  table: string,
  columns: string,
  column: string,
  ids: number[],
  orderBy = 'id'
): Promise<AnyObject[]> {
  const unique = [...new Set(ids)];
  const chunks: number[][] = [];

  for (let i = 0; i < unique.length; i += 200) {
    chunks.push(unique.slice(i, i + 200));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchAll((from, to) =>
        supabaseAdmin
          .from(table)
          .select(columns)
          .in(column, chunk)
          .order(orderBy, { ascending: true })
          .range(from, to)
      )
    )
  );

  return results
    .flat()
    .sort((a, b) => Number(a[orderBy]) - Number(b[orderBy]));
}

export async function loadValidatedTeams(): Promise<TeamInfo[]> {
  const rows = await fetchAll((from, to) =>
    supabaseAdmin
      .from('teams')
      .select('id, name, logo_url, division, validated_by_admin')
      .order('id', { ascending: true })
      .range(from, to)
  );

  return rows.filter(isValidated).map(toTeamInfo);
}

export function toTeamMap(teams: TeamInfo[]): Map<number, TeamInfo> {
  return new Map(teams.map((team) => [Number(team.id), team]));
}

// BO terminés, du plus récent au plus ancien.
export async function loadFinishedMatches(
  options: { division?: Division | null; stage?: 'pool' | 'playoff' } = {}
): Promise<AnyObject[]> {
  return fetchAll((from, to) => {
    let query = supabaseAdmin
      .from('czf_matches')
      .select(MATCH_COLUMNS)
      .eq('status', 'finished');

    if (options.division) query = query.eq('division', options.division);
    if (options.stage) query = query.eq('stage', options.stage);

    return query
      .order('played_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
  });
}

export function loadGames(
  matchIds: number[],
  columns = GAME_COLUMNS
): Promise<AnyObject[]> {
  return fetchByIds('czf_games', columns, 'match_id', matchIds);
}

export function loadStats(
  view: 'czf_game_player_stats' | 'czf_current_player_stats',
  gameIds: number[]
): Promise<AnyObject[]> {
  return fetchByIds(view, STAT_COLUMNS, 'game_id', gameIds);
}

export async function loadPlayerNames(ids: number[]): Promise<PlayerNames> {
  const rows = await fetchByIds(
    'players',
    'id, riot_id',
    'id',
    ids.filter(Number.isFinite)
  );

  return new Map(
    rows.map((row) => [Number(row.id), row.riot_id ?? null])
  );
}

export async function loadExclusions(): Promise<AnyObject[]> {
  return fetchAll((from, to) =>
    supabaseAdmin
      .from('czf_stats_exclusions')
      .select('player_id, role')
      .order('player_id', { ascending: true })
      .range(from, to)
  );
}

/* =========================================================
   JEU DE DONNÉES COMPLET (pages Résultats et Stats)
========================================================= */

// Comme fetchAll, mais en lisant plusieurs pages à la fois : un seul aller-retour
// tant que la table tient dans `batch` pages.
async function fetchAllPages(
  buildQuery: (from: number, to: number) => QueryResult,
  batch = 3,
  pageSize = 1000
): Promise<AnyObject[]> {
  const all: AnyObject[] = [];

  for (let start = 0; ; start += batch * pageSize) {
    const pages = await Promise.all(
      Array.from({ length: batch }, (_, index) => {
        const from = start + index * pageSize;
        return buildQuery(from, from + pageSize - 1);
      })
    );

    for (const { data, error } of pages) {
      if (error) throw error;
      all.push(...(data ?? []));
    }

    if ((pages[batch - 1].data?.length ?? 0) < pageSize) return all;
  }
}

export type ResultsDataset = {
  matches: AnyObject[];
  teams: TeamInfo[];
  exclusions: AnyObject[];
  games: AnyObject[];
  stats: AnyObject[];
  // La vue czf_current_player_stats filtre czf_game_player_stats : ses ids suffisent.
  currentStatIds: number[];
  // Paires [id, riot_id] : le cache n'accepte que du JSON.
  playerNames: [number, string | null][];
};

// Toutes les tables lues en parallèle : quelques milliers de lignes au plus,
// moins coûteux qu'une cascade de requêtes filtrées.
async function fetchResultsDataset(): Promise<ResultsDataset> {
  const [matches, teams, exclusions, games, currentStats, stats, players] = await Promise.all([
    loadFinishedMatches(),
    loadValidatedTeams(),
    loadExclusions(),
    fetchAllPages((from, to) =>
      supabaseAdmin.from('czf_games').select(GAME_COLUMNS).order('id', { ascending: true }).range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabaseAdmin
        .from('czf_current_player_stats')
        .select('id, game_id')
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabaseAdmin
        .from('czf_game_player_stats')
        .select(STAT_COLUMNS)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabaseAdmin.from('players').select('id, riot_id').order('id', { ascending: true }).range(from, to)
    ),
  ]);

  // Seulement les games des BO terminés, comme loadGames(matchIds).
  const matchIds = new Set(matches.map((match) => Number(match.id)));
  const finishedGames = games.filter((game) => matchIds.has(Number(game.match_id)));
  const gameIds = new Set(finishedGames.map((game) => Number(game.id)));
  const inFinishedGame = (stat: AnyObject) => gameIds.has(Number(stat.game_id));

  return {
    matches,
    teams,
    exclusions,
    games: finishedGames,
    stats: stats.filter(inFinishedGame),
    currentStatIds: currentStats.filter(inFinishedGame).map((stat) => Number(stat.id)),
    playerNames: players.map((player) => [Number(player.id), player.riot_id ?? null]),
  };
}

// Les résultats ne changent qu'à la publication d'un match : cache partagé
// entre divisions et requêtes, invalidé par invalidateResults().
const cachedResultsDataset = unstable_cache(fetchResultsDataset, ['resultats-dataset-v2'], {
  revalidate: RESULTS_TTL_SECONDS,
  tags: [RESULTS_TAG],
});

// Les appels simultanés (3 divisions préchargées) partagent le même chargement.
let pendingDataset: Promise<ResultsDataset> | null = null;

export function loadResultsDataset(): Promise<ResultsDataset> {
  pendingDataset ??= cachedResultsDataset().finally(() => {
    pendingDataset = null;
  });

  return pendingDataset;
}

/* =========================================================
   REPONSES
========================================================= */

// ?division=Ixtal (insensible à la casse) ; absent = toutes les divisions.
export function readDivisionParam(request: NextRequest): {
  division: Division | null;
  invalid: boolean;
} {
  const raw = request.nextUrl.searchParams.get('division');
  const division = raw ? normalizeDivision(raw) : null;

  return { division, invalid: Boolean(raw) && !division };
}

export function invalidDivision() {
  return jsonNoStore(
    { success: false, error: 'Division inconnue (Yordle, Ixtal ou Targon).' },
    400
  );
}

export function jsonNoStore(body: AnyObject, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export function jsonError(scope: string, error: any, fallback: string) {
  console.error(`[${scope}]`, error);

  return jsonNoStore(
    { success: false, error: error?.message || fallback },
    500
  );
}
