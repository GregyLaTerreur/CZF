import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  createClient,
} from '@supabase/supabase-js';
import { invalidateResults } from '@/lib/results/cache';
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
  visionScore: number;
};
/*
  Un sub n'a PAS de playerId.
  On conserve uniquement ce
  qui est nécessaire pour
  l'afficher dans l'historique.
  Ces données ne seront jamais
  ajoutées à czf_game_player_stats.
*/
type SubstituteStatInput = {
  teamId: number;
  role: Role;
  championId: string;
  kills: number;
  deaths: number;
  assists: number;
};
type GameInput = {
  gameNumber: number;
  durationSeconds: number;
  winnerTeamId: number;
  /*
    Joueurs officiels uniquement.
    Il peut donc y avoir moins
    de 10 lignes lorsqu'un sub
    a joué.
  */
  players: PlayerStatInput[];
  /*
    Subs de la game.
    Ils seront stockés uniquement
    dans czf_games.substitute_stats
    pour pouvoir les afficher
    dans l'historique.
    Ils ne comptent PAS dans
    les statistiques joueurs.
  */
  substitutes?: SubstituteStatInput[];
};
type MatchInput = {
  division: Division;
  team1Id: number;
  team2Id: number;
  /*
    NULL possible uniquement
    pour un 1-1 en poules.
  */
  winnerTeamId:
    | number
    | null;
  /*
    MVP UNIQUE DU MATCH / BO
  */
  mvpPlayerId:
    | number
    | null;
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
    const body =
      (await request.json()) as
        MatchInput;
    const {
      division,
      team1Id,
      team2Id,
      winnerTeamId,
      mvpPlayerId,
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
       FORMAT
    ===================================================== */
    /*
      POULES :
      exactement 2 games.
      PLAYOFFS :
      BO1 / BO3 / BO5.
    */
    if (
      stage ===
      'pool'
    ) {
      if (
        Number(
          bestOf
        ) !== 2
      ) {
        throw new Error(
          'Les matchs de poule doivent obligatoirement être joués en 2 games.'
        );
      }
    } else {
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
          'Format de playoffs invalide.'
        );
      }
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
    if (
      stage ===
        'pool' &&
      games.length !==
        2
    ) {
      throw new Error(
        'Un match de poule doit contenir exactement 2 games.'
      );
    }
    if (
      stage ===
        'playoff' &&
      games.length >
        Number(
          bestOf
        )
    ) {
      throw new Error(
        'Trop de games pour ce format de playoffs.'
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
        .select('id, name, division, validated_by_admin')
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
       IDS JOUEURS OFFICIELS
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
        'Aucun joueur officiel reçu.'
      );
    }
    /* =====================================================
       JOUEURS DB
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
       ROSTERS
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
       VALIDATION GAMES
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
      const substitutes =
        Array.isArray(
          game.substitutes
        )
          ? game.substitutes
          : [];
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
      if (
        Number(
          game.durationSeconds
        ) <= 0
      ) {
        throw new Error(
          `Durée invalide pour la Game ${game.gameNumber}.`
        );
      }
      if (
        Number(
          game.winnerTeamId
        ) !==
          Number(
            team1Id
          ) &&
        Number(
          game.winnerTeamId
        ) !==
          Number(
            team2Id
          )
      ) {
        throw new Error(
          `Vainqueur invalide pour la Game ${game.gameNumber}.`
        );
      }
      /*
        Joueurs officiels.
      */
      if (
        !Array.isArray(
          game.players
        ) ||
        game.players.length ===
          0 ||
        game.players.length >
          10
      ) {
        throw new Error(
          `Nombre de joueurs officiels invalide dans la Game ${game.gameNumber}.`
        );
      }
      /*
        Le total :
        officiels + subs
        ne peut pas dépasser 10.
      */
      if (
        game.players.length +
          substitutes.length >
        10
      ) {
        throw new Error(
          `Plus de 10 participants détectés dans la Game ${game.gameNumber}.`
        );
      }
      /* ===================================================
         PAS DE JOUEUR OFFICIEL EN DOUBLE
      =================================================== */
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
        ).size !==
        gamePlayerIds.length
      ) {
        throw new Error(
          `Un joueur est présent plusieurs fois dans la Game ${game.gameNumber}.`
        );
      }
      /* ===================================================
         JOUEURS PAR TEAM
      =================================================== */
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
      const team1Subs =
        substitutes.filter(
          (sub) =>
            Number(
              sub.teamId
            ) ===
            Number(
              team1Id
            )
        );
      const team2Subs =
        substitutes.filter(
          (sub) =>
            Number(
              sub.teamId
            ) ===
            Number(
              team2Id
            )
        );
      /*
        Vérifie qu'aucun joueur
        officiel n'a une équipe
        qui n'est pas dans le match.
      */
      if (
        team1Players.length +
          team2Players.length !==
        game.players.length
      ) {
        throw new Error(
          `Un joueur possède une équipe invalide dans la Game ${game.gameNumber}.`
        );
      }
      /*
        Vérifie pareil pour
        les subs.
      */
      if (
        team1Subs.length +
          team2Subs.length !==
        substitutes.length
      ) {
        throw new Error(
          `Un sub possède une équipe invalide dans la Game ${game.gameNumber}.`
        );
      }
      /*
        Officiels + subs :
        maximum 5 par équipe.
      */
      if (
        team1Players.length +
          team1Subs.length >
          5 ||
        team2Players.length +
          team2Subs.length >
          5
      ) {
        throw new Error(
          `Une équipe contient plus de 5 participants dans la Game ${game.gameNumber}.`
        );
      }
      /* ===================================================
         VALIDATION JOUEURS OFFICIELS
      =================================================== */
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
            player.visionScore,
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
        if (
  Number(player.teamId) !== Number(team1Id) &&
  Number(player.teamId) !== Number(team2Id)
) {
  throw new Error(
    `${dbPlayer.riot_id} possède une équipe invalide.`
  );
}
}
      /* ===================================================
         VALIDATION SUBS
      =================================================== */
      for (
        const sub
        of substitutes
      ) {
        if (
          Number(
            sub.teamId
          ) !==
            Number(
              team1Id
            ) &&
          Number(
            sub.teamId
          ) !==
            Number(
              team2Id
            )
        ) {
          throw new Error(
            `Équipe du sub invalide dans la Game ${game.gameNumber}.`
          );
        }
        if (
          !allowedRoles.includes(
            sub.role
          )
        ) {
          throw new Error(
            `Rôle du sub invalide dans la Game ${game.gameNumber}.`
          );
        }
        if (
          !sub.championId
        ) {
          throw new Error(
            `Champion du sub manquant dans la Game ${game.gameNumber}.`
          );
        }
        const numericSubStats =
          [
            sub.kills,
            sub.deaths,
            sub.assists,
          ];
        if (
          numericSubStats.some(
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
            `KDA invalide pour un sub dans la Game ${game.gameNumber}.`
          );
        }
      }
      /* ===================================================
         ROLES
      =================================================== */
      /*
        On vérifie maintenant
        les rôles avec les subs.
        Exemple :
        Top officiel absent
        + Top SUB présent = OK.
        Mais Top officiel
        + Top SUB = interdit.
      */
      const team1Roles = [
        ...team1Players.map(
          (player) =>
            player.role
        ),
        ...team1Subs.map(
          (sub) =>
            sub.role
        ),
      ];
      const team2Roles = [
        ...team2Players.map(
          (player) =>
            player.role
        ),
        ...team2Subs.map(
          (sub) =>
            sub.role
        ),
      ];
      if (
        new Set(
          team1Roles
        ).size !==
        team1Roles.length
      ) {
        throw new Error(
          `Un rôle est présent plusieurs fois pour l'équipe 1 dans la Game ${game.gameNumber}.`
        );
      }
      if (
        new Set(
          team2Roles
        ).size !==
        team2Roles.length
      ) {
        throw new Error(
          `Un rôle est présent plusieurs fois pour l'équipe 2 dans la Game ${game.gameNumber}.`
        );
      }
    }
    /* =====================================================
       MVP UNIQUE MATCH
    ===================================================== */
    if (
      !mvpPlayerId
    ) {
      throw new Error(
        'Le MVP du match est obligatoire.'
      );
    }
    const mvpNumericId =
      Number(
        mvpPlayerId
      );
    /*
      Le MVP doit être
      un joueur officiel.
      Un sub n'a pas de playerId
      ici et ne peut donc jamais
      être MVP.
    */
    if (
      !uniquePlayerIds.includes(
        mvpNumericId
      )
    ) {
      throw new Error(
        'Le MVP doit avoir participé à au moins une game enregistrée du match.'
      );
    }
    /* =====================================================
       SCORE MATCH
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
    let calculatedWinner:
      | number
      | null =
      null;
    if (
      winsTeam1 >
      winsTeam2
    ) {
      calculatedWinner =
        Number(
          team1Id
        );
    } else if (
      winsTeam2 >
      winsTeam1
    ) {
      calculatedWinner =
        Number(
          team2Id
        );
    }
    /* =====================================================
       REGLES POULES
    ===================================================== */
    if (
      stage ===
      'pool'
    ) {
      if (
        winsTeam1 +
          winsTeam2 !==
        2
      ) {
        throw new Error(
          'Un match de poule doit contenir exactement deux résultats de game.'
        );
      }
      if (
        winsTeam1 ===
        winsTeam2
      ) {
        if (
          winnerTeamId !==
            null &&
          winnerTeamId !==
            undefined
        ) {
          throw new Error(
            'Un match de poule terminé 1-1 ne doit pas avoir de vainqueur de match.'
          );
        }
      } else {
        if (
          Number(
            winnerTeamId
          ) !==
          calculatedWinner
        ) {
          throw new Error(
            'Le vainqueur du match ne correspond pas au score des games.'
          );
        }
      }
    }
    /* =====================================================
       REGLES PLAYOFFS
    ===================================================== */
    if (
      stage ===
      'playoff'
    ) {
      if (
        calculatedWinner ===
        null
      ) {
        throw new Error(
          'Un match de playoffs ne peut pas terminer sur une égalité.'
        );
      }
      if (
        Number(
          winnerTeamId
        ) !==
        calculatedWinner
      ) {
        throw new Error(
          'Le vainqueur du match ne correspond pas au score des games.'
        );
      }
      const requiredWins =
        Math.floor(
          Number(
            bestOf
          ) / 2
        ) + 1;
      const winningScore =
        Math.max(
          winsTeam1,
          winsTeam2
        );
      if (
        winningScore !==
        requiredWins
      ) {
        throw new Error(
          `Le vainqueur doit avoir ${requiredWins} victoire(s) pour terminer ce BO${bestOf}.`
        );
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
            Number(
              team1Id
            ),
          team2_id:
            Number(
              team2Id
            ),
          winner_team_id:
            calculatedWinner,
          mvp_player_id:
            mvpNumericId,
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
            stage ===
            'pool'
              ? 2
              : Number(
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
       CREATION GAMES
    ===================================================== */
    for (
      const game
      of games
    ) {
      /*
        On prépare les subs
        AVANT de créer la game.
        Ces données seront stockées
        uniquement dans le JSONB
        substitute_stats.
      */
      const substituteStats =
        (
          Array.isArray(
            game.substitutes
          )
            ? game.substitutes
            : []
        ).map(
          (
            sub
          ) => ({
            teamId:
              Number(
                sub.teamId
              ),
            role:
              sub.role,
            championId:
              String(
                sub.championId
              ),
            kills:
              Number(
                sub.kills
              ) || 0,
            deaths:
              Number(
                sub.deaths
              ) || 0,
            assists:
              Number(
                sub.assists
              ) || 0,
          })
        );
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
            /*
              NOUVEAU :
              Les subs restent
              uniquement sur la game
              pour l'historique.
            */
            substitute_stats:
              substituteStats,
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
         STATS JOUEURS OFFICIELS
      =================================================== */
      /*
        IMPORTANT :
        Seuls les joueurs officiels
        arrivent dans cette table.
        Les subs restent complètement
        exclus des statistiques :
        - KDA classement
        - DPM
        - Gold
        - Vision
        - Pick Rate
        - Win Rate champions
        - MVP
      */
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
            vision_score:
              Number(
                player.visionScore
              ) || 0,
          })
        );
      if (
        stats.length >
        0
      ) {
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
    }
    /* =====================================================
       SUCCESS
    ===================================================== */
    const substitutesSaved =
      games.reduce(
        (
          total,
          game
        ) =>
          total +
          (
            Array.isArray(
              game.substitutes
            )
              ? game
                  .substitutes
                  .length
              : 0
          ),
        0
      );
    invalidateResults();

    return NextResponse.json(
      {
        success: true,
        matchId:
          createdMatch.id,
        gamesCreated:
          games.length,
        substitutesSaved,
        score: {
          team1:
            winsTeam1,
          team2:
            winsTeam2,
        },
        winnerTeamId:
          calculatedWinner,
        draw:
          calculatedWinner ===
          null,
        mvpPlayerId:
          mvpNumericId,
        message:
          calculatedWinner ===
          null
            ? 'Match CZF enregistré : 1-1.'
            : 'Match CZF enregistré avec succès.',
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
      Si quelque chose plante
      après création du match,
      on supprime le match.
      Les games/stats devraient
      être supprimées avec les FK
      CASCADE si configurées.
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