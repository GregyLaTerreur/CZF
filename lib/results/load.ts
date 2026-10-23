// Requêtes Supabase des routes de résultats : uniquement les colonnes utiles.

import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
