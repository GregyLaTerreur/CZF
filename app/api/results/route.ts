import { NextRequest, NextResponse } from 'next/server';
import {
  type AnyObject,
  type Division,
  type PlayerNames,
  type StandingTeam,
  DIVISIONS,
  buildMatchGames,
  buildMatchSummary,
  computeChampionStats,
  computePlayerStats,
  computeStandings,
  emptyRoleStats,
  getChampions,
  getValue,
  groupBy,
  isValidated,
  normalizeRole,
  parseExclusions,
  roleOrder,
  splitByDivision,
  stringOrNull,
  toTeamInfo,
} from '@/lib/results/core';
import {
  GAME_COLUMNS,
  MATCH_COLUMNS,
  STAT_COLUMNS,
  fetchAll,
  loadExclusions,
} from '@/lib/results/load';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Réponse complète historique, utilisée par l'admin (équipes avec roster + champions).
// Les pages publiques passent par /api/classement, /api/historique,
// /api/stats-joueurs et /api/stats-champions.

type ResultPlayer = {
  id: string | number | null;
  riotId: string;
  discordName: string | null;
  role: string | null;
  avatar: string | null;
};

type ResultTeam = StandingTeam & {
  roster: ResultPlayer[];
};

function normalizeRiotId(value: any): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function findPlayer(
  players: AnyObject[],
  riotId: string,
  member: AnyObject
): AnyObject {
  const memberPlayerId = getValue(member, ['player_id', 'playerId']);

  if (memberPlayerId !== null && memberPlayerId !== undefined) {
    const byId = players.find(
      (player) =>
        String(getValue(player, ['id', 'player_id', 'playerId'])) ===
        String(memberPlayerId)
    );

    if (byId) return byId;
  }

  return (
    players.find(
      (player) =>
        normalizeRiotId(
          getValue(player, [
            'riot_id',
            'riotId',
            'summoner_name',
            'summonerName',
          ])
        ) === normalizeRiotId(riotId)
    ) || {}
  );
}

async function readSettledResponse(
  result: PromiseSettledResult<Response>
): Promise<any> {
  if (result.status !== 'fulfilled' || !result.value.ok) {
    return null;
  }

  try {
    return await result.value.json();
  } catch {
    return null;
  }
}

function extractArray(data: any, possibleKeys: string[]): AnyObject[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  for (const key of possibleKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

function byDivision<T>(compute: (division: Division) => T): Record<Division, T> {
  return Object.fromEntries(
    DIVISIONS.map((division) => [division, compute(division)])
  ) as Record<Division, T>;
}

/* =========================================================
   GET RESULTS
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;

    const [teamsResult, membersResult, playersResult] =
      await Promise.allSettled([
        fetch(`${origin}/api/teams`, { cache: 'no-store' }),
        fetch(`${origin}/api/team-members`, { cache: 'no-store' }),
        fetch(`${origin}/api/players`, { cache: 'no-store' }),
      ]);

    const rawTeams = extractArray(
      await readSettledResponse(teamsResult),
      ['teams', 'data']
    );

    const rawMembers = extractArray(
      await readSettledResponse(membersResult),
      ['members', 'teamMembers', 'team_members', 'data']
    );

    const rawPlayers = extractArray(
      await readSettledResponse(playersResult),
      ['players', 'data']
    );

    const validatedTeams = rawTeams.filter(isValidated);

    /* =====================================================
       EQUIPES ET ROSTERS
    ===================================================== */

    const resultTeams: ResultTeam[] = validatedTeams.map((team) => {
      const teamId = getValue(team, ['id', 'team_id', 'teamId']);

      const teamMembers = rawMembers.filter(
        (member) =>
          String(getValue(member, ['team_id', 'teamId', 'team'])) ===
          String(teamId)
      );

      const roster: ResultPlayer[] = teamMembers
        .map((member): ResultPlayer => {
          const riotId = String(
            getValue(member, [
              'riot_id',
              'riotId',
              'summoner_name',
              'summonerName',
            ]) ?? ''
          );

          const player = findPlayer(rawPlayers, riotId, member);

          return {
            id:
              getValue(player, ['id', 'player_id', 'playerId']) ??
              getValue(member, ['player_id', 'playerId', 'id']) ??
              null,
            riotId: String(
              getValue(player, [
                'riot_id',
                'riotId',
                'summoner_name',
                'summonerName',
              ]) ?? riotId ?? 'Joueur'
            ),
            discordName: stringOrNull(
              getValue(player, [
                'discord_name',
                'discordName',
                'discord_username',
                'discordUsername',
                'username',
              ])
            ),
            role: normalizeRole(
              getValue(member, ['role', 'position']) ??
                getValue(player, ['role', 'position'])
            ),
            avatar: stringOrNull(
              getValue(player, [
                'avatar',
                'avatar_url',
                'avatarUrl',
                'discord_avatar',
              ])
            ),
          };
        })
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

      return {
        ...toTeamInfo(team),
        wins: 0,
        losses: 0,
        gameDiff: 0,
        roster,
      };
    });

    const champions = await getChampions();

    const championMap = new Map(
      champions.map((champion) => [champion.id, champion])
    );

    /* =====================================================
       SUPABASE : MATCHS, GAMES, STATS ET EXCLUSIONS
    ===================================================== */

    const [allMatches, allGames, allStats, currentStats, exclusionRows] =
      await Promise.all([
        fetchAll((from, to) =>
          supabaseAdmin
            .from('czf_matches')
            .select(MATCH_COLUMNS)
            .eq('status', 'finished')
            .order('played_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to)
        ),

        fetchAll((from, to) =>
          supabaseAdmin
            .from('czf_games')
            .select(GAME_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to)
        ),

        fetchAll((from, to) =>
          supabaseAdmin
            .from('czf_game_player_stats')
            .select(STAT_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to)
        ),

        // Vue des joueurs encore présents au même rôle.
        fetchAll((from, to) =>
          supabaseAdmin
            .from('czf_current_player_stats')
            .select(STAT_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to)
        ),

        loadExclusions(),
      ]);

    /* =====================================================
       INDEX DES DONNEES
    ===================================================== */

    const playerNames: PlayerNames = new Map();

    for (const player of rawPlayers) {
      const id = Number(getValue(player, ['id', 'player_id', 'playerId']));

      if (Number.isFinite(id)) {
        playerNames.set(id, getValue(player, ['riot_id', 'riotId']) ?? null);
      }
    }

    const gamesByMatch = groupBy(allGames, (game) => Number(game.match_id));
    const statsByGame = groupBy(allStats, (stat) => Number(stat.game_id));

    /* =====================================================
       CLASSEMENT, HISTORIQUE ET STATS
    ===================================================== */

    computeStandings(resultTeams, allMatches, gamesByMatch);

    const teamMap = new Map(
      resultTeams.map((team) => [Number(team.id), team])
    );

    const divisions = splitByDivision(resultTeams, (team) => team.division);

    const history = allMatches.map((match) => {
      const matchGames = gamesByMatch.get(Number(match.id)) || [];

      return {
        ...buildMatchSummary(match, teamMap, matchGames, playerNames),
        games: buildMatchGames(
          matchGames,
          statsByGame,
          teamMap,
          playerNames,
          championMap
        ),
      };
    });

    const historyByDivision = splitByDivision(
      history,
      (match) => match.division
    );

    const exclusions = parseExclusions(exclusionRows);

    const playerStatsByDivision = byDivision((division) =>
      computePlayerStats(division, {
        matches: allMatches,
        games: allGames,
        currentStats,
        teamMap,
        playerNames,
        exclusions,
      })
    );

    const championsByDivision = byDivision((division) =>
      computeChampionStats(division, {
        matches: allMatches,
        games: allGames,
        stats: allStats,
        championMap,
      })
    );

    /* =====================================================
       REPONSE API
    ===================================================== */

    return NextResponse.json(
      {
        success: true,
        divisions,
        teams: resultTeams,
        champions,
        history,
        historyByDivision,
        playerStatsByDivision,
        championsByDivision,

        divisionAssets: {
          Yordle: {
            color: '#51a677',
            logo: '/assets/divisions/yordle.png',
          },
          Ixtal: {
            color: '#4387d8',
            logo: '/assets/divisions/ixtal.png',
          },
          Targon: {
            color: '#8f6bc7',
            logo: '/assets/divisions/targon.png',
          },
        },

        roles: [
          { id: 'Top', label: 'TOP', icon: '/assets/roles/top.png' },
          { id: 'Jungle', label: 'JGL', icon: '/assets/roles/jungle.png' },
          { id: 'Mid', label: 'MID', icon: '/assets/roles/mid.png' },
          { id: 'ADC', label: 'ADC', icon: '/assets/roles/adc.png' },
          { id: 'Support', label: 'SUP', icon: '/assets/roles/sup.png' },
        ],

        debug: {
          rawTeams: rawTeams.length,
          validatedTeams: resultTeams.length,
          members: rawMembers.length,
          players: rawPlayers.length,
          champions: champions.length,
          matches: allMatches.length,
          games: allGames.length,
          gamePlayerStats: allStats.length,
          currentPlayerStats: currentStats.length,
          yordle: divisions.Yordle.length,
          ixtal: divisions.Ixtal.length,
          targon: divisions.Targon.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('[RESULTS API]', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Impossible de charger les données de la page Résultats.',

        teams: [],
        champions: [],
        history: [],

        historyByDivision: { Yordle: [], Ixtal: [], Targon: [] },
        divisions: { Yordle: [], Ixtal: [], Targon: [] },

        playerStatsByDivision: {
          Yordle: emptyRoleStats(),
          Ixtal: emptyRoleStats(),
          Targon: emptyRoleStats(),
        },

        championsByDivision: {
          Yordle: emptyRoleStats(),
          Ixtal: emptyRoleStats(),
          Targon: emptyRoleStats(),
        },
      },
      { status: 500 }
    );
  }
}
