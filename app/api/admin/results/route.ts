 import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

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

type PlayerStatInput = {
  playerId: number;
  teamId: number;

  role: Role;

  championId: string;

  kills: number;
  deaths: number;
  assists: number;

  cs: number;
  gold: number;
  damage: number;
};

type GameInput = {
  gameNumber: number;

  durationSeconds: number;

  winnerTeamId: number;

  mvpPlayerId?:
    | number
    | null;

  players:
    PlayerStatInput[];
};

type MatchInput = {
  division: Division;

  team1Id: number;
  team2Id: number;

  winnerTeamId: number;

  stage:
    | 'pool'
    | 'playoff';

  bracket?:
    | 'winner'
    | 'loser'
    | 'grand_final'
    | null;

  round?:
    | string
    | null;

  bestOf?: number;

  playedAt?: string;

  games: GameInput[];
};

/* =========================================================
   SUPABASE ADMIN
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
        autoRefreshToken:
          false,

        persistSession:
          false,
      },
    }
  );

/* =========================================================
   ADMIN
========================================================= */

async function checkAdmin(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      'authorization'
    );

  if (
    !authorization ||
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  const token =
    authorization.replace(
      'Bearer ',
      ''
    );

  const {
    data: authData,
    error: authError,
  } =
    await supabaseAdmin
      .auth
      .getUser(
        token
      );

  if (
    authError ||
    !authData.user
  ) {
    return null;
  }

  const user =
    authData.user;

  /*
    On réutilise ton système
    d'admin déjà existant :
    profiles.is_admin
  */

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseAdmin
      .from('profiles')
      .select(
        'is_admin'
      )
      .eq(
        'id',
        user.id
      )
      .single();

  if (
    profileError ||
    !profile ||
    profile.is_admin !==
      true
  ) {
    return null;
  }

  return user;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  let createdMatchId:
    | number
    | null = null;

  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const admin =
      await checkAdmin(
        request
      );

    if (!admin) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Accès administrateur refusé.',
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================================
       BODY
    ===================================================== */

    const body =
      (await request.json()) as
        MatchInput;

    const {
      division,

      team1Id,
      team2Id,

      winnerTeamId,

      stage,

      bracket = null,

      round = null,

      bestOf = 1,

      playedAt,

      games,
    } = body;

    /* =====================================================
       DIVISION
    ===================================================== */

    const allowedDivisions:
      Division[] = [
      'Yordle',
      'Ixtal',
      'Targon',
    ];

    if (
      !allowedDivisions.includes(
        division
      )
    ) {
      throw new Error(
        'Division invalide.'
      );
    }

    /* =====================================================
       TEAMS
    ===================================================== */

    if (
      !team1Id ||
      !team2Id
    ) {
      throw new Error(
        'Deux équipes sont obligatoires.'
      );
    }

    if (
      Number(team1Id) ===
      Number(team2Id)
    ) {
      throw new Error(
        'Une équipe ne peut pas jouer contre elle-même.'
      );
    }

    if (
      Number(
        winnerTeamId
      ) !==
        Number(
          team1Id
        ) &&
      Number(
        winnerTeamId
      ) !==
        Number(
          team2Id
        )
    ) {
      throw new Error(
        'Le gagnant doit être une des deux équipes.'
      );
    }

    /* =====================================================
       PHASE
    ===================================================== */

    if (
      stage !== 'pool' &&
      stage !== 'playoff'
    ) {
      throw new Error(
        'Phase invalide.'
      );
    }

    if (
      stage ===
        'playoff' &&
      ![
        'winner',
        'loser',
        'grand_final',
      ].includes(
        String(
          bracket
        )
      )
    ) {
      throw new Error(
        'Bracket invalide.'
      );
    }

    /* =====================================================
       BEST OF
    ===================================================== */

    if (
      ![
        1,
        3,
        5,
      ].includes(
        Number(
          bestOf
        )
      )
    ) {
      throw new Error(
        'Format BO invalide.'
      );
    }

    /* =====================================================
       GAMES
    ===================================================== */

    if (
      !Array.isArray(
        games
      ) ||
      games.length ===
        0
    ) {
      throw new Error(
        'Au moins une game est obligatoire.'
      );
    }

    /* =====================================================
       RECUPERATION DES 2 TEAMS
    ===================================================== */

    const {
      data: teams,
      error: teamsError,
    } =
      await supabaseAdmin
        .from('teams')
        .select(`
          id,
          name,
          division,
          validated_by_admin
        `)
        .in(
          'id',
          [
            team1Id,
            team2Id,
          ]
        );

    if (
      teamsError
    ) {
      throw teamsError;
    }

    if (
      !teams ||
      teams.length !==
        2
    ) {
      throw new Error(
        'Une des équipes est introuvable.'
      );
    }

    for (
      const team
      of teams
    ) {
      if (
        team
          .validated_by_admin !==
        true
      ) {
        throw new Error(
          `L'équipe ${team.name} n'est pas validée.`
        );
      }

      if (
        team.division !==
        division
      ) {
        throw new Error(
          `L'équipe ${team.name} n'appartient pas à ${division}.`
        );
      }
    }

    /* =====================================================
       IDS JOUEURS
    ===================================================== */

    const allPlayerIds =
      games.flatMap(
        (game) =>
          game.players.map(
            (player) =>
              Number(
                player.playerId
              )
          )
      );

    const uniquePlayerIds =
      [
        ...new Set(
          allPlayerIds
        ),
      ];

    if (
      uniquePlayerIds.length ===
      0
    ) {
      throw new Error(
        'Aucun joueur reçu.'
      );
    }

    /* =====================================================
       VERIFICATION DES JOUEURS
    ===================================================== */

    const {
      data: dbPlayers,
      error:
        playersError,
    } =
      await supabaseAdmin
        .from('players')
        .select(
          'id, riot_id'
        )
        .in(
          'id',
          uniquePlayerIds
        );

    if (
      playersError
    ) {
      throw playersError;
    }

    if (
      (
        dbPlayers ??
        []
      ).length !==
      uniquePlayerIds.length
    ) {
      throw new Error(
        'Au moins un joueur est introuvable.'
      );
    }

    /* =====================================================
       ROSTERS DES 2 TEAMS

       Important pour les SUBS :
       un remplaçant est accepté uniquement s'il
       appartient réellement au roster de la team.
    ===================================================== */

    const {
      data: teamMembers,
      error:
        membersError,
    } =
      await supabaseAdmin
        .from(
          'team_members'
        )
        .select(
          'team_id, riot_id'
        )
        .in(
          'team_id',
          [
            team1Id,
            team2Id,
          ]
        );

    if (
      membersError
    ) {
      throw membersError;
    }

    const normalizeRiotId =
      (
        value:
          string |
          null |
          undefined
      ) =>
        String(
          value ?? ''
        )
          .trim()
          .toLowerCase()
          .replace(
            /\s+/g,
            ''
          );

    const playerById =
      new Map<
        number,
        any
      >();

    for (
      const player
      of dbPlayers ??
        []
    ) {
      playerById.set(
        Number(
          player.id
        ),
        player
      );
    }

    const memberTeamByRiotId =
      new Map<
        string,
        number
      >();

    for (
      const member
      of teamMembers ??
        []
    ) {
      memberTeamByRiotId.set(
        normalizeRiotId(
          member.riot_id
        ),
        Number(
          member.team_id
        )
      );
    }

    /* =====================================================
       VALIDATION DE CHAQUE GAME
    ===================================================== */

    const allowedRoles:
      Role[] = [
      'Top',
      'Jungle',
      'Mid',
      'ADC',
      'Support',
    ];

    const gameNumbers =
      new Set<number>();

    for (
      const game
      of games
    ) {
      /* ---------------------------
         NUMERO GAME
      --------------------------- */

      if (
        !game.gameNumber ||
        Number(
          game.gameNumber
        ) < 1
      ) {
        throw new Error(
          'Numéro de game invalide.'
        );
      }

      if (
        gameNumbers.has(
          Number(
            game.gameNumber
          )
        )
      ) {
        throw new Error(
          `La Game ${game.gameNumber} est présente deux fois.`
        );
      }

      gameNumbers.add(
        Number(
          game.gameNumber
        )
      );

      /* ---------------------------
         DUREE
      --------------------------- */

      if (
        Number(
          game.durationSeconds
        ) <= 0
      ) {
        throw new Error(
          `Durée invalide pour la Game ${game.gameNumber}.`
        );
      }

      /* ---------------------------
         VAINQUEUR GAME
      --------------------------- */

      if (
        Number(
          game
            .winnerTeamId
        ) !==
          Number(
            team1Id
          ) &&
        Number(
          game
            .winnerTeamId
        ) !==
          Number(
            team2Id
          )
      ) {
        throw new Error(
          `Vainqueur invalide pour la Game ${game.gameNumber}.`
        );
      }

      /* ---------------------------
         EXACTEMENT 10 JOUEURS
      --------------------------- */

      if (
        !Array.isArray(
          game.players
        ) ||
        game.players
          .length !== 10
      ) {
        throw new Error(
          `La Game ${game.gameNumber} doit contenir exactement 10 joueurs.`
        );
      }

      /* ---------------------------
         PAS DE DOUBLON
      --------------------------- */

      const gamePlayerIds =
        game.players.map(
          (player) =>
            Number(
              player.playerId
            )
        );

      if (
        new Set(
          gamePlayerIds
        ).size !== 10
      ) {
        throw new Error(
          `Un joueur est présent plusieurs fois dans la Game ${game.gameNumber}.`
        );
      }

      /* ---------------------------
         5 VS 5
      --------------------------- */

      const team1Players =
        game.players.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(
              team1Id
            )
        );

      const team2Players =
        game.players.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(
              team2Id
            )
        );

      if (
        team1Players.length !==
          5 ||
        team2Players.length !==
          5
      ) {
        throw new Error(
          `La Game ${game.gameNumber} doit avoir exactement 5 joueurs de chaque équipe.`
        );
      }

      /* ---------------------------
         ROLE + CHAMPION + STATS
      --------------------------- */

      for (
        const player
        of game.players
      ) {
        if (
          !allowedRoles.includes(
            player.role
          )
        ) {
          throw new Error(
            `Rôle invalide dans la Game ${game.gameNumber}.`
          );
        }

        if (
          !player.championId
        ) {
          throw new Error(
            `Champion manquant dans la Game ${game.gameNumber}.`
          );
        }

        const numericStats =
          [
            player.kills,
            player.deaths,
            player.assists,
            player.cs,
            player.gold,
            player.damage,
          ];

        if (
          numericStats.some(
            (value) =>
              !Number.isFinite(
                Number(
                  value
                )
              ) ||
              Number(
                value
              ) < 0
          )
        ) {
          throw new Error(
            `Stat invalide détectée dans la Game ${game.gameNumber}.`
          );
        }

        /* -------------------------
           VERIFICATION DU ROSTER
        ------------------------- */

        const dbPlayer =
          playerById.get(
            Number(
              player.playerId
            )
          );

        if (
          !dbPlayer
        ) {
          throw new Error(
            `Joueur ${player.playerId} introuvable.`
          );
        }

        const realTeamId =
          memberTeamByRiotId.get(
            normalizeRiotId(
              dbPlayer.riot_id
            )
          );

        if (
          !realTeamId
        ) {
          throw new Error(
            `${dbPlayer.riot_id} n'est dans aucun roster du match.`
          );
        }

        if (
          Number(
            realTeamId
          ) !==
          Number(
            player.teamId
          )
        ) {
          throw new Error(
            `${dbPlayer.riot_id} n'appartient pas à l'équipe indiquée.`
          );
        }
      }

      /* ---------------------------
         1 ROLE DE CHAQUE PAR TEAM
      --------------------------- */

      for (
        const teamPlayers
        of [
          team1Players,
          team2Players,
        ]
      ) {
        const roles =
          teamPlayers.map(
            (player) =>
              player.role
          );

        for (
          const requiredRole
          of allowedRoles
        ) {
          const count =
            roles.filter(
              (role) =>
                role ===
                requiredRole
            ).length;

          if (
            count !== 1
          ) {
            throw new Error(
              `Chaque équipe doit avoir exactement un ${requiredRole} dans la Game ${game.gameNumber}.`
            );
          }
        }
      }

      /* ---------------------------
         MVP
      --------------------------- */

      if (
        game.mvpPlayerId !==
          null &&
        game.mvpPlayerId !==
          undefined
      ) {
        const mvpIsPlaying =
          gamePlayerIds.includes(
            Number(
              game.mvpPlayerId
            )
          );

        if (
          !mvpIsPlaying
        ) {
          throw new Error(
            `Le MVP de la Game ${game.gameNumber} ne fait pas partie des 10 joueurs.`
          );
        }
      }
    }

    /* =====================================================
       VERIFICATION DU SCORE DU MATCH
    ===================================================== */

    const winsTeam1 =
      games.filter(
        (game) =>
          Number(
            game.winnerTeamId
          ) ===
          Number(
            team1Id
          )
      ).length;

    const winsTeam2 =
      games.filter(
        (game) =>
          Number(
            game.winnerTeamId
          ) ===
          Number(
            team2Id
          )
      ).length;

    if (
      winsTeam1 ===
      winsTeam2
    ) {
      throw new Error(
        'Le score du match est à égalité.'
      );
    }

    const calculatedWinner =
      winsTeam1 >
      winsTeam2
        ? Number(
            team1Id
          )
        : Number(
            team2Id
          );

    if (
      Number(
        winnerTeamId
      ) !==
      calculatedWinner
    ) {
      throw new Error(
        'Le vainqueur du match ne correspond pas au résultat des games.'
      );
    }

    /* =====================================================
       CREATION MATCH
    ===================================================== */

    const {
      data: createdMatch,
      error: matchError,
    } =
      await supabaseAdmin
        .from(
          'czf_matches'
        )
        .insert({
          division,

          team1_id:
            Number(
              team1Id
            ),

          team2_id:
            Number(
              team2Id
            ),

          winner_team_id:
            Number(
              winnerTeamId
            ),

          stage,

          bracket:
            stage ===
            'playoff'
              ? bracket
              : null,

          round:
            stage ===
            'playoff'
              ? round
              : null,

          best_of:
            Number(
              bestOf
            ),

          status:
            'finished',

          played_at:
            playedAt ??
            new Date()
              .toISOString(),
        })
        .select('*')
        .single();

    if (
      matchError ||
      !createdMatch
    ) {
      throw (
        matchError ??
        new Error(
          'Impossible de créer le match.'
        )
      );
    }

    createdMatchId =
      Number(
        createdMatch.id
      );

    /* =====================================================
       CREATION DES GAMES
    ===================================================== */

    for (
      const game
      of games
    ) {
      const {
        data: createdGame,
        error: gameError,
      } =
        await supabaseAdmin
          .from(
            'czf_games'
          )
          .insert({
            match_id:
              createdMatch.id,

            game_number:
              Number(
                game.gameNumber
              ),

            duration_seconds:
              Number(
                game.durationSeconds
              ),

            winner_team_id:
              Number(
                game.winnerTeamId
              ),

            mvp_player_id:
              game.mvpPlayerId
                ? Number(
                    game.mvpPlayerId
                  )
                : null,
          })
          .select('*')
          .single();

      if (
        gameError ||
        !createdGame
      ) {
        throw (
          gameError ??
          new Error(
            `Impossible de créer la Game ${game.gameNumber}.`
          )
        );
      }

      /* ===================================================
         STATS DES 10 JOUEURS
      =================================================== */

      const stats =
        game.players.map(
          (player) => ({
            game_id:
              Number(
                createdGame.id
              ),

            player_id:
              Number(
                player.playerId
              ),

            team_id:
              Number(
                player.teamId
              ),

            role:
              player.role,

            champion_id:
              player.championId,

            kills:
              Number(
                player.kills
              ),

            deaths:
              Number(
                player.deaths
              ),

            assists:
              Number(
                player.assists
              ),

            cs:
              Number(
                player.cs
              ),

            gold:
              Number(
                player.gold
              ),

            damage:
              Number(
                player.damage
              ),
          })
        );

      const {
        error:
          statsError,
      } =
        await supabaseAdmin
          .from(
            'czf_game_player_stats'
          )
          .insert(
            stats
          );

      if (
        statsError
      ) {
        throw statsError;
      }
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        matchId:
          createdMatch.id,

        gamesCreated:
          games.length,

        score: {
          team1:
            winsTeam1,

          team2:
            winsTeam2,
        },

        message:
          'Match CZF enregistré avec succès.',
      },
      {
        status: 201,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      '[CZF ADMIN RESULTS]',
      error
    );

    /*
      Si une erreur arrive après
      la création du match :

      suppression du match
      ↓
      cascade
      ↓
      games + stats supprimées.
    */

    if (
      createdMatchId !==
      null
    ) {
      await supabaseAdmin
        .from(
          'czf_matches'
        )
        .delete()
        .eq(
          'id',
          createdMatchId
        );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ??
          'Erreur inconnue.',
      },
      {
        status: 400,
      }
    );
  }
}