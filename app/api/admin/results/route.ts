import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

  mvpPlayerId?: number | null;

  players: PlayerStatInput[];
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

  round?: string | null;

  bestOf?: number;

  playedAt?: string;

  games: GameInput[];
};

/* =========================================================
   SUPABASE ADMIN
========================================================= */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

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
   VERIFICATION ADMIN
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

  /*
    On vérifie d'abord que le token
    correspond bien à un user Supabase.
  */

  const {
    data: authData,
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
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
    IMPORTANT :

    Remplace uniquement
    REMPLACE_PAR_TA_TABLE_ADMIN

    par le nom de la table qui contient
    la colonne is_admin.

    Exemple si ta table s'appelle profiles :

    .from('profiles')
  */

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq(
        'id',
        user.id
      )
      .single();

  if (
    profileError ||
    !profile ||
    profile.is_admin !== true
  ) {
    return null;
  }

  return user;
}

/* =========================================================
   POST
   ENREGISTRER UN MATCH
========================================================= */

export async function POST(
  request: NextRequest
) {
  let createdMatchId:
    | number
    | null = null;

  try {
    /* =====================================================
       AUTH ADMIN
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
       VALIDATION DIVISION
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
        'Division invalide'
      );
    }

    /* =====================================================
       VALIDATION TEAMS
    ===================================================== */

    if (
      !team1Id ||
      !team2Id
    ) {
      throw new Error(
        'Deux équipes sont obligatoires'
      );
    }

    if (
      Number(team1Id) ===
      Number(team2Id)
    ) {
      throw new Error(
        'Une équipe ne peut pas jouer contre elle-même'
      );
    }

    if (
      Number(winnerTeamId) !==
        Number(team1Id) &&
      Number(winnerTeamId) !==
        Number(team2Id)
    ) {
      throw new Error(
        'Le gagnant doit être une des deux équipes'
      );
    }

    /* =====================================================
       VALIDATION TYPE MATCH
    ===================================================== */

    if (
      stage !== 'pool' &&
      stage !== 'playoff'
    ) {
      throw new Error(
        'Type de match invalide'
      );
    }

    if (
      stage === 'playoff' &&
      ![
        'winner',
        'loser',
        'grand_final',
      ].includes(
        String(bracket)
      )
    ) {
      throw new Error(
        'Bracket invalide'
      );
    }

    /* =====================================================
       VALIDATION GAMES
    ===================================================== */

    if (
      !Array.isArray(
        games
      ) ||
      games.length === 0
    ) {
      throw new Error(
        'Au moins une game est obligatoire'
      );
    }

    /* =====================================================
       RECUPERATION EQUIPES
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

    if (teamsError) {
      throw teamsError;
    }

    if (
      !teams ||
      teams.length !== 2
    ) {
      throw new Error(
        'Une des équipes est introuvable'
      );
    }

    /*
      On vérifie que les 2 teams
      sont validées et dans la bonne division.
    */

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
          `L'équipe ${team.name} n'est pas validée`
        );
      }

      if (
        team.division !==
        division
      ) {
        throw new Error(
          `L'équipe ${team.name} n'appartient pas à la division ${division}`
        );
      }
    }

    /* =====================================================
       VALIDATION DES JOUEURS
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
      uniquePlayerIds.length === 0
    ) {
      throw new Error(
        'Aucun joueur reçu'
      );
    }

    const {
      data: dbPlayers,
      error: playersError,
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

    if (playersError) {
      throw playersError;
    }

    if (
      (
        dbPlayers ?? []
      ).length !==
      uniquePlayerIds.length
    ) {
      throw new Error(
        'Au moins un joueur est introuvable'
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

    for (
      const game
      of games
    ) {
      if (
        !game.gameNumber ||
        game.gameNumber < 1
      ) {
        throw new Error(
          'Numéro de game invalide'
        );
      }

      if (
        game.durationSeconds <
        0
      ) {
        throw new Error(
          `Durée invalide pour la game ${game.gameNumber}`
        );
      }

      if (
        Number(
          game.winnerTeamId
        ) !==
          Number(team1Id) &&
        Number(
          game.winnerTeamId
        ) !==
          Number(team2Id)
      ) {
        throw new Error(
          `Gagnant invalide pour la game ${game.gameNumber}`
        );
      }

      if (
        !Array.isArray(
          game.players
        ) ||
        game.players.length !==
          10
      ) {
        throw new Error(
          `La game ${game.gameNumber} doit contenir exactement 10 joueurs`
        );
      }

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
          `Un joueur est présent plusieurs fois dans la game ${game.gameNumber}`
        );
      }

      /*
        Vérification 5 joueurs par team.
      */

      const team1Players =
        game.players.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(team1Id)
        );

      const team2Players =
        game.players.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(team2Id)
        );

      if (
        team1Players.length !==
          5 ||
        team2Players.length !==
          5
      ) {
        throw new Error(
          `La game ${game.gameNumber} doit avoir 5 joueurs de chaque équipe`
        );
      }

      /*
        Vérification des rôles.
      */

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
            `Rôle invalide dans la game ${game.gameNumber}`
          );
        }

        if (
          !player.championId
        ) {
          throw new Error(
            `Champion manquant dans la game ${game.gameNumber}`
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
              Number(value) <
              0
          )
        ) {
          throw new Error(
            `Stat négative détectée dans la game ${game.gameNumber}`
          );
        }
      }

      /*
        Les 5 rôles doivent être présents
        dans chaque équipe.
      */

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
          if (
            !roles.includes(
              requiredRole
            )
          ) {
            throw new Error(
              `Le rôle ${requiredRole} est manquant dans la game ${game.gameNumber}`
            );
          }
        }
      }
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
            team1Id,

          team2_id:
            team2Id,

          winner_team_id:
            winnerTeamId,

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
            bestOf,

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
          'Impossible de créer le match'
        )
      );
    }

    createdMatchId =
      createdMatch.id;

    /* =====================================================
       CREATION GAMES
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
              game
                .gameNumber,

            duration_seconds:
              game
                .durationSeconds,

            winner_team_id:
              game
                .winnerTeamId,

            mvp_player_id:
              game
                .mvpPlayerId ??
              null,
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
            `Impossible de créer la game ${game.gameNumber}`
          )
        );
      }

      /* ===================================================
         STATS JOUEURS
      =================================================== */

      const stats =
        game.players.map(
          (player) => ({
            game_id:
              createdGame.id,

            player_id:
              player.playerId,

            team_id:
              player.teamId,

            role:
              player.role,

            champion_id:
              player.championId,

            kills:
              Number(
                player.kills
              ) || 0,

            deaths:
              Number(
                player.deaths
              ) || 0,

            assists:
              Number(
                player.assists
              ) || 0,

            cs:
              Number(
                player.cs
              ) || 0,

            gold:
              Number(
                player.gold
              ) || 0,

            damage:
              Number(
                player.damage
              ) || 0,
          })
        );

      const {
        error: statsError,
      } =
        await supabaseAdmin
          .from(
            'czf_game_player_stats'
          )
          .insert(
            stats
          );

      if (statsError) {
        throw statsError;
      }
    }

    /* =====================================================
       OK
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        matchId:
          createdMatch.id,

        gamesCreated:
          games.length,

        message:
          'Match CZF enregistré avec succès.',
      },
      {
        status: 201,
      }
    );
  } catch (error: any) {
    console.error(
      '[CZF ADMIN RESULTS MATCH]',
      error
    );

    /*
      Si une erreur survient après
      création du match,
      on supprime le match.

      Grâce aux foreign keys ON DELETE CASCADE,
      les games + stats sont supprimées aussi.
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
          'Erreur inconnue',
      },
      {
        status: 400,
      }
    );
  }
}