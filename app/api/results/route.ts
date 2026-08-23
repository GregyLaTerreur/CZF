import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnyObject =
  Record<string, any>;

type Division =
  | 'Yordle'
  | 'Ixtal'
  | 'Targon';

type Role =
  | 'Top'
  | 'Jungle'
  | 'Mid'
  | 'ADC'
  | 'Support';

const ROLES: Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

type ResultPlayer = {
  id:
    | string
    | number
    | null;

  riotId: string;

  discordName:
    | string
    | null;

  role:
    | string
    | null;

  avatar:
    | string
    | null;
};

type ResultTeam = {
  id:
    | string
    | number;

  name: string;
  shortName: string;

  logo:
    | string
    | null;

  division:
    | Division
    | null;

  wins: number;
  losses: number;

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

  teamLogo:
    | string
    | null;

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

  mvp: number;

  totalDurationSeconds:
    number;
};

type ChampionRoleStat = {
  championId: string;

  name: string;

  image:
    | string
    | null;

  role: Role;

  picks: number;

  wins: number;
  losses: number;

  pickRate: number;
  winRate: number;
};

/* =========================================================
   SUPABASE
========================================================= */

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env
    .SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL manquant'
  );
}

if (!serviceRoleKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY manquant'
  );
}

const supabaseAdmin =
  createClient(
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
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const origin =
      request.nextUrl.origin;

    /* =====================================================
       DONNEES EXISTANTES DU SITE
    ===================================================== */

    const [
      teamsResult,
      membersResult,
      playersResult,
    ] =
      await Promise.allSettled([
        fetch(
          `${origin}/api/teams`,
          {
            cache: 'no-store',
          }
        ),

        fetch(
          `${origin}/api/team-members`,
          {
            cache: 'no-store',
          }
        ),

        fetch(
          `${origin}/api/players`,
          {
            cache: 'no-store',
          }
        ),
      ]);

    const teamsData =
      await readSettledResponse(
        teamsResult
      );

    const membersData =
      await readSettledResponse(
        membersResult
      );

    const playersData =
      await readSettledResponse(
        playersResult
      );

    const rawTeams =
      extractArray(
        teamsData,
        [
          'teams',
          'data',
        ]
      );

    const rawMembers =
      extractArray(
        membersData,
        [
          'members',
          'teamMembers',
          'team_members',
          'data',
        ]
      );

    const rawPlayers =
      extractArray(
        playersData,
        [
          'players',
          'data',
        ]
      );

    /* =====================================================
       TEAMS VALIDEES
    ===================================================== */

    const validatedTeams =
      rawTeams.filter(
        (
          team: AnyObject
        ) =>
          isValidated(
            team
          )
      );

    /* =====================================================
       CONSTRUCTION ROSTERS
    ===================================================== */

    let resultTeams:
      ResultTeam[] =
      validatedTeams.map(
        (
          team: AnyObject
        ) => {
          const teamId =
            getValue(
              team,
              [
                'id',
                'team_id',
                'teamId',
              ]
            );

          const teamMembers =
            rawMembers.filter(
              (
                member:
                  AnyObject
              ) => {
                const memberTeamId =
                  getValue(
                    member,
                    [
                      'team_id',
                      'teamId',
                      'team',
                    ]
                  );

                return (
                  String(
                    memberTeamId
                  ) ===
                  String(
                    teamId
                  )
                );
              }
            );

          const roster =
            teamMembers
              .map(
                (
                  member:
                    AnyObject
                ): ResultPlayer => {
                  const riotId =
                    String(
                      getValue(
                        member,
                        [
                          'riot_id',
                          'riotId',
                          'summoner_name',
                          'summonerName',
                        ]
                      ) ??
                        ''
                    );

                  const player =
                    findPlayer(
                      rawPlayers,
                      riotId,
                      member
                    );

                  return {
                    id:
                      getValue(
                        player,
                        [
                          'id',
                          'player_id',
                          'playerId',
                        ]
                      ) ??
                      getValue(
                        member,
                        [
                          'player_id',
                          'playerId',
                          'id',
                        ]
                      ) ??
                      null,

                    riotId:
                      riotId ||
                      String(
                        getValue(
                          player,
                          [
                            'riot_id',
                            'riotId',
                            'summoner_name',
                            'summonerName',
                          ]
                        ) ??
                          'Joueur'
                      ),

                    discordName:
                      stringOrNull(
                        getValue(
                          player,
                          [
                            'discord_name',
                            'discordName',
                            'discord_username',
                            'discordUsername',
                            'username',
                          ]
                        )
                      ),

                    role:
                      normalizeRole(
                        getValue(
                          member,
                          [
                            'role',
                            'position',
                          ]
                        ) ??
                          getValue(
                            player,
                            [
                              'role',
                              'position',
                            ]
                          )
                      ),

                    avatar:
                      stringOrNull(
                        getValue(
                          player,
                          [
                            'avatar',
                            'avatar_url',
                            'avatarUrl',
                            'discord_avatar',
                          ]
                        )
                      ),
                  };
                }
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  roleOrder(
                    a.role
                  ) -
                  roleOrder(
                    b.role
                  )
              );

          return {
            id: teamId,

            name:
              getTeamName(
                team
              ),

            shortName:
              getTeamShortName(
                team
              ),

            logo:
              getTeamLogo(
                team
              ),

            division:
              normalizeDivision(
                getValue(
                  team,
                  [
                    'division',
                    'division_name',
                    'divisionName',
                  ]
                )
              ),

            wins: 0,
            losses: 0,

            roster,
          };
        }
      );

    /* =====================================================
       CHAMPIONS
    ===================================================== */

    const champions =
      await getChampions();

    const championMap =
      new Map<
        string,
        Champion
      >();

    for (
      const champion
      of champions
    ) {
      championMap.set(
        champion.id,
        champion
      );
    }

    /* =====================================================
       MATCHS
    ===================================================== */

    const {
      data: matches,
      error: matchesError,
    } =
      await supabaseAdmin
        .from(
          'czf_matches'
        )
        .select('*')
        .eq(
          'status',
          'finished'
        )
        .order(
          'played_at',
          {
            ascending:
              false,
          }
        );

    if (
      matchesError
    ) {
      throw matchesError;
    }

    /* =====================================================
       GAMES
    ===================================================== */

    const {
      data: games,
      error: gamesError,
    } =
      await supabaseAdmin
        .from(
          'czf_games'
        )
        .select('*');

    if (
      gamesError
    ) {
      throw gamesError;
    }

    /* =====================================================
       STATS
    ===================================================== */

    const {
      data:
        playerStatsRows,
      error:
        playerStatsError,
    } =
      await supabaseAdmin
        .from(
          'czf_game_player_stats'
        )
        .select('*');

    if (
      playerStatsError
    ) {
      throw playerStatsError;
    }

    const allMatches =
      matches ?? [];

    const allGames =
      games ?? [];

    const allStats =
      playerStatsRows ??
      [];

    /* =====================================================
       MAP TEAMS
    ===================================================== */

    const teamMap =
      new Map<
        number,
        ResultTeam
      >();

    for (
      const team
      of resultTeams
    ) {
      teamMap.set(
        Number(
          team.id
        ),
        team
      );
    }

    /* =====================================================
       MAP PLAYERS
    ===================================================== */

    const playerMap =
      new Map<
        number,
        AnyObject
      >();

    for (
      const player
      of rawPlayers
    ) {
      const id =
        Number(
          getValue(
            player,
            [
              'id',
              'player_id',
              'playerId',
            ]
          )
        );

      if (
        Number.isFinite(
          id
        )
      ) {
        playerMap.set(
          id,
          player
        );
      }
    }

    /* =====================================================
       MAP GAMES
    ===================================================== */

    const gameMap =
      new Map<
        number,
        AnyObject
      >();

    for (
      const game
      of allGames
    ) {
      gameMap.set(
        Number(
          game.id
        ),
        game
      );
    }

    /* =====================================================
       MATCH -> GAMES
    ===================================================== */

    const gamesByMatch =
      new Map<
        number,
        AnyObject[]
      >();

    for (
      const game
      of allGames
    ) {
      const matchId =
        Number(
          game.match_id
        );

      if (
        !gamesByMatch.has(
          matchId
        )
      ) {
        gamesByMatch.set(
          matchId,
          []
        );
      }

      gamesByMatch
        .get(
          matchId
        )!
        .push(
          game
        );
    }

    /* =====================================================
       CLASSEMENT POULES
    ===================================================== */

    const poolMatches =
      allMatches.filter(
        (
          match
        ) =>
          match.stage ===
          'pool'
      );

    for (
      const match
      of poolMatches
    ) {
      const team1 =
        teamMap.get(
          Number(
            match.team1_id
          )
        );

      const team2 =
        teamMap.get(
          Number(
            match.team2_id
          )
        );

      if (
        !team1 ||
        !team2
      ) {
        continue;
      }

      const winnerId =
        Number(
          match
            .winner_team_id
        );

      if (
        winnerId ===
        Number(
          team1.id
        )
      ) {
        team1.wins +=
          1;

        team2.losses +=
          1;
      } else if (
        winnerId ===
        Number(
          team2.id
        )
      ) {
        team2.wins +=
          1;

        team1.losses +=
          1;
      }
    }

    /* =====================================================
       TRI TEAMS
    ===================================================== */

    resultTeams =
      resultTeams.sort(
        (
          a,
          b
        ) => {
          if (
            b.wins !==
            a.wins
          ) {
            return (
              b.wins -
              a.wins
            );
          }

          if (
            a.losses !==
            b.losses
          ) {
            return (
              a.losses -
              b.losses
            );
          }

          return a.name.localeCompare(
            b.name,
            'fr'
          );
        }
      );

    /* =====================================================
       DIVISIONS
    ===================================================== */

    const divisions = {
      Yordle:
        resultTeams.filter(
          (
            team
          ) =>
            team.division ===
            'Yordle'
        ),

      Ixtal:
        resultTeams.filter(
          (
            team
          ) =>
            team.division ===
            'Ixtal'
        ),

      Targon:
        resultTeams.filter(
          (
            team
          ) =>
            team.division ===
            'Targon'
        ),
    };

    /* =====================================================
       HISTORIQUE
    ===================================================== */

    const history =
      allMatches.map(
        (
          match
        ) => {
          const team1 =
            teamMap.get(
              Number(
                match.team1_id
              )
            );

          const team2 =
            teamMap.get(
              Number(
                match.team2_id
              )
            );

          const winner =
            teamMap.get(
              Number(
                match
                  .winner_team_id
              )
            );

          const matchGames =
            (
              gamesByMatch.get(
                Number(
                  match.id
                )
              ) ??
              []
            ).sort(
              (
                a,
                b
              ) =>
                Number(
                  a.game_number
                ) -
                Number(
                  b.game_number
                )
            );

          const team1Score =
            matchGames.filter(
              (
                game
              ) =>
                Number(
                  game
                    .winner_team_id
                ) ===
                Number(
                  match
                    .team1_id
                )
            ).length;

          const team2Score =
            matchGames.filter(
              (
                game
              ) =>
                Number(
                  game
                    .winner_team_id
                ) ===
                Number(
                  match
                    .team2_id
                )
            ).length;

          return {
            id:
              Number(
                match.id
              ),

            division:
              match.division as Division,

            stage:
              match.stage,

            bracket:
              match.bracket,

            round:
              match.round,

            bestOf:
              Number(
                match.best_of
              ),

            playedAt:
              match.played_at,

            team1:
              team1
                ? {
                    id:
                      Number(
                        team1.id
                      ),

                    name:
                      team1.name,

                    shortName:
                      team1.shortName,

                    logo:
                      team1.logo,

                    score:
                      team1Score,
                  }
                : null,

            team2:
              team2
                ? {
                    id:
                      Number(
                        team2.id
                      ),

                    name:
                      team2.name,

                    shortName:
                      team2.shortName,

                    logo:
                      team2.logo,

                    score:
                      team2Score,
                  }
                : null,

            winner:
              winner
                ? {
                    id:
                      Number(
                        winner.id
                      ),

                    name:
                      winner.name,

                    shortName:
                      winner.shortName,

                    logo:
                      winner.logo,
                  }
                : null,

            games:
              matchGames.map(
                (
                  game
                ) => {
                  const gameWinner =
                    teamMap.get(
                      Number(
                        game
                          .winner_team_id
                      )
                    );

                  const mvpPlayer =
                    game
                      .mvp_player_id
                      ? playerMap.get(
                          Number(
                            game
                              .mvp_player_id
                          )
                        )
                      : null;

                  return {
                    id:
                      Number(
                        game.id
                      ),

                    gameNumber:
                      Number(
                        game
                          .game_number
                      ),

                    durationSeconds:
                      Number(
                        game
                          .duration_seconds
                      ),

                    winnerTeamId:
                      Number(
                        game
                          .winner_team_id
                      ),

                    winnerName:
                      gameWinner
                        ?.name ??
                      null,

                    mvpPlayerId:
                      game
                        .mvp_player_id
                        ? Number(
                            game
                              .mvp_player_id
                          )
                        : null,

                    mvpRiotId:
                      mvpPlayer
                        ? String(
                            getValue(
                              mvpPlayer,
                              [
                                'riot_id',
                                'riotId',
                              ]
                            ) ??
                              ''
                          )
                        : null,
                  };
                }
              ),
          };
        }
      );

    /* =====================================================
       HISTORIQUE PAR DIVISION
    ===================================================== */

    const historyByDivision = {
      Yordle:
        history.filter(
          (
            match
          ) =>
            match.division ===
            'Yordle'
        ),

      Ixtal:
        history.filter(
          (
            match
          ) =>
            match.division ===
            'Ixtal'
        ),

      Targon:
        history.filter(
          (
            match
          ) =>
            match.division ===
            'Targon'
        ),
    };

    /* =====================================================
       STATS PAR DIVISION
    ===================================================== */

    function statsForDivision(
      division: Division
    ): Record<
      Role,
      PlayerStats[]
    > {
      const divisionMatchIds =
        new Set<number>(
          allMatches
            .filter(
              (
                match
              ) =>
                match.division ===
                division
            )
            .map(
              (
                match
              ) =>
                Number(
                  match.id
                )
            )
        );

      const divisionGameIds =
        new Set<number>(
          allGames
            .filter(
              (
                game
              ) =>
                divisionMatchIds.has(
                  Number(
                    game.match_id
                  )
                )
            )
            .map(
              (
                game
              ) =>
                Number(
                  game.id
                )
            )
        );

      const result:
        Record<
          Role,
          PlayerStats[]
        > = {
        Top: [],
        Jungle: [],
        Mid: [],
        ADC: [],
        Support: [],
      };

      const playerRoleKeys =
        new Set<string>();

      for (
        const stat
        of allStats
      ) {
        if (
          !divisionGameIds.has(
            Number(
              stat.game_id
            )
          )
        ) {
          continue;
        }

        const role =
          normalizeRole(
            stat.role
          ) as
            | Role
            | null;

        if (
          !role ||
          !ROLES.includes(
            role
          )
        ) {
          continue;
        }

        playerRoleKeys.add(
          `${Number(
            stat.player_id
          )}:${role}`
        );
      }

      for (
        const key
        of playerRoleKeys
      ) {
        const [
          playerIdRaw,
          roleRaw,
        ] =
          key.split(':');

        const playerId =
          Number(
            playerIdRaw
          );

        const role =
          roleRaw as Role;

        const rows =
          allStats.filter(
            (
              stat
            ) =>
              Number(
                stat.player_id
              ) ===
                playerId &&
              normalizeRole(
                stat.role
              ) ===
                role &&
              divisionGameIds.has(
                Number(
                  stat.game_id
                )
              )
          );

        if (
          rows.length ===
          0
        ) {
          continue;
        }

        const first =
          rows[0];

        const teamId =
          Number(
            first.team_id
          );

        const team =
          teamMap.get(
            teamId
          );

        const rawPlayer =
          playerMap.get(
            playerId
          );

        if (
          !team ||
          !rawPlayer
        ) {
          continue;
        }

        let kills = 0;
        let deaths = 0;
        let assists = 0;

        let cs = 0;
        let gold = 0;
        let damage = 0;

        let wins = 0;
        let losses = 0;

        let duration = 0;
        let mvp = 0;

        for (
          const row
          of rows
        ) {
          const game =
            gameMap.get(
              Number(
                row.game_id
              )
            );

          if (
            !game
          ) {
            continue;
          }

          kills +=
            Number(
              row.kills
            ) || 0;

          deaths +=
            Number(
              row.deaths
            ) || 0;

          assists +=
            Number(
              row.assists
            ) || 0;

          cs +=
            Number(
              row.cs
            ) || 0;

          gold +=
            Number(
              row.gold
            ) || 0;

          damage +=
            Number(
              row.damage
            ) || 0;

          duration +=
            Number(
              game
                .duration_seconds
            ) || 0;

          if (
            Number(
              game
                .winner_team_id
            ) ===
            Number(
              row.team_id
            )
          ) {
            wins += 1;
          } else {
            losses += 1;
          }

          if (
            Number(
              game
                .mvp_player_id
            ) ===
            playerId
          ) {
            mvp += 1;
          }
        }

        const minutes =
          duration /
          60;

        const kda =
          deaths >
          0
            ? round2(
                (
                  kills +
                  assists
                ) /
                  deaths
              )
            : round2(
                kills +
                  assists
              );

        result[
          role
        ].push({
          playerId,

          riotId:
            String(
              getValue(
                rawPlayer,
                [
                  'riot_id',
                  'riotId',
                ]
              ) ??
                `Joueur ${playerId}`
            ),

          teamId,

          teamName:
            team.name,

          teamShortName:
            team.shortName,

          teamLogo:
            team.logo,

          role,

          games:
            rows.length,

          wins,
          losses,

          kills,
          deaths,
          assists,

          kda,

          cs,

          csPerMin:
            minutes >
            0
              ? round2(
                  cs /
                    minutes
                )
              : 0,

          gold,

          goldPerMin:
            minutes >
            0
              ? round2(
                  gold /
                    minutes
                )
              : 0,

          damage,

          dpm:
            minutes >
            0
              ? round2(
                  damage /
                    minutes
                )
              : 0,

          mvp,

          totalDurationSeconds:
            duration,
        });
      }

      for (
        const role
        of ROLES
      ) {
        result[
          role
        ].sort(
          (
            a,
            b
          ) =>
            b.kda -
            a.kda
        );
      }

      return result;
    }

    /* =====================================================
       CHAMPIONS PAR DIVISION
    ===================================================== */

    function championsForDivision(
      division: Division
    ): Record<
      Role,
      ChampionRoleStat[]
    > {
      const divisionMatchIds =
        new Set<number>(
          allMatches
            .filter(
              (
                match
              ) =>
                match.division ===
                division
            )
            .map(
              (
                match
              ) =>
                Number(
                  match.id
                )
            )
        );

      const divisionGameIds =
        new Set<number>(
          allGames
            .filter(
              (
                game
              ) =>
                divisionMatchIds.has(
                  Number(
                    game.match_id
                  )
                )
            )
            .map(
              (
                game
              ) =>
                Number(
                  game.id
                )
            )
        );

      const result:
        Record<
          Role,
          ChampionRoleStat[]
        > = {
        Top: [],
        Jungle: [],
        Mid: [],
        ADC: [],
        Support: [],
      };

      for (
        const role
        of ROLES
      ) {
        const roleRows =
          allStats.filter(
            (
              stat
            ) =>
              divisionGameIds.has(
                Number(
                  stat.game_id
                )
              ) &&
              normalizeRole(
                stat.role
              ) ===
                role
          );

        const total =
          roleRows.length;

        const map =
          new Map<
            string,
            {
              picks: number;
              wins: number;
            }
          >();

        for (
          const row
          of roleRows
        ) {
          const championId =
            String(
              row
                .champion_id ??
                ''
            );

          if (
            !championId
          ) {
            continue;
          }

          const game =
            gameMap.get(
              Number(
                row.game_id
              )
            );

          if (
            !game
          ) {
            continue;
          }

          const current =
            map.get(
              championId
            ) ?? {
              picks: 0,
              wins: 0,
            };

          current.picks +=
            1;

          if (
            Number(
              game
                .winner_team_id
            ) ===
            Number(
              row.team_id
            )
          ) {
            current.wins +=
              1;
          }

          map.set(
            championId,
            current
          );
        }

        result[
          role
        ] =
          Array.from(
            map.entries()
          )
            .map(
              ([
                championId,
                values,
              ]) => {
                const champion =
                  championMap.get(
                    championId
                  );

                return {
                  championId,

                  name:
                    champion
                      ?.name ??
                    championId,

                  image:
                    champion
                      ?.image ??
                    null,

                  role,

                  picks:
                    values.picks,

                  wins:
                    values.wins,

                  losses:
                    values.picks -
                    values.wins,

                  pickRate:
                    total >
                    0
                      ? round2(
                          (
                            values.picks /
                            total
                          ) *
                            100
                        )
                      : 0,

                  winRate:
                    values.picks >
                    0
                      ? round2(
                          (
                            values.wins /
                            values.picks
                          ) *
                            100
                        )
                      : 0,
                };
              }
            )
            .sort(
              (
                a,
                b
              ) => {
                if (
                  b.picks !==
                  a.picks
                ) {
                  return (
                    b.picks -
                    a.picks
                  );
                }

                return (
                  b.winRate -
                  a.winRate
                );
              }
            )
            .slice(
              0,
              3
            );
      }

      return result;
    }

    /* =====================================================
       RESULTATS PAR DIVISION
    ===================================================== */

    const playerStatsByDivision = {
      Yordle:
        statsForDivision(
          'Yordle'
        ),

      Ixtal:
        statsForDivision(
          'Ixtal'
        ),

      Targon:
        statsForDivision(
          'Targon'
        ),
    };

    const championsByDivision = {
      Yordle:
        championsForDivision(
          'Yordle'
        ),

      Ixtal:
        championsForDivision(
          'Ixtal'
        ),

      Targon:
        championsForDivision(
          'Targon'
        ),
    };

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        divisions,

        teams:
          resultTeams,

        champions,

        history,

        historyByDivision,

        playerStatsByDivision,

        championsByDivision,

        divisionAssets: {
          Yordle: {
            color:
              '#51a677',

            logo:
              '/assets/divisions/yordle.png',
          },

          Ixtal: {
            color:
              '#4387d8',

            logo:
              '/assets/divisions/ixtal.png',
          },

          Targon: {
            color:
              '#8f6bc7',

            logo:
              '/assets/divisions/targon.png',
          },
        },

        roles: [
          {
            id: 'Top',
            label: 'TOP',
            icon:
              '/assets/roles/top.png',
          },

          {
            id: 'Jungle',
            label: 'JGL',
            icon:
              '/assets/roles/jungle.png',
          },

          {
            id: 'Mid',
            label: 'MID',
            icon:
              '/assets/roles/mid.png',
          },

          {
            id: 'ADC',
            label: 'ADC',
            icon:
              '/assets/roles/adc.png',
          },

          {
            id: 'Support',
            label: 'SUP',
            icon:
              '/assets/roles/sup.png',
          },
        ],

        debug: {
          rawTeams:
            rawTeams.length,

          validatedTeams:
            resultTeams.length,

          members:
            rawMembers.length,

          players:
            rawPlayers.length,

          champions:
            champions.length,

          matches:
            allMatches.length,

          games:
            allGames.length,

          gamePlayerStats:
            allStats.length,

          yordle:
            divisions
              .Yordle
              .length,

          ixtal:
            divisions
              .Ixtal
              .length,

          targon:
            divisions
              .Targon
              .length,
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      '[RESULTS API]',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
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
          Yordle:
            emptyRoleStats(),

          Ixtal:
            emptyRoleStats(),

          Targon:
            emptyRoleStats(),
        },

        championsByDivision: {
          Yordle:
            emptyRoleStats(),

          Ixtal:
            emptyRoleStats(),

          Targon:
            emptyRoleStats(),
        },
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   CHAMPIONS RIOT
========================================================= */

async function getChampions(): Promise<
  Champion[]
> {
  try {
    const versionsResponse =
      await fetch(
        'https://ddragon.leagueoflegends.com/api/versions.json',
        {
          next: {
            revalidate:
              86400,
          },
        }
      );

    if (
      !versionsResponse.ok
    ) {
      return [];
    }

    const versions =
      await versionsResponse.json();

    const version =
      versions?.[0];

    if (
      !version
    ) {
      return [];
    }

    const championsResponse =
      await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`,
        {
          next: {
            revalidate:
              86400,
          },
        }
      );

    if (
      !championsResponse.ok
    ) {
      return [];
    }

    const championsData =
      await championsResponse.json();

    const championsObject =
      championsData
        ?.data ??
      {};

    return Object.values(
      championsObject
    )
      .map(
        (
          champion:
            any
        ): Champion => ({
          id:
            champion.id,

          key:
            champion.key,

          name:
            champion.name,

          image:
            `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          a.name.localeCompare(
            b.name,
            'fr'
          )
      );
  } catch (
    error
  ) {
    console.error(
      '[RESULTS CHAMPIONS]',
      error
    );

    return [];
  }
}

/* =========================================================
   HELPERS API
========================================================= */

async function readSettledResponse(
  result:
    PromiseSettledResult<Response>
): Promise<any> {
  if (
    result.status !==
    'fulfilled'
  ) {
    return null;
  }

  const response =
    result.value;

  if (
    !response.ok
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractArray(
  data: any,
  possibleKeys:
    string[]
): AnyObject[] {
  if (
    Array.isArray(
      data
    )
  ) {
    return data;
  }

  if (
    !data ||
    typeof data !==
      'object'
  ) {
    return [];
  }

  for (
    const key
    of possibleKeys
  ) {
    if (
      Array.isArray(
        data[
          key
        ]
      )
    ) {
      return data[
        key
      ];
    }
  }

  return [];
}

/* =========================================================
   HELPERS GENERIQUES
========================================================= */

function getValue(
  object:
    | AnyObject
    | null
    | undefined,

  keys:
    string[]
) {
  if (
    !object
  ) {
    return undefined;
  }

  for (
    const key
    of keys
  ) {
    if (
      object[
        key
      ] !== undefined &&
      object[
        key
      ] !== null
    ) {
      return object[
        key
      ];
    }
  }

  return undefined;
}

function stringOrNull(
  value: any
):
  | string
  | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  return String(
    value
  );
}

function round2(
  value: number
) {
  return (
    Math.round(
      value *
        100
    ) /
    100
  );
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

/* =========================================================
   VALIDATION TEAM
========================================================= */

function isValidated(
  team:
    AnyObject
) {
  const value =
    getValue(
      team,
      [
        'validated_by_admin',
        'validatedByAdmin',
      ]
    );

  return (
    value ===
      true ||
    value ===
      1 ||
    value ===
      '1' ||
    String(
      value
    ).toLowerCase() ===
      'true'
  );
}

/* =========================================================
   TEAM
========================================================= */

function getTeamName(
  team:
    AnyObject
) {
  return String(
    getValue(
      team,
      [
        'name',
        'team_name',
        'teamName',
      ]
    ) ??
      'Équipe'
  );
}

function getTeamShortName(
  team:
    AnyObject
) {
  const existing =
    getValue(
      team,
      [
        'short_name',
        'shortName',
        'tag',
        'acronym',
      ]
    );

  if (
    existing
  ) {
    return String(
      existing
    ).toUpperCase();
  }

  const name =
    getTeamName(
      team
    );

  const words =
    name
      .trim()
      .split(
        /\s+/
      );

  if (
    words.length >
    1
  ) {
    return words
      .map(
        (
          word
        ) =>
          word.charAt(
            0
          )
      )
      .join('')
      .slice(
        0,
        4
      )
      .toUpperCase();
  }

  return name
    .slice(
      0,
      4
    )
    .toUpperCase();
}

function getTeamLogo(
  team:
    AnyObject
):
  | string
  | null {
  return stringOrNull(
    getValue(
      team,
      [
        'logo',
        'logo_url',
        'logoUrl',
        'image',
        'image_url',
        'imageUrl',
      ]
    )
  );
}

/* =========================================================
   DIVISION
========================================================= */

function normalizeDivision(
  value: any
):
  | Division
  | null {
  if (
    !value
  ) {
    return null;
  }

  const division =
    String(
      value
    )
      .trim()
      .toLowerCase();

  if (
    division ===
    'yordle'
  ) {
    return 'Yordle';
  }

  if (
    division ===
    'ixtal'
  ) {
    return 'Ixtal';
  }

  if (
    division ===
    'targon'
  ) {
    return 'Targon';
  }

  return null;
}

/* =========================================================
   JOUEURS
========================================================= */

function normalizeRiotId(
  value: any
) {
  return String(
    value ??
      ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      ''
    );
}

function findPlayer(
  players:
    AnyObject[],

  riotId:
    string,

  member:
    AnyObject
) {
  const memberPlayerId =
    getValue(
      member,
      [
        'player_id',
        'playerId',
      ]
    );

  if (
    memberPlayerId !==
      undefined &&
    memberPlayerId !==
      null
  ) {
    const byId =
      players.find(
        (
          player
        ) =>
          String(
            getValue(
              player,
              [
                'id',
                'player_id',
                'playerId',
              ]
            )
          ) ===
          String(
            memberPlayerId
          )
      );

    if (
      byId
    ) {
      return byId;
    }
  }

  const normalized =
    normalizeRiotId(
      riotId
    );

  if (
    !normalized
  ) {
    return {};
  }

  return (
    players.find(
      (
        player
      ) =>
        normalizeRiotId(
          getValue(
            player,
            [
              'riot_id',
              'riotId',
              'summoner_name',
              'summonerName',
            ]
          )
        ) ===
        normalized
    ) ??
    {}
  );
}

/* =========================================================
   ROLES
========================================================= */

function normalizeRole(
  value: any
):
  | string
  | null {
  if (
    !value
  ) {
    return null;
  }

  const role =
    String(
      value
    )
      .trim()
      .toLowerCase();

  if (
    role ===
      'top' ||
    role ===
      'toplane'
  ) {
    return 'Top';
  }

  if (
    role ===
      'jungle' ||
    role ===
      'jgl' ||
    role ===
      'jg'
  ) {
    return 'Jungle';
  }

  if (
    role ===
      'mid' ||
    role ===
      'middle'
  ) {
    return 'Mid';
  }

  if (
    role ===
      'adc' ||
    role ===
      'bot' ||
    role ===
      'bottom'
  ) {
    return 'ADC';
  }

  if (
    role ===
      'support' ||
    role ===
      'sup'
  ) {
    return 'Support';
  }

  return String(
    value
  );
}

function roleOrder(
  role:
    | string
    | null
) {
  switch (
    role
  ) {
    case 'Top':
      return 0;

    case 'Jungle':
      return 1;

    case 'Mid':
      return 2;

    case 'ADC':
      return 3;

    case 'Support':
      return 4;

    default:
      return 99;
  }
}