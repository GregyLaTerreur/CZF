
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnyObject = Record<string, any>;
type Division = 'Yordle' | 'Ixtal' | 'Targon';
type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';

const ROLES: Role[] = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const DIVISIONS: Division[] = ['Yordle', 'Ixtal', 'Targon'];

type ResultPlayer = {
  id: string | number | null;
  riotId: string;
  discordName: string | null;
  role: string | null;
  avatar: string | null;
};

type ResultTeam = {
  id: string | number;
  name: string;
  shortName: string;
  logo: string | null;
  division: Division | null;
  wins: number;
  losses: number;
  gameDiff: number;
  roster: ResultPlayer[];
};

type Champion = {
  id: string;
  key: string;
  name: string;
  image: string;
};

type PlayerStats = {
  playerId: number;
  riotId: string;
  teamId: number;
  teamName: string;
  teamShortName: string;
  teamLogo: string | null;
  role: Role;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
  csPerMin: number;
  gold: number;
  goldPerMin: number;
  damage: number;
  dpm: number;
  visionScore: number;
  mvp: number;
  totalDurationSeconds: number;
};

type ChampionRoleStat = {
  championId: string;
  name: string;
  image: string | null;
  role: Role;
  picks: number;
  wins: number;
  losses: number;
  pickRate: number;
  winRate: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configuration Supabase manquante');
}

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/* =========================================================
   PAGINATION SUPABASE
========================================================= */

async function fetchAll<T = AnyObject>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: T[] | null;
    error: any;
  }>,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(
      from,
      from + pageSize - 1
    );

    if (error) {
      return { data: [], error };
    }

    all.push(...(data ?? []));

    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return { data: all, error: null };
}

/* =========================================================
   HELPERS
========================================================= */

function getValue(
  object: AnyObject | null | undefined,
  keys: string[]
): any {
  if (!object) return undefined;

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return undefined;
}

function stringOrNull(value: any): string | null {
  return value === undefined ||
    value === null ||
    value === ''
    ? null
    : String(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyRoleStats() {
  return {
    Top: [],
    Jungle: [],
    Mid: [],
    ADC: [],
    Support: [],
  };
}

function normalizeDivision(value: any): Division | null {
  const division = String(value || '').trim().toLowerCase();

  if (division === 'yordle') return 'Yordle';
  if (division === 'ixtal') return 'Ixtal';
  if (division === 'targon') return 'Targon';

  return null;
}

function normalizeRole(value: any): Role | null {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'top' || role === 'toplane') return 'Top';
  if (['jungle', 'jgl', 'jg'].includes(role)) return 'Jungle';
  if (role === 'mid' || role === 'middle') return 'Mid';
  if (['adc', 'bot', 'bottom'].includes(role)) return 'ADC';
  if (role === 'support' || role === 'sup') return 'Support';

  return null;
}

function roleOrder(role: string | null): number {
  if (!role) return 99;

  const index = ROLES.indexOf(role as Role);
  return index === -1 ? 99 : index;
}

function normalizeRiotId(value: any): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function getTeamName(team: AnyObject): string {
  return String(
    getValue(team, ['name', 'team_name', 'teamName']) ?? 'Équipe'
  );
}

function getTeamShortName(team: AnyObject): string {
  const existing = getValue(team, [
    'short_name',
    'shortName',
    'tag',
    'acronym',
  ]);

  if (existing) return String(existing).toUpperCase();

  const name = getTeamName(team);
  const words = name.trim().split(/\s+/);

  if (words.length > 1) {
    return words
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 4)
      .toUpperCase();
  }

  return name.slice(0, 4).toUpperCase();
}

function getTeamLogo(team: AnyObject): string | null {
  return stringOrNull(
    getValue(team, [
      'logo',
      'logo_url',
      'logoUrl',
      'image',
      'image_url',
      'imageUrl',
    ])
  );
}

function isValidated(team: AnyObject): boolean {
  const value = getValue(team, [
    'validated_by_admin',
    'validatedByAdmin',
  ]);

  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    String(value).toLowerCase() === 'true'
  );
}

function findPlayer(
  players: AnyObject[],
  riotId: string,
  member: AnyObject
): AnyObject {
  const memberPlayerId = getValue(member, [
    'player_id',
    'playerId',
  ]);

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

function extractArray(
  data: any,
  possibleKeys: string[]
): AnyObject[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  for (const key of possibleKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

/* =========================================================
   CHAMPIONS
========================================================= */

async function getChampions(): Promise<Champion[]> {
  try {
    const versionsResponse = await fetch(
      'https://ddragon.leagueoflegends.com/api/versions.json',
      { next: { revalidate: 86400 } }
    );

    if (!versionsResponse.ok) return [];

    const versions = await versionsResponse.json();
    const version = versions?.[0];

    if (!version) return [];

    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) return [];

    const data = await response.json();

    return Object.values(data?.data || {})
      .map((champion: any): Champion => ({
        id: champion.id,
        key: champion.key,
        name: champion.name,
        image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  } catch (error) {
    console.error('[RESULTS CHAMPIONS]', error);
    return [];
  }
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

    let resultTeams: ResultTeam[] = validatedTeams.map((team) => {
      const teamId = getValue(team, ['id', 'team_id', 'teamId']);

      const teamMembers = rawMembers.filter(
        (member) =>
          String(
            getValue(member, ['team_id', 'teamId', 'team'])
          ) === String(teamId)
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
        id: teamId,
        name: getTeamName(team),
        shortName: getTeamShortName(team),
        logo: getTeamLogo(team),
        division: normalizeDivision(
          getValue(team, [
            'division',
            'division_name',
            'divisionName',
          ])
        ),
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

    const [
      matchesResult,
      gamesResult,
      statsResult,
      exclusionsResult,
    ] = await Promise.all([
      fetchAll((from, to) =>
        supabaseAdmin
          .from('czf_matches')
          .select('*')
          .eq('status', 'finished')
          .order('played_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)
      ),

      fetchAll((from, to) =>
        supabaseAdmin
          .from('czf_games')
          .select('*')
          .order('id', { ascending: true })
          .range(from, to)
      ),

      fetchAll((from, to) =>
        supabaseAdmin
          .from('czf_game_player_stats')
          .select('*')
          .order('id', { ascending: true })
          .range(from, to)
      ),

      fetchAll((from, to) =>
        supabaseAdmin
          .from('czf_stats_exclusions')
          .select('player_id, role')
          .order('player_id', { ascending: true })
          .range(from, to)
      ),
    ]);

    if (matchesResult.error) throw matchesResult.error;
    if (gamesResult.error) throw gamesResult.error;
    if (statsResult.error) throw statsResult.error;
    if (exclusionsResult.error) throw exclusionsResult.error;

    const allMatches = matchesResult.data || [];
    const allGames = gamesResult.data || [];
    const allStats = statsResult.data || [];

    /* =====================================================
       EXCLUSIONS DES CLASSEMENTS INDIVIDUELS

       ALL = tous les rôles
       ADC = ADC seulement
       Support = Support seulement

       Aucun impact sur les historiques et les champions.
    ===================================================== */

    const excludedPlayerRoles = new Set<string>();

    for (const exclusion of exclusionsResult.data || []) {
      const playerId = Number(exclusion.player_id);

      if (!Number.isFinite(playerId)) continue;

      const role = String(exclusion.role || '').trim();

      if (role.toUpperCase() === 'ALL') {
        excludedPlayerRoles.add(`${playerId}:ALL`);
      } else {
        const normalized = normalizeRole(role);

        if (normalized) {
          excludedPlayerRoles.add(`${playerId}:${normalized}`);
        }
      }
    }

    function isExcludedFromRanking(
      playerId: number,
      role: Role
    ): boolean {
      return (
        excludedPlayerRoles.has(`${playerId}:ALL`) ||
        excludedPlayerRoles.has(`${playerId}:${role}`)
      );
    }

    /* =====================================================
       INDEX DES DONNEES
    ===================================================== */

    const teamMap = new Map<number, ResultTeam>(
      resultTeams.map((team) => [Number(team.id), team])
    );

    const playerMap = new Map<number, AnyObject>();

    for (const player of rawPlayers) {
      const id = Number(
        getValue(player, ['id', 'player_id', 'playerId'])
      );

      if (Number.isFinite(id)) {
        playerMap.set(id, player);
      }
    }

    const matchMap = new Map<number, AnyObject>(
      allMatches.map((match) => [Number(match.id), match])
    );

    const gameMap = new Map<number, AnyObject>(
      allGames.map((game) => [Number(game.id), game])
    );

    const gamesByMatch = new Map<number, AnyObject[]>();
    const statsByGame = new Map<number, AnyObject[]>();

    for (const game of allGames) {
      const matchId = Number(game.match_id);
      const rows = gamesByMatch.get(matchId) || [];

      rows.push(game);
      gamesByMatch.set(matchId, rows);
    }

    for (const stat of allStats) {
      const gameId = Number(stat.game_id);
      const rows = statsByGame.get(gameId) || [];

      rows.push(stat);
      statsByGame.set(gameId, rows);
    }

    /* =====================================================
       CLASSEMENT DES EQUIPES : POULES UNIQUEMENT
    ===================================================== */

    const poolMatches = allMatches.filter(
      (match) => match.stage === 'pool'
    );

    for (const match of poolMatches) {
      const team1 = teamMap.get(Number(match.team1_id));
      const team2 = teamMap.get(Number(match.team2_id));

      if (!team1 || !team2) continue;

      for (const game of gamesByMatch.get(Number(match.id)) || []) {
        const winnerId = Number(game.winner_team_id);

        if (winnerId === Number(team1.id)) {
          team1.wins++;
          team2.losses++;
        } else if (winnerId === Number(team2.id)) {
          team2.wins++;
          team1.losses++;
        }
      }
    }

    for (const team of resultTeams) {
      team.gameDiff = team.wins - team.losses;
    }

    function getHeadToHeadDifference(
      teamAId: number,
      teamBId: number
    ): number {
      let winsA = 0;
      let winsB = 0;

      for (const match of poolMatches) {
        const a = Number(match.team1_id);
        const b = Number(match.team2_id);

        if (
          !(
            (a === teamAId && b === teamBId) ||
            (a === teamBId && b === teamAId)
          )
        ) {
          continue;
        }

        for (const game of gamesByMatch.get(Number(match.id)) || []) {
          if (Number(game.winner_team_id) === teamAId) {
            winsA++;
          }

          if (Number(game.winner_team_id) === teamBId) {
            winsB++;
          }
        }
      }

      return winsA - winsB;
    }

    resultTeams = resultTeams.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;

      if (b.gameDiff !== a.gameDiff) {
        return b.gameDiff - a.gameDiff;
      }

      const headToHead = getHeadToHeadDifference(
        Number(a.id),
        Number(b.id)
      );

      if (headToHead !== 0) return -headToHead;

      return a.name.localeCompare(b.name, 'fr');
    });

    const divisions = {
      Yordle: resultTeams.filter((t) => t.division === 'Yordle'),
      Ixtal: resultTeams.filter((t) => t.division === 'Ixtal'),
      Targon: resultTeams.filter((t) => t.division === 'Targon'),
    };

    /* =====================================================
       HISTORIQUE DES BO ET DES GAMES

       Aucun filtrage des joueurs exclus ici.
    ===================================================== */

    const history = allMatches.map((match) => {
      const team1 = teamMap.get(Number(match.team1_id));
      const team2 = teamMap.get(Number(match.team2_id));

      const winner =
        match.winner_team_id != null
          ? teamMap.get(Number(match.winner_team_id))
          : undefined;

      const matchMvpPlayer = match.mvp_player_id
        ? playerMap.get(Number(match.mvp_player_id))
        : null;

      const matchGames = [
        ...(gamesByMatch.get(Number(match.id)) || []),
      ].sort(
        (a, b) =>
          Number(a.game_number) - Number(b.game_number)
      );

      const score1 = matchGames.filter(
        (game) =>
          Number(game.winner_team_id) === Number(match.team1_id)
      ).length;

      const score2 = matchGames.filter(
        (game) =>
          Number(game.winner_team_id) === Number(match.team2_id)
      ).length;

      const formatTeam = (
        team: ResultTeam | undefined,
        score?: number
      ) =>
        team
          ? {
              id: Number(team.id),
              name: team.name,
              shortName: team.shortName,
              logo: team.logo,
              ...(score !== undefined ? { score } : {}),
            }
          : null;

      return {
        id: Number(match.id),
        division: match.division as Division,
        stage: match.stage,
        bracket: match.bracket,
        round: match.round,
        bestOf: Number(match.best_of),
        playedAt: match.played_at,

        mvpPlayerId: match.mvp_player_id
          ? Number(match.mvp_player_id)
          : null,

        mvpRiotId: matchMvpPlayer
          ? String(
              getValue(matchMvpPlayer, ['riot_id', 'riotId']) ?? ''
            )
          : null,

        team1: formatTeam(team1, score1),
        team2: formatTeam(team2, score2),
        winner: formatTeam(winner),

        games: matchGames.map((game) => {
          const gameWinner = teamMap.get(
            Number(game.winner_team_id)
          );

          /* JOUEURS OFFICIELS */

          const officialGameStats = (
            statsByGame.get(Number(game.id)) || []
          ).map((stat) => {
            const player = playerMap.get(Number(stat.player_id));
            const team = teamMap.get(Number(stat.team_id));

            const championId = String(stat.champion_id ?? '');
            const champion = championMap.get(championId);

            return {
              playerId: Number(stat.player_id),

              riotId: player
                ? String(
                    getValue(player, ['riot_id', 'riotId']) ??
                      `Joueur ${stat.player_id}`
                  )
                : `Joueur ${stat.player_id}`,

              isSub: false,
              teamId: Number(stat.team_id),
              teamName: team?.name ?? '',
              teamShortName: team?.shortName ?? '',
              role: normalizeRole(stat.role),
              championId,
              championName: champion?.name ?? championId,
              championImage: champion?.image ?? null,
              kills: Number(stat.kills) || 0,
              deaths: Number(stat.deaths) || 0,
              assists: Number(stat.assists) || 0,
            };
          });

          /* REMPLACANTS : HISTORIQUE UNIQUEMENT */

          const rawSubstitutes = Array.isArray(
            game.substitute_stats
          )
            ? game.substitute_stats
            : [];

          const substituteGameStats = rawSubstitutes
            .map((sub: AnyObject) => {
              const teamId = Number(
                sub.teamId ?? sub.team_id
              );

              const team = teamMap.get(teamId);

              const championId = String(
                sub.championId ?? sub.champion_id ?? ''
              );

              const champion = championMap.get(championId);

              return {
                playerId: null,
                riotId: 'SUB',
                isSub: true,
                teamId,
                teamName: team?.name ?? '',
                teamShortName: team?.shortName ?? '',
                role: normalizeRole(sub.role),
                championId,
                championName: champion?.name ?? championId,
                championImage: champion?.image ?? null,
                kills: Number(sub.kills) || 0,
                deaths: Number(sub.deaths) || 0,
                assists: Number(sub.assists) || 0,
              };
            })
            .filter(
              (sub) =>
                Number.isFinite(sub.teamId) &&
                sub.role !== null &&
                sub.championId !== ''
            );

          const gameStats = [
            ...officialGameStats,
            ...substituteGameStats,
          ].sort((a, b) => {
            if (a.teamId !== b.teamId) {
              return a.teamId - b.teamId;
            }

            return roleOrder(a.role) - roleOrder(b.role);
          });

          return {
            id: Number(game.id),
            gameNumber: Number(game.game_number),
            durationSeconds: Number(game.duration_seconds),
            winnerTeamId: Number(game.winner_team_id),
            winnerName: gameWinner?.name ?? null,
            players: gameStats,
          };
        }),
      };
    });

    const historyByDivision = {
      Yordle: history.filter((m) => m.division === 'Yordle'),
      Ixtal: history.filter((m) => m.division === 'Ixtal'),
      Targon: history.filter((m) => m.division === 'Targon'),
    };

    /* =====================================================
       STATISTIQUES INDIVIDUELLES

       Les exclusions Supabase s'appliquent ICI.
    ===================================================== */

    function statsForDivision(
      division: Division
    ): Record<Role, PlayerStats[]> {
      const divisionMatchIds = new Set(
        allMatches
          .filter((m) => m.division === division)
          .map((m) => Number(m.id))
      );

      const divisionGames = allGames.filter((g) =>
        divisionMatchIds.has(Number(g.match_id))
      );

      const divisionGameIds = new Set(
        divisionGames.map((g) => Number(g.id))
      );

      const result: Record<Role, PlayerStats[]> = {
        Top: [],
        Jungle: [],
        Mid: [],
        ADC: [],
        Support: [],
      };

      const playerRoleKeys = new Set<string>();

      for (const stat of allStats) {
        if (!divisionGameIds.has(Number(stat.game_id))) {
          continue;
        }

        const role = normalizeRole(stat.role);

        if (!role) continue;

        /*
          EXCLUSION PAR JOUEUR ET PAR ROLE

          KC Inty : ADC uniquement
          SmokeCamel : Support uniquement
          Les 6 autres : ALL
        */
        if (
          isExcludedFromRanking(
            Number(stat.player_id),
            role
          )
        ) {
          continue;
        }

        playerRoleKeys.add(
          `${Number(stat.player_id)}:${role}`
        );
      }

      for (const key of playerRoleKeys) {
        const [playerIdRaw, roleRaw] = key.split(':');

        const playerId = Number(playerIdRaw);
        const role = roleRaw as Role;

        const rows = allStats.filter(
          (stat) =>
            Number(stat.player_id) === playerId &&
            normalizeRole(stat.role) === role &&
            divisionGameIds.has(Number(stat.game_id))
        );

        if (!rows.length) continue;

        const teamId = Number(rows[0].team_id);
        const team = teamMap.get(teamId);
        const rawPlayer = playerMap.get(playerId);

        if (!team || !rawPlayer) continue;

        let kills = 0;
        let deaths = 0;
        let assists = 0;
        let cs = 0;
        let gold = 0;
        let damage = 0;
        let visionScore = 0;
        let wins = 0;
        let losses = 0;
        let duration = 0;

        const playerMatchIds = new Set<number>();

        for (const row of rows) {
          const game = gameMap.get(Number(row.game_id));

          if (!game) continue;

          kills += Number(row.kills) || 0;
          deaths += Number(row.deaths) || 0;
          assists += Number(row.assists) || 0;
          cs += Number(row.cs) || 0;
          gold += Number(row.gold) || 0;
          damage += Number(row.damage) || 0;
          visionScore += Number(row.vision_score) || 0;
          duration += Number(game.duration_seconds) || 0;

          if (
            Number(game.winner_team_id) === Number(row.team_id)
          ) {
            wins++;
          } else {
            losses++;
          }

          playerMatchIds.add(Number(game.match_id));
        }

        let mvp = 0;

        for (const matchId of playerMatchIds) {
          const match = matchMap.get(matchId);

          if (
            match &&
            Number(match.mvp_player_id) === playerId
          ) {
            mvp++;
          }
        }

        const gamesPlayed = rows.length;
        const minutes = duration / 60;

        // KDA : moyenne des ratios par game
        const kda = gamesPlayed
          ? round2(
              rows.reduce((total, row) => {
                const k = Number(row.kills) || 0;
                const d = Number(row.deaths) || 0;
                const a = Number(row.assists) || 0;

                return total + (k + a) / Math.max(1, d);
              }, 0) / gamesPlayed
            )
          : 0;

        result[role].push({
          playerId,

          riotId: String(
            getValue(rawPlayer, ['riot_id', 'riotId']) ??
              `Joueur ${playerId}`
          ),

          teamId,
          teamName: team.name,
          teamShortName: team.shortName,
          teamLogo: team.logo,
          role,
          games: gamesPlayed,
          wins,
          losses,

          kills: round2(kills / gamesPlayed),
          deaths: round2(deaths / gamesPlayed),
          assists: round2(assists / gamesPlayed),
          kda,

          cs: round2(cs / gamesPlayed),
          csPerMin:
            minutes > 0 ? round2(cs / minutes) : 0,

          gold: Math.round(gold / gamesPlayed),
          goldPerMin:
            minutes > 0 ? round2(gold / minutes) : 0,

          damage: Math.round(damage / gamesPlayed),
          dpm:
            minutes > 0 ? round2(damage / minutes) : 0,

          visionScore:
            minutes > 0
              ? round2(visionScore / minutes)
              : 0,

          mvp,
          totalDurationSeconds: duration,
        });
      }

      for (const role of ROLES) {
        result[role].sort((a, b) => b.kda - a.kda);
      }

      return result;
    }

    /* =====================================================
       STATISTIQUES CHAMPIONS

       AUCUNE EXCLUSION APPLIQUEE
    ===================================================== */

    function championsForDivision(
      division: Division
    ): Record<Role, ChampionRoleStat[]> {
      const divisionMatches = allMatches.filter(
        (m) => m.division === division
      );

      const divisionMatchIds = new Set(
        divisionMatches.map((m) => Number(m.id))
      );

      const divisionGameIds = new Set(
        allGames
          .filter((g) =>
            divisionMatchIds.has(Number(g.match_id))
          )
          .map((g) => Number(g.id))
      );

      const totalBos = divisionMatches.length;

      const result: Record<Role, ChampionRoleStat[]> = {
        Top: [],
        Jungle: [],
        Mid: [],
        ADC: [],
        Support: [],
      };

      for (const role of ROLES) {
        const rows = allStats.filter(
          (stat) =>
            divisionGameIds.has(Number(stat.game_id)) &&
            normalizeRole(stat.role) === role
        );

        const map = new Map<
          string,
          {
            picks: number;
            wins: number;
            matchIds: Set<number>;
          }
        >();

        for (const row of rows) {
          const championId = String(row.champion_id ?? '');

          if (!championId) continue;

          const game = gameMap.get(Number(row.game_id));

          if (!game) continue;

          const current = map.get(championId) || {
            picks: 0,
            wins: 0,
            matchIds: new Set<number>(),
          };

          current.picks++;

          if (
            Number(game.winner_team_id) ===
            Number(row.team_id)
          ) {
            current.wins++;
          }

          current.matchIds.add(Number(game.match_id));
          map.set(championId, current);
        }

        result[role] = [...map.entries()]
          .map(([championId, values]) => {
            const champion = championMap.get(championId);

            return {
              championId,
              name: champion?.name ?? championId,
              image: champion?.image ?? null,
              role,
              picks: values.picks,
              wins: values.wins,
              losses: values.picks - values.wins,

              pickRate:
                totalBos > 0
                  ? round2(
                      (values.matchIds.size / totalBos) * 100
                    )
                  : 0,

              winRate:
                values.picks > 0
                  ? round2(
                      (values.wins / values.picks) * 100
                    )
                  : 0,
            };
          })
          .sort(
            (a, b) =>
              b.picks - a.picks ||
              b.winRate - a.winRate
          )
          .slice(0, 5);
      }

      return result;
    }

    /* =====================================================
       STATS PAR DIVISION
    ===================================================== */

    const playerStatsByDivision = {
      Yordle: statsForDivision('Yordle'),
      Ixtal: statsForDivision('Ixtal'),
      Targon: statsForDivision('Targon'),
    };

    const championsByDivision = {
      Yordle: championsForDivision('Yordle'),
      Ixtal: championsForDivision('Ixtal'),
      Targon: championsForDivision('Targon'),
    };

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
          {
            id: 'Top',
            label: 'TOP',
            icon: '/assets/roles/top.png',
          },
          {
            id: 'Jungle',
            label: 'JGL',
            icon: '/assets/roles/jungle.png',
          },
          {
            id: 'Mid',
            label: 'MID',
            icon: '/assets/roles/mid.png',
          },
          {
            id: 'ADC',
            label: 'ADC',
            icon: '/assets/roles/adc.png',
          },
          {
            id: 'Support',
            label: 'SUP',
            icon: '/assets/roles/sup.png',
          },
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

        historyByDivision: {
          Yordle: [],
          Ixtal: [],
          Targon: [],
        },

        divisions: {
          Yordle: [],
          Ixtal: [],
          Targon: [],
        },

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
