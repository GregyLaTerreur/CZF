// Calculs des résultats publics, partagés par /api/results et les routes dédiées
// (classement, historique, stats). Fonctions pures : aucune requête ici.

export type AnyObject = Record<string, any>;
export type Division = 'Yordle' | 'Ixtal' | 'Targon';
export type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';

export const ROLES: Role[] = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
export const DIVISIONS: Division[] = ['Yordle', 'Ixtal', 'Targon'];

export type TeamInfo = {
  id: string | number;
  name: string;
  shortName: string;
  logo: string | null;
  division: Division | null;
};

export type StandingTeam = TeamInfo & {
  wins: number;
  losses: number;
  gameDiff: number;
};

export type Champion = {
  id: string;
  key: string;
  name: string;
  image: string;
};

export type PlayerStats = {
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

export type ChampionRoleStat = {
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

// Riot ID par id joueur ; une clé présente = joueur connu, même sans riot_id.
export type PlayerNames = Map<number, string | null>;

/* =========================================================
   HELPERS
========================================================= */

export function getValue(
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

export function stringOrNull(value: any): string | null {
  return value === undefined || value === null || value === ''
    ? null
    : String(value);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function emptyRoleStats<T>(): Record<Role, T[]> {
  return {
    Top: [],
    Jungle: [],
    Mid: [],
    ADC: [],
    Support: [],
  };
}

export function normalizeDivision(value: any): Division | null {
  const division = String(value || '').trim().toLowerCase();

  if (division === 'yordle') return 'Yordle';
  if (division === 'ixtal') return 'Ixtal';
  if (division === 'targon') return 'Targon';

  return null;
}

export function normalizeRole(value: any): Role | null {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'top' || role === 'toplane') return 'Top';
  if (['jungle', 'jgl', 'jg'].includes(role)) return 'Jungle';
  if (role === 'mid' || role === 'middle') return 'Mid';
  if (['adc', 'bot', 'bottom'].includes(role)) return 'ADC';
  if (role === 'support' || role === 'sup') return 'Support';

  return null;
}

export function roleOrder(role: string | null): number {
  if (!role) return 99;

  const index = ROLES.indexOf(role as Role);
  return index === -1 ? 99 : index;
}

export function getTeamName(team: AnyObject): string {
  return String(
    getValue(team, ['name', 'team_name', 'teamName']) ?? 'Équipe'
  );
}

export function getTeamShortName(team: AnyObject): string {
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

export function getTeamLogo(team: AnyObject): string | null {
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

export function isValidated(team: AnyObject): boolean {
  const value = getValue(team, ['validated_by_admin', 'validatedByAdmin']);

  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    String(value).toLowerCase() === 'true'
  );
}

export function toTeamInfo(team: AnyObject): TeamInfo {
  return {
    id: getValue(team, ['id', 'team_id', 'teamId']),
    name: getTeamName(team),
    shortName: getTeamShortName(team),
    logo: getTeamLogo(team),
    division: normalizeDivision(
      getValue(team, ['division', 'division_name', 'divisionName'])
    ),
  };
}

export function groupBy<T>(
  rows: T[],
  getKey: (row: T) => number
): Map<number, T[]> {
  const map = new Map<number, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    const list = map.get(key) || [];

    list.push(row);
    map.set(key, list);
  }

  return map;
}

export function splitByDivision<T>(
  items: T[],
  getDivision: (item: T) => Division | null
): Record<Division, T[]> {
  return {
    Yordle: items.filter((item) => getDivision(item) === 'Yordle'),
    Ixtal: items.filter((item) => getDivision(item) === 'Ixtal'),
    Targon: items.filter((item) => getDivision(item) === 'Targon'),
  };
}

/* =========================================================
   CHAMPIONS (Data Dragon, cache 24 h)
========================================================= */

export async function getChampions(): Promise<Champion[]> {
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
   EXCLUSIONS DES CLASSEMENTS INDIVIDUELS
   ALL = tous les rôles, sinon un rôle précis.
   Aucun impact sur les historiques et les champions.
========================================================= */

export function parseExclusions(rows: AnyObject[]): Set<string> {
  const excluded = new Set<string>();

  for (const exclusion of rows) {
    const playerId = Number(exclusion.player_id);

    if (!Number.isFinite(playerId)) continue;

    const role = String(exclusion.role || '').trim();

    if (role.toUpperCase() === 'ALL') {
      excluded.add(`${playerId}:ALL`);
    } else {
      const normalized = normalizeRole(role);

      if (normalized) {
        excluded.add(`${playerId}:${normalized}`);
      }
    }
  }

  return excluded;
}

/* =========================================================
   CLASSEMENT DES EQUIPES : POULES UNIQUEMENT
   Complète wins / losses / gameDiff puis trie.
========================================================= */

export function computeStandings<T extends StandingTeam>(
  teams: T[],
  matches: AnyObject[],
  gamesByMatch: Map<number, AnyObject[]>
): T[] {
  const teamMap = new Map<number, T>(
    teams.map((team) => [Number(team.id), team])
  );

  const poolMatches = matches.filter((match) => match.stage === 'pool');

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

  for (const team of teams) {
    team.gameDiff = team.wins - team.losses;
  }

  function getHeadToHeadDifference(teamAId: number, teamBId: number): number {
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
        if (Number(game.winner_team_id) === teamAId) winsA++;
        if (Number(game.winner_team_id) === teamBId) winsB++;
      }
    }

    return winsA - winsB;
  }

  return teams.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;

    if (b.gameDiff !== a.gameDiff) {
      return b.gameDiff - a.gameDiff;
    }

    const headToHead = getHeadToHeadDifference(Number(a.id), Number(b.id));

    if (headToHead !== 0) return -headToHead;

    return a.name.localeCompare(b.name, 'fr');
  });
}

/* =========================================================
   HISTORIQUE DES BO ET DES GAMES
   Aucun filtrage des joueurs exclus ici.
========================================================= */

// Résumé d'un BO, sans le détail des games.
export function buildMatchSummary(
  match: AnyObject,
  teamMap: Map<number, TeamInfo>,
  matchGames: AnyObject[],
  playerNames: PlayerNames
) {
  const team1 = teamMap.get(Number(match.team1_id));
  const team2 = teamMap.get(Number(match.team2_id));

  const winner =
    match.winner_team_id != null
      ? teamMap.get(Number(match.winner_team_id))
      : undefined;

  const mvpId = match.mvp_player_id ? Number(match.mvp_player_id) : null;

  const score1 = matchGames.filter(
    (game) => Number(game.winner_team_id) === Number(match.team1_id)
  ).length;

  const score2 = matchGames.filter(
    (game) => Number(game.winner_team_id) === Number(match.team2_id)
  ).length;

  const formatTeam = (team: TeamInfo | undefined, score?: number) =>
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

    mvpPlayerId: mvpId,

    mvpRiotId:
      mvpId !== null && playerNames.has(mvpId)
        ? String(playerNames.get(mvpId) ?? '')
        : null,

    team1: formatTeam(team1, score1),
    team2: formatTeam(team2, score2),
    winner: formatTeam(winner),
  };
}

// Détail des games d'un BO : joueurs officiels + remplaçants.
export function buildMatchGames(
  matchGames: AnyObject[],
  statsByGame: Map<number, AnyObject[]>,
  teamMap: Map<number, TeamInfo>,
  playerNames: PlayerNames,
  championMap: Map<string, Champion>
) {
  return [...matchGames]
    .sort((a, b) => Number(a.game_number) - Number(b.game_number))
    .map((game) => {
      const gameWinner = teamMap.get(Number(game.winner_team_id));

      const officialGameStats = (statsByGame.get(Number(game.id)) || []).map(
        (stat) => {
          const playerId = Number(stat.player_id);
          const team = teamMap.get(Number(stat.team_id));

          const championId = String(stat.champion_id ?? '');
          const champion = championMap.get(championId);

          return {
            playerId,

            riotId: playerNames.has(playerId)
              ? String(playerNames.get(playerId) ?? `Joueur ${stat.player_id}`)
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
        }
      );

      // Remplaçants : historique uniquement.
      const rawSubstitutes = Array.isArray(game.substitute_stats)
        ? game.substitute_stats
        : [];

      const substituteGameStats = rawSubstitutes
        .map((sub: AnyObject) => {
          const teamId = Number(sub.teamId ?? sub.team_id);
          const team = teamMap.get(teamId);

          const championId = String(sub.championId ?? sub.champion_id ?? '');
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
          (sub: AnyObject) =>
            Number.isFinite(sub.teamId) &&
            sub.role !== null &&
            sub.championId !== ''
        );

      const gameStats = [...officialGameStats, ...substituteGameStats].sort(
        (a, b) => {
          if (a.teamId !== b.teamId) return a.teamId - b.teamId;

          return roleOrder(a.role) - roleOrder(b.role);
        }
      );

      return {
        id: Number(game.id),
        gameNumber: Number(game.game_number),
        durationSeconds: Number(game.duration_seconds),
        winnerTeamId: Number(game.winner_team_id),
        winnerName: gameWinner?.name ?? null,
        players: gameStats,
      };
    });
}

/* =========================================================
   STATISTIQUES INDIVIDUELLES D'UNE DIVISION
   Lit la vue czf_current_player_stats (joueurs encore au même
   rôle dans la même équipe) + exclusions manuelles.
========================================================= */

export function computePlayerStats(
  division: Division,
  data: {
    matches: AnyObject[];
    games: AnyObject[];
    currentStats: AnyObject[];
    teamMap: Map<number, TeamInfo>;
    playerNames: PlayerNames;
    exclusions: Set<string>;
  }
): Record<Role, PlayerStats[]> {
  const { matches, games, currentStats, teamMap, playerNames, exclusions } =
    data;

  const isExcluded = (playerId: number, role: Role) =>
    exclusions.has(`${playerId}:ALL`) || exclusions.has(`${playerId}:${role}`);

  const matchMap = new Map<number, AnyObject>(
    matches.map((match) => [Number(match.id), match])
  );

  const gameMap = new Map<number, AnyObject>(
    games.map((game) => [Number(game.id), game])
  );

  const divisionMatchIds = new Set(
    matches.filter((m) => m.division === division).map((m) => Number(m.id))
  );

  const divisionGameIds = new Set(
    games
      .filter((g) => divisionMatchIds.has(Number(g.match_id)))
      .map((g) => Number(g.id))
  );

  const result = emptyRoleStats<PlayerStats>();
  const playerRoleKeys = new Set<string>();

  for (const stat of currentStats) {
    if (!divisionGameIds.has(Number(stat.game_id))) continue;

    const role = normalizeRole(stat.role);

    if (!role) continue;
    if (isExcluded(Number(stat.player_id), role)) continue;

    playerRoleKeys.add(`${Number(stat.player_id)}:${role}`);
  }

  for (const key of playerRoleKeys) {
    const [playerIdRaw, roleRaw] = key.split(':');

    const playerId = Number(playerIdRaw);
    const role = roleRaw as Role;

    const rows = currentStats.filter(
      (stat) =>
        Number(stat.player_id) === playerId &&
        normalizeRole(stat.role) === role &&
        divisionGameIds.has(Number(stat.game_id))
    );

    if (!rows.length) continue;

    const teamId = Number(rows[0].team_id);
    const team = teamMap.get(teamId);

    if (!team || !playerNames.has(playerId)) continue;

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

      if (Number(game.winner_team_id) === Number(row.team_id)) {
        wins++;
      } else {
        losses++;
      }

      playerMatchIds.add(Number(game.match_id));
    }

    let mvp = 0;

    for (const matchId of playerMatchIds) {
      const match = matchMap.get(matchId);

      if (match && Number(match.mvp_player_id) === playerId) {
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
      riotId: String(playerNames.get(playerId) ?? `Joueur ${playerId}`),
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
      csPerMin: minutes > 0 ? round2(cs / minutes) : 0,

      gold: Math.round(gold / gamesPlayed),
      goldPerMin: minutes > 0 ? round2(gold / minutes) : 0,

      damage: Math.round(damage / gamesPlayed),
      dpm: minutes > 0 ? round2(damage / minutes) : 0,

      visionScore: minutes > 0 ? round2(visionScore / minutes) : 0,

      mvp,
      totalDurationSeconds: duration,
    });
  }

  for (const role of ROLES) {
    result[role].sort((a, b) => b.kda - a.kda);
  }

  return result;
}

/* =========================================================
   STATISTIQUES CHAMPIONS D'UNE DIVISION
   Aucune exclusion : données historiques complètes.
========================================================= */

export function computeChampionStats(
  division: Division,
  data: {
    matches: AnyObject[];
    games: AnyObject[];
    stats: AnyObject[];
    championMap: Map<string, Champion>;
  }
): Record<Role, ChampionRoleStat[]> {
  const { matches, games, stats, championMap } = data;

  const gameMap = new Map<number, AnyObject>(
    games.map((game) => [Number(game.id), game])
  );

  const divisionMatches = matches.filter((m) => m.division === division);

  const divisionMatchIds = new Set(divisionMatches.map((m) => Number(m.id)));

  const divisionGameIds = new Set(
    games
      .filter((g) => divisionMatchIds.has(Number(g.match_id)))
      .map((g) => Number(g.id))
  );

  const totalBos = divisionMatches.length;
  const result = emptyRoleStats<ChampionRoleStat>();

  for (const role of ROLES) {
    const rows = stats.filter(
      (stat) =>
        divisionGameIds.has(Number(stat.game_id)) &&
        normalizeRole(stat.role) === role
    );

    const map = new Map<
      string,
      { picks: number; wins: number; matchIds: Set<number> }
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

      if (Number(game.winner_team_id) === Number(row.team_id)) {
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
              ? round2((values.matchIds.size / totalBos) * 100)
              : 0,

          winRate:
            values.picks > 0 ? round2((values.wins / values.picks) * 100) : 0,
        };
      })
      .sort((a, b) => b.picks - a.picks || b.winRate - a.winRate)
      .slice(0, 5);
  }

  return result;
}
