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
  // Games gagnées / perdues.
  wins: number;
  losses: number;

  // Différence de games.
  gameDiff: number;

  // Points de poule :
  // 2-0 = 3 pts
  // 1-1 = 1 pt chacun
  // 0-2 = 0 pt
  points: number;

  // Place dans sa division ; deux équipes à égalité parfaite partagent la même.
  rank?: number;
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

  // Kill participation sur les games réellement jouées :
  // (kills + assists du joueur) / kills de son équipe sur ces mêmes games * 100
  killParticipation: number;

  // Part du gold total de l'équipe sur les games réellement jouées.
  goldShare: number;

  // Part des dégâts champions totaux de l'équipe sur les games réellement jouées.
  damageShare: number;

  mvp: number;
  totalDurationSeconds: number;
  // A joué assez de games de son équipe pour figurer dans les classements.
  qualified: boolean;
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
  // Joueurs de ce champion à ce rôle, du plus de games au moins.
  players: ChampionPlayerStat[];
};

export type ChampionPlayerStat = {
  playerId: number;
  riotId: string;
  teamShortName: string | null;
  teamLogo: string | null;
  games: number;
  wins: number;
  winRate: number;
  kda: number;
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

// Date du dernier résultat ajouté (ISO), ou null sans match.
export function lastResultUpdate(matches: AnyObject[]): string | null {
  let latest: string | null = null;

  for (const match of matches) {
    const date = match.created_at || match.played_at;
    if (date && (!latest || new Date(date) > new Date(latest))) latest = date;
  }

  return latest;
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

   wins / losses = games gagnées / perdues.

   Points :
   2-0 = 3 points
   1-1 = 1 point chacun
   0-2 = 0 point

   Le classement est trié d'abord par points.
========================================================= */

export function computeStandings<T extends StandingTeam>(
  teams: T[],
  matches: AnyObject[],
  gamesByMatch: Map<number, AnyObject[]>
): T[] {
  /*
   * Sécurité :
   * certaines routes peuvent envoyer les équipes sans avoir
   * initialisé tous les champs du classement.
   *
   * Sans ça :
   * undefined + 3 = NaN
   * puis JSON transforme NaN en null.
   */
  for (const team of teams) {
    team.wins = Number(team.wins) || 0;
    team.losses = Number(team.losses) || 0;
    team.gameDiff = Number(team.gameDiff) || 0;
    team.points = Number(team.points) || 0;
  }

  const teamMap = new Map<number, T>(
    teams.map((team) => [Number(team.id), team])
  );

  const poolMatches = matches.filter(
    (match) => match.stage === 'pool'
  );

  for (const match of poolMatches) {
    const team1 = teamMap.get(Number(match.team1_id));
    const team2 = teamMap.get(Number(match.team2_id));

    if (!team1 || !team2) continue;

    const matchGames =
      gamesByMatch.get(Number(match.id)) || [];

    let team1GameWins = 0;
    let team2GameWins = 0;

    /*
     * V-D = nombre de GAMES gagnées / perdues.
     */
    for (const game of matchGames) {
      const winnerId =
        Number(game.winner_team_id);

      if (winnerId === Number(team1.id)) {
        team1GameWins++;

        team1.wins++;
        team2.losses++;
      } else if (
        winnerId === Number(team2.id)
      ) {
        team2GameWins++;

        team2.wins++;
        team1.losses++;
      }
    }

    /*
     * Les points ne sont attribués que lorsque
     * les 2 games du BO2 sont enregistrées.
     */
    if (
      team1GameWins + team2GameWins !== 2
    ) {
      continue;
    }

    /*
     * 2-0 = 3 points
     */
    if (
      team1GameWins === 2 &&
      team2GameWins === 0
    ) {
      team1.points += 3;
      continue;
    }

    /*
     * 0-2 = 3 points pour l'autre équipe
     */
    if (
      team2GameWins === 2 &&
      team1GameWins === 0
    ) {
      team2.points += 3;
      continue;
    }

    /*
     * 1-1 = 1 point chacun
     */
    if (
      team1GameWins === 1 &&
      team2GameWins === 1
    ) {
      team1.points += 1;
      team2.points += 1;
    }
  }

  /*
   * Différence de games.
   */
  for (const team of teams) {
    team.gameDiff =
      team.wins - team.losses;
  }

  /*
   * Confrontation directe.
   */
  function getHeadToHeadDifference(
    teamAId: number,
    teamBId: number
  ): number {
    let winsA = 0;
    let winsB = 0;

    for (const match of poolMatches) {
      const team1Id =
        Number(match.team1_id);

      const team2Id =
        Number(match.team2_id);

      const concernsBothTeams =
        (team1Id === teamAId &&
          team2Id === teamBId) ||
        (team1Id === teamBId &&
          team2Id === teamAId);

      if (!concernsBothTeams) {
        continue;
      }

      for (
        const game of
        gamesByMatch.get(
          Number(match.id)
        ) || []
      ) {
        const winnerId =
          Number(game.winner_team_id);

        if (winnerId === teamAId) {
          winsA++;
        }

        if (winnerId === teamBId) {
          winsB++;
        }
      }
    }

    return winsA - winsB;
  }

  /*
   * ORDRE DU CLASSEMENT
   *
   * 1. Points
   * 2. Différence de games
   * 3. Games gagnées
   * 4. Confrontation directe
   */
  function compare(
    a: T,
    b: T
  ): number {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (
      b.gameDiff !== a.gameDiff
    ) {
      return (
        b.gameDiff -
        a.gameDiff
      );
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return -getHeadToHeadDifference(
      Number(a.id),
      Number(b.id)
    );
  }

  teams.sort(
    (a, b) =>
      compare(a, b) ||
      a.name.localeCompare(
        b.name,
        'fr'
      )
  );

  /*
   * Places dans chaque division.
   */
  const lastByDivision =
    new Map<
      string,
      {
        team: T;
        position: number;
      }
    >();

  for (const team of teams) {
    const key =
      String(team.division ?? '');

    const previous =
      lastByDivision.get(key);

    const position =
      (previous?.position ?? 0) +
      1;

    team.rank =
      previous &&
      compare(
        previous.team,
        team
      ) === 0
        ? previous.team.rank
        : position;

    lastByDivision.set(key, {
      team,
      position,
    });
  }

  return teams;
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

// Part minimale des games de son équipe qu'un joueur doit avoir jouées
// pour apparaître dans les classements de stats (pas dans le classement MVP).
export const MIN_TEAM_GAMES_SHARE = 0.45;

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

  // Games jouées par chaque équipe dans la division.
  const teamGames = new Map<number, number>();

  for (const gameId of divisionGameIds) {
    const match = matchMap.get(Number(gameMap.get(gameId)?.match_id));

    for (const teamId of [Number(match?.team1_id), Number(match?.team2_id)]) {
      if (Number.isFinite(teamId)) {
        teamGames.set(
          teamId,
          (teamGames.get(teamId) ?? 0) + 1
        );
      }
    }
  }

  /*
   * Totaux d'équipe par game.
   *
   * Ils servent à calculer, pour chaque joueur et uniquement sur les
   * games qu'il a réellement jouées :
   *
   * - KP %
   * - Gold Share %
   * - Damage Share %
   *
   * clé = "<gameId>:<teamId>"
   */
  const teamKillsByGame = new Map<string, number>();
  const teamGoldByGame = new Map<string, number>();
  const teamDamageByGame = new Map<string, number>();

  for (const stat of currentStats) {
    const gameId = Number(stat.game_id);
    const teamId = Number(stat.team_id);

    if (!divisionGameIds.has(gameId)) continue;
    if (!Number.isFinite(teamId)) continue;

    const key = `${gameId}:${teamId}`;

    teamKillsByGame.set(
      key,
      (teamKillsByGame.get(key) ?? 0) +
        (Number(stat.kills) || 0)
    );

    teamGoldByGame.set(
      key,
      (teamGoldByGame.get(key) ?? 0) +
        (Number(stat.gold) || 0)
    );

    teamDamageByGame.set(
      key,
      (teamDamageByGame.get(key) ?? 0) +
        (Number(stat.damage) || 0)
    );
  }

  /*
   * Les remplaçants ne sont pas forcément présents dans currentStats.
   * On ajoute donc leurs valeurs stockées directement sur la game.
   */
  for (const gameId of divisionGameIds) {
    const game = gameMap.get(gameId);

    const substitutes = Array.isArray(game?.substitute_stats)
      ? game.substitute_stats
      : [];

    for (const sub of substitutes) {
      const teamId = Number(sub.teamId ?? sub.team_id);

      if (!Number.isFinite(teamId)) continue;

      const key = `${gameId}:${teamId}`;

      teamKillsByGame.set(
        key,
        (teamKillsByGame.get(key) ?? 0) +
          (Number(sub.kills) || 0)
      );

      teamGoldByGame.set(
        key,
        (teamGoldByGame.get(key) ?? 0) +
          (Number(sub.gold) || 0)
      );

      teamDamageByGame.set(
        key,
        (teamDamageByGame.get(key) ?? 0) +
          (Number(sub.damage) || 0)
      );
    }
  }

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

    let teamKillsWhilePlayerPlayed = 0;
    let teamGoldWhilePlayerPlayed = 0;
    let teamDamageWhilePlayerPlayed = 0;

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

      const teamGameKey =
        `${Number(row.game_id)}:${Number(row.team_id)}`;

      teamKillsWhilePlayerPlayed +=
        teamKillsByGame.get(teamGameKey) ?? 0;

      teamGoldWhilePlayerPlayed +=
        teamGoldByGame.get(teamGameKey) ?? 0;

      teamDamageWhilePlayerPlayed +=
        teamDamageByGame.get(teamGameKey) ?? 0;

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

    const killParticipation =
      teamKillsWhilePlayerPlayed > 0
        ? round2(
            ((kills + assists) / teamKillsWhilePlayerPlayed) * 100
          )
        : 0;

    const goldShare =
      teamGoldWhilePlayerPlayed > 0
        ? round2(
            (gold / teamGoldWhilePlayerPlayed) * 100
          )
        : 0;

    const damageShare =
      teamDamageWhilePlayerPlayed > 0
        ? round2(
            (damage / teamDamageWhilePlayerPlayed) * 100
          )
        : 0;

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

      killParticipation,
      goldShare,
      damageShare,

      mvp,
      totalDurationSeconds: duration,

      qualified:
        gamesPlayed >=
        MIN_TEAM_GAMES_SHARE * (teamGames.get(teamId) ?? 0),
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
   Tous les champions joués, triés : la page affiche le top 10
   et permet de rechercher les autres.
========================================================= */

export function computeChampionStats(
  division: Division,
  data: {
    matches: AnyObject[];
    games: AnyObject[];
    stats: AnyObject[];
    championMap: Map<string, Champion>;
    // Sans eux, les joueurs sont nommés « Joueur <id> », sans logo.
    playerNames?: PlayerNames;
    teamMap?: Map<number, TeamInfo>;
  }
): Record<Role, ChampionRoleStat[]> {
  const { matches, games, stats, championMap, playerNames, teamMap } = data;

  const gameMap = new Map<number, AnyObject>(
    games.map((game) => [Number(game.id), game])
  );

  const divisionMatches = matches.filter((m) => m.division === division);

  const divisionMatchIds = new Set(
    divisionMatches.map((m) => Number(m.id))
  );

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

    type PlayerTotals = {
      games: number;
      wins: number;
      kdaSum: number;
      teamId: number;
    };

    const map = new Map<
      string,
      {
        picks: number;
        wins: number;
        matchIds: Set<number>;
        players: Map<number, PlayerTotals>;
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
        players: new Map<number, PlayerTotals>(),
      };

      const won =
        Number(game.winner_team_id) === Number(row.team_id);

      current.picks++;

      if (won) {
        current.wins++;
      }

      current.matchIds.add(Number(game.match_id));

      const playerId = Number(row.player_id);

      if (Number.isFinite(playerId)) {
        const player = current.players.get(playerId) || {
          games: 0,
          wins: 0,
          kdaSum: 0,
          teamId: Number(row.team_id),
        };

        player.games++;

        if (won) {
          player.wins++;
        }

        // KDA : moyenne des ratios par game, comme les stats joueurs.
        player.kdaSum +=
          ((Number(row.kills) || 0) +
            (Number(row.assists) || 0)) /
          Math.max(1, Number(row.deaths) || 0);

        current.players.set(playerId, player);
      }

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

          players: [...values.players.entries()]
            .map(
              ([playerId, player]): ChampionPlayerStat => {
                const team = teamMap?.get(player.teamId);

                return {
                  playerId,

                  riotId: String(
                    playerNames?.get(playerId) ??
                      `Joueur ${playerId}`
                  ),

                  teamShortName:
                    team?.shortName ?? null,

                  teamLogo:
                    team?.logo ?? null,

                  games: player.games,
                  wins: player.wins,

                  winRate: round2(
                    (player.wins / player.games) * 100
                  ),

                  kda: round2(
                    player.kdaSum / player.games
                  ),
                };
              }
            )
            .sort(
              (a, b) =>
                b.games - a.games ||
                b.winRate - a.winRate ||
                b.kda - a.kda
            ),
        };
      })
      .sort(
        (a, b) =>
          b.picks - a.picks ||
          b.winRate - a.winRate
      );
  }

  return result;
}

/* =========================================================
   CHAMPIONS JOUÉS PAR UN JOUEUR OU UNE ÉQUIPE
   (pages Profil et Mon équipe)
   Toutes divisions, données historiques complètes.
========================================================= */

export type PlayerChampionStat = {
  championId: string;
  name: string;
  image: string | null;
  // Rôles où il a joué ce champion, du plus joué au moins joué.
  roles: Role[];
  games: number;
  wins: number;
  winRate: number;
  kda: number;
};

type ChampionTotalsData = {
  games: AnyObject[];
  stats: AnyObject[];
  championMap: Map<string, Champion>;
};

export function computePlayerChampions(
  playerId: number,
  data: ChampionTotalsData
): PlayerChampionStat[] {
  return computeChampionTotals({
    ...data,
    stats: data.stats.filter(
      (row) => Number(row.player_id) === playerId
    ),
  });
}

// Champions d'une équipe (toutes ses games, puis rôle par rôle) et de chacun
// de ses joueurs dans cette équipe.
export function computeTeamChampions(
  teamId: number,
  data: ChampionTotalsData
): {
  team: PlayerChampionStat[];
  byRole: Record<Role, PlayerChampionStat[]>;
  players: Record<number, PlayerChampionStat[]>;
} {
  const rows = data.stats.filter(
    (row) => Number(row.team_id) === teamId
  );

  const byPlayer = groupBy(
    rows,
    (row) => Number(row.player_id)
  );

  return {
    team: computeChampionTotals({
      ...data,
      stats: rows,
    }),

    byRole: Object.fromEntries(
      ROLES.map((role) => [
        role,

        computeChampionTotals({
          ...data,

          stats: rows.filter(
            (row) =>
              normalizeRole(row.role) === role
          ),
        }),
      ])
    ) as Record<Role, PlayerChampionStat[]>,

    players: Object.fromEntries(
      [...byPlayer.entries()].map(
        ([playerId, playerRows]) => [
          playerId,

          computeChampionTotals({
            ...data,
            stats: playerRows,
          }),
        ]
      )
    ),
  };
}

function computeChampionTotals(
  data: ChampionTotalsData
): PlayerChampionStat[] {
  const {
    games,
    stats,
    championMap,
  } = data;

  const gameMap = new Map<number, AnyObject>(
    games.map((game) => [
      Number(game.id),
      game,
    ])
  );

  const map = new Map<
    string,
    {
      games: number;
      wins: number;
      kdaSum: number;
      roles: Map<Role, number>;
    }
  >();

  for (const row of stats) {
    const championId =
      String(row.champion_id ?? '');

    const game =
      gameMap.get(Number(row.game_id));

    if (!championId || !game) continue;

    const current =
      map.get(championId) || {
        games: 0,
        wins: 0,
        kdaSum: 0,
        roles: new Map<Role, number>(),
      };

    current.games++;

    if (
      Number(game.winner_team_id) ===
      Number(row.team_id)
    ) {
      current.wins++;
    }

    // KDA : moyenne des ratios par game, comme les stats joueurs.
    current.kdaSum +=
      ((Number(row.kills) || 0) +
        (Number(row.assists) || 0)) /
      Math.max(
        1,
        Number(row.deaths) || 0
      );

    const role = normalizeRole(row.role);

    if (role) {
      current.roles.set(
        role,
        (current.roles.get(role) ?? 0) + 1
      );
    }

    map.set(
      championId,
      current
    );
  }

  return [...map.entries()]
    .map(([championId, values]) => {
      const champion =
        championMap.get(championId);

      return {
        championId,

        name:
          champion?.name ??
          championId,

        image:
          champion?.image ??
          null,

        roles: [...values.roles.entries()]
          .sort(
            (a, b) =>
              b[1] - a[1]
          )
          .map(
            ([role]) => role
          ),

        games:
          values.games,

        wins:
          values.wins,

        winRate:
          round2(
            (values.wins /
              values.games) *
              100
          ),

        kda:
          round2(
            values.kdaSum /
              values.games
          ),
      };
    })
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.winRate - a.winRate ||
        b.kda - a.kda
    );
}