'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Nav from '../../components/Nav';
import MatchManager from './MatchManager';

import {
  supabase,
} from '@/lib/supabase';

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

type Player = {
  id: number;
  riotId: string;
  discordName: string | null;
  role: string | null;
};

type Team = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  division: Division;
  roster: Player[];
};

type Champion = {
  id: string;
  name: string;
  image: string;
};

type GamePlayer = {
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

type GameSubstitute = {
  teamId: number;

  role: Role;

  championId: string;

  kills: number;
  deaths: number;
  assists: number;
};

type GameForm = {
  gameNumber: number;

  durationMinutes: number;
  durationSeconds: number;

  winnerTeamId:
    | number
    | null;

  players: GamePlayer[];

  /*
    Subs conservés uniquement
    pour l'historique.

    Ils ne seront jamais ajoutés
    aux stats officielles.
  */
  substitutes: GameSubstitute[];
};

type ImportPlayer = {
  player?: string;
  riotId?: string;

  team?: string;

  role?: string;

  /*
    Si true :
    le joueur est un sub.

    Champion + KDA sont conservés
    pour l'historique.
  */
  sub?: boolean;

  champion?: string;
  championId?: string;

  kills?: number;
  deaths?: number;
  assists?: number;

  cs?: number;
  gold?: number;
  damage?: number;

  vision?: number;
  visionScore?: number;
};

type ImportGame = {
  gameNumber?: number;

  duration?: string;

  durationMinutes?: number;
  durationSeconds?: number;

  winner?: string;
  winnerTeam?: string;
  winnerTeamId?: number;

  players?: ImportPlayer[];
};

type ImportJson = {
  division?: Division;

  team1?: string;
  team2?: string;

  team1Id?: number;
  team2Id?: number;

  stage?: 'pool' | 'playoff';

  bracket?:
    | 'winner'
    | 'loser'
    | 'grand_final';

  round?: string;

  bestOf?: number;

  mvp?: string;
  mvpPlayer?: string;
  mvpPlayerId?: number;

  games?: ImportGame[];
};

const ROLES: Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(
  value:
    | string
    | null
    | undefined
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]/g,
      ''
    );
}

function normalizeRiotName(
  value:
    | string
    | null
    | undefined
) {
  const text =
    String(
      value ?? ''
    ).trim();

  const gameName =
    text.split('#')[0];

  return normalizeText(
    gameName
  );
}

/*
  Similarité entre 2 pseudos normalisés :
  1 = identiques, 0 = rien en commun.
  Basée sur la distance de Levenshtein.
*/
const FUZZY_PLAYER_THRESHOLD =
  0.8;

function nameSimilarity(
  a: string,
  b: string
) {
  if (
    !a ||
    !b
  ) {
    return 0;
  }

  if (
    a === b
  ) {
    return 1;
  }

  let previous =
    Array.from(
      {
        length:
          b.length +
          1,
      },
      (
        _,
        index
      ) => index
    );

  for (
    let i = 1;
    i <= a.length;
    i++
  ) {
    const current = [
      i,
    ];

    for (
      let j = 1;
      j <= b.length;
      j++
    ) {
      current[j] =
        Math.min(
          previous[j] +
            1,
          current[
            j - 1
          ] + 1,
          previous[
            j - 1
          ] +
            (a[i - 1] ===
            b[j - 1]
              ? 0
              : 1)
        );
    }

    previous =
      current;
  }

  return (
    1 -
    previous[
      b.length
    ] /
      Math.max(
        a.length,
        b.length
      )
  );
}

function normalizeRole(
  value:
    | string
    | null
    | undefined
): Role | null {
  const role =
    normalizeText(
      value
    );

  if (
    [
      'top',
      'toplane',
    ].includes(
      role
    )
  ) {
    return 'Top';
  }

  if (
    [
      'jungle',
      'jg',
      'jungler',
    ].includes(
      role
    )
  ) {
    return 'Jungle';
  }

  if (
    [
      'mid',
      'midlane',
      'middle',
    ].includes(
      role
    )
  ) {
    return 'Mid';
  }

  if (
    [
      'adc',
      'bot',
      'botlane',
      'carry',
    ].includes(
      role
    )
  ) {
    return 'ADC';
  }

  if (
    [
      'support',
      'supp',
      'sup',
    ].includes(
      role
    )
  ) {
    return 'Support';
  }

  return null;
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminResultsPage() {
  const [
    division,
    setDivision,
  ] =
    useState<Division>(
      'Yordle'
    );

  const [
    teams,
    setTeams,
  ] =
    useState<Team[]>(
      []
    );

  const [
    champions,
    setChampions,
  ] =
    useState<
      Champion[]
    >([]);

  const [
    team1Id,
    setTeam1Id,
  ] =
    useState<
      number |
      null
    >(null);

  const [
    team2Id,
    setTeam2Id,
  ] =
    useState<
      number |
      null
    >(null);

  const [
    stage,
    setStage,
  ] =
    useState<
      | 'pool'
      | 'playoff'
    >('pool');

  const [
    bracket,
    setBracket,
  ] =
    useState<
      | 'winner'
      | 'loser'
      | 'grand_final'
    >('winner');

  const [
    round,
    setRound,
  ] =
    useState('');

  const [
    bestOf,
    setBestOf,
  ] =
    useState(2);

  const [
    games,
    setGames,
  ] =
    useState<
      GameForm[]
    >([]);

  const [
    matchMvpPlayerId,
    setMatchMvpPlayerId,
  ] =
    useState<
      number |
      null
    >(null);

  const [
    importJson,
    setImportJson,
  ] =
    useState('');

  const [
    importFileName,
    setImportFileName,
  ] =
    useState('');

  const [
    dragOver,
    setDragOver,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  /* =========================================================
     LOAD
  ========================================================= */

  useEffect(() => {
    async function load() {
      try {
        const res =
          await fetch(
            '/api/results',
            {
              cache:
                'no-store',
            }
          );

        const data =
          await res.json();

        if (
          !res.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Impossible de charger les données.'
          );
        }

        const allTeams:
          Team[] =
          data.teams ||
          [];

        setTeams(
          allTeams
        );

        setChampions(
          data.champions ||
            []
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.message ||
            'Erreur de chargement.'
        );
      }
    }

    load();
  }, []);

  /* =========================================================
     SI ON PASSE EN POULES => BO2
  ========================================================= */

  useEffect(() => {
    if (
      stage ===
      'pool'
    ) {
      setBestOf(
        2
      );

      setGames(
        []
      );
    } else {
      if (
        ![
          1,
          3,
          5,
        ].includes(
          bestOf
        )
      ) {
        setBestOf(
          3
        );
      }

      setGames(
        []
      );
    }

    setMatchMvpPlayerId(
      null
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /* =========================================================
     TEAMS
  ========================================================= */

  const divisionTeams =
    useMemo(
      () =>
        teams.filter(
          (
            team
          ) =>
            team.division ===
            division
        ),
      [
        teams,
        division,
      ]
    );

  const team1 =
    divisionTeams.find(
      (
        team
      ) =>
        team.id ===
        team1Id
    );

  const team2 =
    divisionTeams.find(
      (
        team
      ) =>
        team.id ===
        team2Id
    );

  const matchPlayers =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            Player
          >();

        for (
          const player
          of team1?.roster ??
            []
        ) {
          map.set(
            player.id,
            player
          );
        }

        for (
          const player
          of team2?.roster ??
            []
        ) {
          map.set(
            player.id,
            player
          );
        }

        return [
          ...map.values(),
        ];
      },
      [
        team1,
        team2,
      ]
    );

  /* =========================================================
     FIND TEAM
  ========================================================= */

  function findTeam(
    value:
      | string
      | number
      | null
      | undefined,
    availableTeams:
      Team[] = teams
  ) {
    if (
      value ===
        null ||
      value ===
        undefined ||
      value ===
        ''
    ) {
      return undefined;
    }

    const numeric =
      Number(
        value
      );

    if (
      Number.isFinite(
        numeric
      )
    ) {
      const byId =
        availableTeams.find(
          (
            team
          ) =>
            Number(
              team.id
            ) ===
            numeric
        );

      if (
        byId
      ) {
        return byId;
      }
    }

    const search =
      normalizeText(
        String(
          value
        )
      );

    return availableTeams.find(
      (
        team
      ) =>
        normalizeText(
          team.name
        ) ===
          search ||
        normalizeText(
          team.shortName
        ) ===
          search
    );
  }

  /* =========================================================
     FIND PLAYER
  ========================================================= */

  function findPlayer(
    value:
      | string
      | number
      | null
      | undefined,
    availablePlayers:
      Player[]
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return undefined;
    }

    const numeric =
      Number(
        value
      );

    if (
      Number.isFinite(
        numeric
      )
    ) {
      const byId =
        availablePlayers.find(
          (
            player
          ) =>
            Number(
              player.id
            ) === numeric
        );

      if (
        byId
      ) {
        return byId;
      }
    }

    const rawSearch =
      String(
        value
      ).trim();

    const searchFull =
      normalizeText(
        rawSearch
      );

    const searchRiotName =
      normalizeRiotName(
        rawSearch
      );

    const exactMatch =
      availablePlayers.find(
        (
          player
        ) => {
          const playerFull =
            normalizeText(
              player.riotId
            );

          if (
            playerFull ===
            searchFull
          ) {
            return true;
          }

          const playerRiotName =
            normalizeRiotName(
              player.riotId
            );

          if (
            playerRiotName ===
            searchRiotName
          ) {
            return true;
          }

          const playerDiscord =
            normalizeText(
              player.discordName
            );

          if (
            playerDiscord &&
            playerDiscord ===
              searchFull
          ) {
            return true;
          }

          return false;
        }
      );

    if (
      exactMatch
    ) {
      return exactMatch;
    }

    /*
      Pseudo approchant
      (faute de frappe, lettre manquante).

      On garde le joueur le plus proche
      s'il est similaire à 80 % minimum
      et qu'aucun autre joueur
      n'est aussi proche.
    */
    const scored =
      availablePlayers
        .map(
          (
            player
          ) => ({
            player,
            score:
              Math.max(
                nameSimilarity(
                  searchRiotName,
                  normalizeRiotName(
                    player.riotId
                  )
                ),
                nameSimilarity(
                  searchFull,
                  normalizeText(
                    player.discordName
                  )
                )
              ),
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        );

    const best =
      scored[0];

    const second =
      scored[1];

    if (
      !best ||
      best.score <
        FUZZY_PLAYER_THRESHOLD ||
      (second &&
        second.score ===
          best.score)
    ) {
      return undefined;
    }

    return best.player;
  }

  /* =========================================================
     FIND CHAMPION
  ========================================================= */

  function findChampion(
    value:
      | string
      | null
      | undefined
  ) {
    if (
      !value
    ) {
      return undefined;
    }

    const search =
      normalizeText(
        value
      );

    return champions.find(
      (
        champion
      ) =>
        normalizeText(
          champion.id
        ) ===
          search ||
        normalizeText(
          champion.name
        ) ===
          search
    );
  }

  /* =========================================================
     CREATE GAME
  ========================================================= */

  function createGameFromTeams(
    number: number,
    firstTeam: Team,
    secondTeam: Team
  ): GameForm {
    const getDefaultPlayers =
      (
        team:
          Team
      ) => {
        const result:
          GamePlayer[] =
          [];

        for (
          const role
          of ROLES
        ) {
          const player =
            team.roster.find(
              (
                rosterPlayer
              ) =>
                normalizeRole(
                  rosterPlayer.role
                ) ===
                role
            );

          if (
            player
          ) {
            result.push(
              {
                playerId:
                  player.id,

                teamId:
                  team.id,

                role,

                championId:
                  '',

                kills:
                  0,

                deaths:
                  0,

                assists:
                  0,

                cs:
                  0,

                gold:
                  0,

                damage:
                  0,

                visionScore:
                  0,
              }
            );
          }
        }

        return result;
      };

    return {
      gameNumber:
        number,

      durationMinutes:
        0,

      durationSeconds:
        0,

      winnerTeamId:
        null,

      players: [
        ...getDefaultPlayers(
          firstTeam
        ),

        ...getDefaultPlayers(
          secondTeam
        ),
      ],

      substitutes: [],
    };
  }

  function createGame(
    number: number
  ):
    | GameForm
    | null {
    if (
      !team1 ||
      !team2
    ) {
      return null;
    }

    return createGameFromTeams(
      number,
      team1,
      team2
    );
  }

  /* =========================================================
     PREPARER LES GAMES
  ========================================================= */

  function regenerateGames() {
    if (
      !team1 ||
      !team2
    ) {
      setMessage(
        'Choisis les deux équipes.'
      );

      return;
    }

    if (
      team1.roster.length <
        5 ||
      team2.roster.length <
        5
    ) {
      setMessage(
        'Une des équipes ne possède pas assez de joueurs.'
      );

      return;
    }

    const gameCount =
      stage ===
      'pool'
        ? 2
        : bestOf;

    const nextGames:
      GameForm[] =
      [];

    for (
      let i = 1;
      i <=
      gameCount;
      i++
    ) {
      const game =
        createGame(
          i
        );

      if (
        game
      ) {
        nextGames.push(
          game
        );
      }
    }

    setGames(
      nextGames
    );

    setMatchMvpPlayerId(
      null
    );

    setMessage(
      stage ===
        'pool'
        ? 'Match de poule préparé : 2 games obligatoires.'
        : 'Games préparées.'
    );
  }

  /* =========================================================
     UPDATE PLAYER
  ========================================================= */

  function updatePlayer(
    gameIndex:
      number,

    playerIndex:
      number,

    patch:
      Partial<GamePlayer>
  ) {
    setGames(
      (
        current
      ) =>
        current.map(
          (
            game,
            gi
          ) => {
            if (
              gi !==
              gameIndex
            ) {
              return game;
            }

            return {
              ...game,

              players:
                game.players.map(
                  (
                    player,
                    pi
                  ) =>
                    pi ===
                    playerIndex
                      ? {
                          ...player,
                          ...patch,
                        }
                      : player
                ),
            };
          }
        )
    );
  }

  /* =========================================================
     UPDATE GAME
  ========================================================= */

  function updateGame(
    gameIndex:
      number,

    patch:
      Partial<GameForm>
  ) {
    setGames(
      (
        current
      ) =>
        current.map(
          (
            game,
            index
          ) =>
            index ===
            gameIndex
              ? {
                  ...game,
                  ...patch,
                }
              : game
        )
    );
  }

  /* =========================================================
     IMPORT JSON
  ========================================================= */

  // Charge le contenu d'un fichier .json dans la zone de texte.
  async function loadJsonFile(
    file:
      | File
      | null
      | undefined
  ) {
    if (
      !file
    ) {
      return;
    }

    try {
      const text =
        await file.text();

      setImportJson(
        text
      );

      setImportFileName(
        file.name
      );

      setMessage(
        `Fichier "${file.name}" chargé. Clique sur Importer le JSON.`
      );
    } catch {
      setMessage(
        `Impossible de lire le fichier "${file.name}".`
      );
    }
  }

  function importFromJson() {
    try {
      setMessage('');

      if (
        !importJson.trim()
      ) {
        throw new Error(
          'Colle le JSON avant de cliquer sur Importer.'
        );
      }

      let cleanJson =
        importJson
          .trim();

      cleanJson =
        cleanJson
          .replace(
            /^```json\s*/i,
            ''
          )
          .replace(
            /^```\s*/i,
            ''
          )
          .replace(
            /\s*```$/,
            ''
          );

      const parsed =
        JSON.parse(
          cleanJson
        ) as ImportJson;

      /* =====================================================
         DIVISION
      ===================================================== */

      const importedDivision:
        Division =
        parsed.division &&
        [
          'Yordle',
          'Ixtal',
          'Targon',
        ].includes(
          parsed.division
        )
          ? parsed.division
          : division;

      const importedDivisionTeams =
        teams.filter(
          (
            team
          ) =>
            team.division ===
            importedDivision
        );

      /* =====================================================
         EQUIPES
      ===================================================== */

      const importedTeam1 =
        findTeam(
          parsed.team1Id ??
            parsed.team1,
          importedDivisionTeams
        );

      const importedTeam2 =
        findTeam(
          parsed.team2Id ??
            parsed.team2,
          importedDivisionTeams
        );

      if (
        !importedTeam1 ||
        !importedTeam2
      ) {
        throw new Error(
          'Impossible de reconnaître une des deux équipes dans le JSON.'
        );
      }

      if (
        importedTeam1.id ===
        importedTeam2.id
      ) {
        throw new Error(
          'Les deux équipes du JSON sont identiques.'
        );
      }

      /* =====================================================
         PHASE
      ===================================================== */

      const importedStage =
        parsed.stage ===
        'playoff'
          ? 'playoff'
          : 'pool';

      let importedBestOf =
        importedStage ===
        'pool'
          ? 2
          : Number(
              parsed.bestOf ??
                3
            );

      if (
        importedStage ===
          'playoff' &&
        ![
          1,
          3,
          5,
        ].includes(
          importedBestOf
        )
      ) {
        importedBestOf =
          3;
      }

      if (
        !Array.isArray(
          parsed.games
        )
      ) {
        throw new Error(
          'Le JSON ne contient pas de tableau "games".'
        );
      }

      if (
        importedStage ===
          'pool' &&
        parsed.games.length !==
          2
      ) {
        throw new Error(
          'Un match de poule doit contenir exactement 2 games.'
        );
      }

      if (
        parsed.games.length ===
        0
      ) {
        throw new Error(
          'Aucune game dans le JSON.'
        );
      }

      /* =====================================================
         JOUEURS DISPONIBLES
      ===================================================== */

      const availablePlayers =
        [
          ...importedTeam1.roster,
          ...importedTeam2.roster,
        ];

      /*
        Pseudos corrigés automatiquement,
        affichés dans le message final.
      */
      const playerCorrections:
        string[] =
        [];

      /* =====================================================
         GAMES
      ===================================================== */

      const importedGames:
        GameForm[] =
        parsed.games.map(
          (
            importedGame,
            gameIndex
          ) => {
            const gameNumber =
              Number(
                importedGame.gameNumber ??
                  gameIndex +
                    1
              );

            let durationMinutes =
              Number(
                importedGame.durationMinutes ??
                  0
              );

            let durationSeconds =
              Number(
                importedGame.durationSeconds ??
                  0
              );

            if (
              importedGame.duration
            ) {
              const parts =
                String(
                  importedGame.duration
                )
                  .split(
                    ':'
                  )
                  .map(
                    Number
                  );

              if (
                parts.length >=
                  2 &&
                parts.every(
                  (
                    value
                  ) =>
                    Number.isFinite(
                      value
                    )
                )
              ) {
                durationMinutes =
                  parts[
                    parts.length -
                      2
                  ];

                durationSeconds =
                  parts[
                    parts.length -
                      1
                  ];
              }
            }

            /* WINNER */

            let winnerTeamId:
              | number
              | null =
              null;

            if (
              importedGame.winnerTeamId
            ) {
              const team =
                findTeam(
                  importedGame.winnerTeamId,
                  [
                    importedTeam1,
                    importedTeam2,
                  ]
                );

              winnerTeamId =
                team?.id ??
                null;
            } else {
              const winnerName =
                importedGame.winnerTeam ??
                importedGame.winner;

              if (
                winnerName
              ) {
                const team =
                  findTeam(
                    winnerName,
                    [
                      importedTeam1,
                      importedTeam2,
                    ]
                  );

                winnerTeamId =
                  team?.id ??
                  null;
              }
            }

            if (
              !winnerTeamId
            ) {
              throw new Error(
                `Vainqueur non reconnu pour la Game ${gameNumber}.`
              );
            }

            /*
              Le JSON décrit toujours
              les 10 participants réels,
              subs compris.
            */

            if (
              !Array.isArray(
                importedGame.players
              ) ||
              importedGame.players.length !==
                10
            ) {
              throw new Error(
                `La Game ${gameNumber} doit avoir exactement 10 joueurs dans le JSON.`
              );
            }

            const gamePlayers:
              GamePlayer[] =
              [];

            const gameSubstitutes:
              GameSubstitute[] =
              [];

            for (
              const importedPlayer
              of importedGame.players
            ) {
              /* =================================================
                 TEAM
              ================================================= */

              let playerTeam:
                | Team
                | undefined;

              if (
                importedPlayer.team
              ) {
                playerTeam =
                  findTeam(
                    importedPlayer.team,
                    [
                      importedTeam1,
                      importedTeam2,
                    ]
                  );
              }

              if (
                !playerTeam
              ) {
                throw new Error(
                  `Équipe non reconnue dans la Game ${gameNumber}.`
                );
              }

              /* =================================================
                 ROLE
              ================================================= */

              const role =
                normalizeRole(
                  importedPlayer.role
                );

              if (
                !role
              ) {
                throw new Error(
                  `Rôle non reconnu dans la Game ${gameNumber}.`
                );
              }

              /* =================================================
                 CHAMPION
              ================================================= */

              const championValue =
                importedPlayer.championId ??
                importedPlayer.champion;

              const champion =
                findChampion(
                  championValue
                );

              if (
                !champion
              ) {
                throw new Error(
                  `Champion "${championValue ?? '?'}" non reconnu, Game ${gameNumber}.`
                );
              }

              /* =================================================
                 SUB
              ================================================= */

              const isSub =
                importedPlayer.sub ===
                true;

              if (
                isSub
              ) {
                gameSubstitutes.push(
                  {
                    teamId:
                      playerTeam.id,

                    role,

                    championId:
                      champion.id,

                    kills:
                      Number(
                        importedPlayer.kills ??
                          0
                      ) ||
                      0,

                    deaths:
                      Number(
                        importedPlayer.deaths ??
                          0
                      ) ||
                      0,

                    assists:
                      Number(
                        importedPlayer.assists ??
                          0
                      ) ||
                      0,
                  }
                );

                /*
                  IMPORTANT :
                  on ne l'ajoute PAS
                  à gamePlayers.
                */

                continue;
              }

              /* =================================================
                 JOUEUR OFFICIEL
              ================================================= */

              const playerName =
                importedPlayer.player ??
                importedPlayer.riotId;

              let rosterPlayer =
                playerName
                  ? findPlayer(
                      playerName,
                      playerTeam.roster
                    )
                  : undefined;

              const matchedByName =
                Boolean(
                  rosterPlayer
                );

              if (
                !rosterPlayer
              ) {
                rosterPlayer =
                  playerTeam.roster.find(
                    (
                      player
                    ) =>
                      normalizeRole(
                        player.role
                      ) ===
                      role
                  );
              }

              if (
                !rosterPlayer
              ) {
                throw new Error(
                  `Aucun joueur ${role} trouvé dans le roster de ${playerTeam.name}, Game ${gameNumber}.`
                );
              }

              if (
                playerName &&
                !matchedByName
              ) {
                playerCorrections.push(
                  `Game ${gameNumber} : "${playerName}" introuvable, remplacé par le ${role} du roster (${rosterPlayer.riotId})`
                );
              } else if (
                playerName &&
                normalizeRiotName(
                  playerName
                ) !==
                  normalizeRiotName(
                    rosterPlayer.riotId
                  ) &&
                normalizeText(
                  playerName
                ) !==
                  normalizeText(
                    rosterPlayer.discordName
                  )
              ) {
                playerCorrections.push(
                  `Game ${gameNumber} : "${playerName}" → ${rosterPlayer.riotId}`
                );
              }

              gamePlayers.push(
                {
                  playerId:
                    rosterPlayer.id,

                  teamId:
                    playerTeam.id,

                  role,

                  championId:
                    champion.id,

                  kills:
                    Number(
                      importedPlayer.kills ??
                        0
                    ) ||
                    0,

                  deaths:
                    Number(
                      importedPlayer.deaths ??
                        0
                    ) ||
                    0,

                  assists:
                    Number(
                      importedPlayer.assists ??
                        0
                    ) ||
                    0,

                  cs:
                    Number(
                      importedPlayer.cs ??
                        0
                    ) ||
                    0,

                  gold:
                    Number(
                      importedPlayer.gold ??
                        0
                    ) ||
                    0,

                  damage:
                    Number(
                      importedPlayer.damage ??
                        0
                    ) ||
                    0,

                  visionScore:
                    Number(
                      importedPlayer.visionScore ??
                        importedPlayer.vision ??
                        0
                    ) ||
                    0,
                }
              );
            }

            return {
              gameNumber,

              durationMinutes,

              durationSeconds,

              winnerTeamId,

              players:
                gamePlayers,

              substitutes:
                gameSubstitutes,
            };
          }
        );

      /* =====================================================
         MVP DU MATCH
      ===================================================== */

      const importedMvpValue =
        parsed.mvpPlayerId ??
        parsed.mvpPlayer ??
        parsed.mvp;

      let importedMvpId:
        | number
        | null =
        null;

      if (
        importedMvpValue !==
          undefined &&
        importedMvpValue !==
          null &&
        importedMvpValue !==
          ''
      ) {
        const importedMvp =
          findPlayer(
            importedMvpValue,
            availablePlayers
          );

        if (
          !importedMvp
        ) {
          throw new Error(
            `MVP "${String(
              importedMvpValue
            )}" non reconnu. Un sub ne peut pas être MVP.`
          );
        }

        const mvpPlayed =
          importedGames.some(
            (
              game
            ) =>
              game.players.some(
                (
                  player
                ) =>
                  player.playerId ===
                  importedMvp.id
              )
          );

        if (
          !mvpPlayed
        ) {
          throw new Error(
            `Le MVP "${importedMvp.riotId}" n'a aucune statistique enregistrée sur ce match.`
          );
        }

        importedMvpId =
          importedMvp.id;
      }

      /* =====================================================
         APPLY
      ===================================================== */

      setDivision(
        importedDivision
      );

      setTeam1Id(
        importedTeam1.id
      );

      setTeam2Id(
        importedTeam2.id
      );

      setStage(
        importedStage
      );

      setBracket(
        parsed.bracket ??
          'winner'
      );

      setRound(
        parsed.round ??
          ''
      );

      setBestOf(
        importedBestOf
      );

      setGames(
        importedGames
      );

      setMatchMvpPlayerId(
        importedMvpId
      );

      const totalSubs =
        importedGames.reduce(
          (
            total,
            game
          ) =>
            total +
            game.substitutes.length,
          0
        );

      const correctionsText =
        playerCorrections.length > 0
          ? ` Pseudos corrigés : ${playerCorrections.join(' ; ')}.`
          : '';

      setMessage(
        (totalSubs > 0
          ? `JSON importé : ${importedTeam1.name} vs ${importedTeam2.name}, ${importedGames.length} games. ${totalSubs} sub(s) conservé(s) pour l'historique mais ignoré(s) dans les statistiques. Vérifie puis enregistre le match.`
          : `JSON importé : ${importedTeam1.name} vs ${importedTeam2.name}, ${importedGames.length} games. Vérifie les données puis enregistre le match.`) +
          correctionsText
      );
    } catch (
      error: any
    ) {
      console.error(
        '[IMPORT JSON]',
        error
      );

      setMessage(
        error?.message ||
          'JSON invalide.'
      );
    }
  }

  /* =========================================================
     SAVE MATCH
  ========================================================= */

  async function saveMatch() {
    try {
      setSaving(
        true
      );

      setMessage('');

      if (
        !team1Id ||
        !team2Id
      ) {
        throw new Error(
          'Choisis deux équipes.'
        );
      }

      const playedGames =
        games.filter(
          (
            game
          ) =>
            game.winnerTeamId !==
            null
        );

      if (
        stage ===
          'pool' &&
        playedGames.length !==
          2
      ) {
        throw new Error(
          'Un match de poule doit obligatoirement avoir exactement 2 games terminées.'
        );
      }

      if (
        playedGames.length ===
        0
      ) {
        throw new Error(
          'Aucune game terminée.'
        );
      }

      /* =====================================================
         VERIFICATION GAMES
      ===================================================== */

      for (
        const game
        of playedGames
      ) {
        const totalDuration =
          game.durationMinutes *
            60 +
          game.durationSeconds;

        if (
          totalDuration <=
          0
        ) {
          throw new Error(
            `Durée manquante pour la Game ${game.gameNumber}.`
          );
        }

        const totalParticipants =
          game.players.length +
          game.substitutes.length;

        if (
          totalParticipants !==
          10
        ) {
          throw new Error(
            `La Game ${game.gameNumber} doit contenir exactement 10 participants avec les subs. Actuellement : ${totalParticipants}.`
          );
        }

        for (
          const player
          of game.players
        ) {
          if (
            !player.championId
          ) {
            throw new Error(
              `Champion manquant dans la Game ${game.gameNumber}.`
            );
          }
        }

        for (
          const sub
          of game.substitutes
        ) {
          if (
            !sub.championId
          ) {
            throw new Error(
              `Champion du sub manquant dans la Game ${game.gameNumber}.`
            );
          }
        }
      }

      /* =====================================================
         MVP UNIQUE
      ===================================================== */

      if (
        !matchMvpPlayerId
      ) {
        throw new Error(
          'Choisis le MVP du match.'
        );
      }

      const mvpPlayedMatch =
        playedGames.some(
          (
            game
          ) =>
            game.players.some(
              (
                player
              ) =>
                player.playerId ===
                matchMvpPlayerId
            )
        );

      if (
        !mvpPlayedMatch
      ) {
        throw new Error(
          'Le MVP sélectionné n’a joué aucune game enregistrée du match.'
        );
      }

      /* =====================================================
         SCORE
      ===================================================== */

      const winsTeam1 =
        playedGames.filter(
          (
            game
          ) =>
            game.winnerTeamId ===
            team1Id
        ).length;

      const winsTeam2 =
        playedGames.filter(
          (
            game
          ) =>
            game.winnerTeamId ===
            team2Id
        ).length;

      let winnerTeamId:
        | number
        | null =
        null;

      if (
        winsTeam1 >
        winsTeam2
      ) {
        winnerTeamId =
          team1Id;
      } else if (
        winsTeam2 >
        winsTeam1
      ) {
        winnerTeamId =
          team2Id;
      }

      if (
        stage ===
          'playoff' &&
        winnerTeamId ===
          null
      ) {
        throw new Error(
          'Un match de playoffs doit avoir un vainqueur.'
        );
      }

      /* =====================================================
         AUTH
      ===================================================== */

      const {
        data:
          sessionData,
      } =
        await supabase
          .auth
          .getSession();

      const token =
        sessionData.session
          ?.access_token;

      if (
        !token
      ) {
        throw new Error(
          'Tu dois être connecté.'
        );
      }

      /* =====================================================
         BODY
      ===================================================== */

      const body = {
        division,

        team1Id,
        team2Id,

        winnerTeamId,

        mvpPlayerId:
          matchMvpPlayerId,

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

        bestOf:
          stage ===
          'pool'
            ? 2
            : bestOf,

        games:
          playedGames.map(
            (
              game
            ) => ({
              gameNumber:
                game.gameNumber,

              durationSeconds:
                game.durationMinutes *
                  60 +
                game.durationSeconds,

              winnerTeamId:
                game.winnerTeamId,

              /*
                JOUEURS OFFICIELS
              */

              players:
                game.players.map(
                  (
                    player
                  ) => ({
                    playerId:
                      player.playerId,

                    teamId:
                      player.teamId,

                    role:
                      player.role,

                    championId:
                      player.championId,

                    kills:
                      Number(
                        player.kills
                      ) ||
                      0,

                    deaths:
                      Number(
                        player.deaths
                      ) ||
                      0,

                    assists:
                      Number(
                        player.assists
                      ) ||
                      0,

                    cs:
                      Number(
                        player.cs
                      ) ||
                      0,

                    gold:
                      Number(
                        player.gold
                      ) ||
                      0,

                    damage:
                      Number(
                        player.damage
                      ) ||
                      0,

                    visionScore:
                      Number(
                        player.visionScore
                      ) ||
                      0,
                  })
                ),

              /*
                SUBS

                Seulement champion +
                rôle + équipe + KDA.
              */

              substitutes:
                game.substitutes.map(
                  (
                    sub
                  ) => ({
                    teamId:
                      sub.teamId,

                    role:
                      sub.role,

                    championId:
                      sub.championId,

                    kills:
                      Number(
                        sub.kills
                      ) ||
                      0,

                    deaths:
                      Number(
                        sub.deaths
                      ) ||
                      0,

                    assists:
                      Number(
                        sub.assists
                      ) ||
                      0,
                  })
                ),
            })
          ),
      };

      const res =
        await fetch(
          '/api/admin/results',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                body
              ),
          }
        );

      const data =
        await res.json();

      if (
        !res.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            'Erreur lors de l’enregistrement.'
        );
      }

      const subCount =
        playedGames.reduce(
          (
            total,
            game
          ) =>
            total +
            game.substitutes.length,
          0
        );

      setMessage(
        subCount > 0
          ? `Match enregistré ! ID ${data.matchId} — Score ${winsTeam1}-${winsTeam2} — ${subCount} sub(s) conservé(s) pour l'historique.`
          : `Match enregistré ! ID ${data.matchId} — Score ${winsTeam1}-${winsTeam2}`
      );

      setGames(
        []
      );

      setMatchMvpPlayerId(
        null
      );

      setImportJson(
        ''
      );

      setImportFileName(
        ''
      );
    } catch (
      error: any
    ) {
      console.error(
        '[ADMIN RESULTS]',
        error
      );

      setMessage(
        error?.message ||
          'Erreur inconnue'
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      <Nav />

      <main className="section adminResultsPage">
        <div className="sectionTitle">
          <span />

          <h2>
            Admin résultats
          </h2>
        </div>

        <MatchManager />

        {/* =================================================
            IMPORT JSON
        ================================================= */}

        <section className="card importCard">
          <div className="importHeader">
            <div>
              <h3>
                Import JSON
              </h3>

              <p>
                Colle ici le JSON que je te donne après les captures du match,
                ou choisis / glisse le fichier .json.
                Tout le formulaire sera rempli automatiquement.
              </p>
            </div>

            <span className="importBadge">
              CAPTURES → JSON → IMPORT
            </span>
          </div>

          <textarea
            className={`jsonTextarea ${
              dragOver
                ? 'jsonTextareaDrop'
                : ''
            }`}
            value={
              importJson
            }
            onChange={(
              e
            ) => {
              setImportJson(
                e.target
                  .value
              );

              setImportFileName(
                ''
              );
            }}
            onDragOver={(
              e
            ) => {
              e.preventDefault();

              setDragOver(
                true
              );
            }}
            onDragLeave={() =>
              setDragOver(
                false
              )
            }
            onDrop={(
              e
            ) => {
              e.preventDefault();

              setDragOver(
                false
              );

              loadJsonFile(
                e.dataTransfer
                  .files[0]
              );
            }}
            placeholder={`{
  "division": "Ixtal",
  "team1": "Season's",
  "team2": "SNOW KIDS",
  "stage": "pool",
  "mvp": "Mad",
  "games": [...]
}`}
          />

          <div className="importActions">
            <label className="importFileButton">
              Choisir un fichier .json

              <input
                type="file"
                accept=".json,application/json"
                onChange={(
                  e
                ) => {
                  loadJsonFile(
                    e.target
                      .files?.[0]
                  );

                  // Permet de recharger le même fichier.
                  e.target.value =
                    '';
                }}
              />
            </label>

            {importFileName && (
              <span className="importFileName">
                {importFileName}
              </span>
            )}

            <button
              className="importButton"
              type="button"
              onClick={
                importFromJson
              }
            >
              Importer le JSON
            </button>
          </div>
        </section>

        {/* =================================================
            NOUVEAU MATCH
        ================================================= */}

        <section className="card adminSetup">
          <h3>
            Nouveau match
          </h3>

          <div className="setupGrid">
            <label>
              Division

              <select
                value={
                  division
                }
                onChange={(
                  e
                ) => {
                  setDivision(
                    e.target
                      .value as Division
                  );

                  setTeam1Id(
                    null
                  );

                  setTeam2Id(
                    null
                  );

                  setGames(
                    []
                  );

                  setMatchMvpPlayerId(
                    null
                  );
                }}
              >
                <option value="Yordle">
                  Yordle
                </option>

                <option value="Ixtal">
                  Ixtal
                </option>

                <option value="Targon">
                  Targon
                </option>
              </select>
            </label>

            <label>
              Équipe 1

              <select
                value={
                  team1Id ??
                  ''
                }
                onChange={(
                  e
                ) => {
                  const value =
                    e.target
                      .value;

                  setTeam1Id(
                    value
                      ? Number(
                          value
                        )
                      : null
                  );

                  setGames(
                    []
                  );

                  setMatchMvpPlayerId(
                    null
                  );
                }}
              >
                <option value="">
                  Choisir
                </option>

                {divisionTeams.map(
                  (
                    team
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                      disabled={
                        team.id ===
                        team2Id
                      }
                    >
                      {
                        team.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Équipe 2

              <select
                value={
                  team2Id ??
                  ''
                }
                onChange={(
                  e
                ) => {
                  const value =
                    e.target
                      .value;

                  setTeam2Id(
                    value
                      ? Number(
                          value
                        )
                      : null
                  );

                  setGames(
                    []
                  );

                  setMatchMvpPlayerId(
                    null
                  );
                }}
              >
                <option value="">
                  Choisir
                </option>

                {divisionTeams.map(
                  (
                    team
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                      disabled={
                        team.id ===
                        team1Id
                      }
                    >
                      {
                        team.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Phase

              <select
                value={
                  stage
                }
                onChange={(
                  e
                ) =>
                  setStage(
                    e.target
                      .value as
                      | 'pool'
                      | 'playoff'
                  )
                }
              >
                <option value="pool">
                  Poules
                </option>

                <option value="playoff">
                  Playoffs
                </option>
              </select>
            </label>

            {stage ===
              'playoff' && (
              <>
                <label>
                  Bracket

                  <select
                    value={
                      bracket
                    }
                    onChange={(
                      e
                    ) =>
                      setBracket(
                        e.target
                          .value as
                          | 'winner'
                          | 'loser'
                          | 'grand_final'
                      )
                    }
                  >
                    <option value="winner">
                      Winner
                    </option>

                    <option value="loser">
                      Loser
                    </option>

                    <option value="grand_final">
                      Grande finale
                    </option>
                  </select>
                </label>

                <label>
                  Round

                  <input
                    value={
                      round
                    }
                    onChange={(
                      e
                    ) =>
                      setRound(
                        e.target
                          .value
                      )
                    }
                    placeholder="Quart, Demi..."
                  />
                </label>
              </>
            )}

            <label>
              Format

              {stage ===
              'pool' ? (
                <select
                  value="2"
                  disabled
                >
                  <option value="2">
                    2 Games fixes
                  </option>
                </select>
              ) : (
                <select
                  value={
                    bestOf
                  }
                  onChange={(
                    e
                  ) => {
                    setBestOf(
                      Number(
                        e.target
                          .value
                      )
                    );

                    setGames(
                      []
                    );
                  }}
                >
                  <option value={1}>
                    BO1
                  </option>

                  <option value={3}>
                    BO3
                  </option>

                  <option value={5}>
                    BO5
                  </option>
                </select>
              )}
            </label>

            <label>
              MVP du match

              <select
                value={
                  matchMvpPlayerId ??
                  ''
                }
                onChange={(
                  e
                ) =>
                  setMatchMvpPlayerId(
                    e.target
                      .value
                      ? Number(
                          e.target
                            .value
                        )
                      : null
                  )
                }
                disabled={
                  !team1 ||
                  !team2
                }
              >
                <option value="">
                  Choisir
                </option>

                {matchPlayers.map(
                  (
                    player
                  ) => (
                    <option
                      key={
                        player.id
                      }
                      value={
                        player.id
                      }
                    >
                      {
                        player.riotId
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {stage ===
            'pool' && (
            <div className="poolNotice">
              Poules : exactement 2 games. Scores possibles : 2-0, 1-1 ou 0-2.
            </div>
          )}

          <button
            className="joinTeamBtn"
            type="button"
            onClick={
              regenerateGames
            }
          >
            Préparer le match
          </button>

          {message && (
            <p className="adminMessage">
              {
                message
              }
            </p>
          )}
        </section>

        {/* =================================================
            GAMES
        ================================================= */}

        {games.map(
          (
            game,
            gameIndex
          ) => (
            <section
              key={
                game.gameNumber
              }
              className="card gameCard"
            >
              <div className="gameHeader">
                <div>
                  <h3>
                    Game{' '}
                    {
                      game.gameNumber
                    }
                  </h3>

                  {game.substitutes.length >
                    0 && (
                    <span className="subNotice">
                      {
                        game
                          .substitutes
                          .length
                      }{' '}
                      SUB
                      {game
                        .substitutes
                        .length >
                      1
                        ? 'S'
                        : ''}{' '}
                      — conservé
                      {game
                        .substitutes
                        .length >
                      1
                        ? 's'
                        : ''}{' '}
                      uniquement pour l'historique
                    </span>
                  )}
                </div>

                <div className="gameOptions">
                  <label>
                    Durée min

                    <input
                      type="number"
                      min="0"
                      value={
                        game.durationMinutes
                      }
                      onChange={(
                        e
                      ) =>
                        updateGame(
                          gameIndex,
                          {
                            durationMinutes:
                              Number(
                                e.target
                                  .value
                              ) ||
                              0,
                          }
                        )
                      }
                    />
                  </label>

                  <label>
                    sec

                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={
                        game.durationSeconds
                      }
                      onChange={(
                        e
                      ) => {
                        const value =
                          Math.max(
                            0,
                            Math.min(
                              59,
                              Number(
                                e.target
                                  .value
                              ) ||
                                0
                            )
                          );

                        updateGame(
                          gameIndex,
                          {
                            durationSeconds:
                              value,
                          }
                        );
                      }}
                    />
                  </label>

                  <label>
                    Vainqueur

                    <select
                      value={
                        game.winnerTeamId ??
                        ''
                      }
                      onChange={(
                        e
                      ) => {
                        const value =
                          e.target
                            .value;

                        updateGame(
                          gameIndex,
                          {
                            winnerTeamId:
                              value
                                ? Number(
                                    value
                                  )
                                : null,
                          }
                        );
                      }}
                    >
                      <option value="">
                        -
                      </option>

                      <option
                        value={
                          team1Id ??
                          ''
                        }
                      >
                        {
                          team1?.name
                        }
                      </option>

                      <option
                        value={
                          team2Id ??
                          ''
                        }
                      >
                        {
                          team2?.name
                        }
                      </option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="gameTable">
                <div className="gameTableHeader">
                  <span>
                    Rôle
                  </span>

                  <span>
                    Joueur
                  </span>

                  <span>
                    Champion
                  </span>

                  <span>
                    K
                  </span>

                  <span>
                    D
                  </span>

                  <span>
                    A
                  </span>

                  <span>
                    CS
                  </span>

                  <span>
                    Gold
                  </span>

                  <span>
                    DMG
                  </span>

                  <span>
                    Vision
                  </span>
                </div>

                {game.players.map(
                  (
                    player,
                    playerIndex
                  ) => (
                    <div
                      key={`${game.gameNumber}-${player.playerId}-${player.role}`}
                      className="gamePlayerRow"
                    >
                      <strong>
                        {
                          player.role
                        }
                      </strong>

                      <select
                        value={
                          player.playerId
                        }
                        onChange={(
                          e
                        ) => {
                          const newPlayerId =
                            Number(
                              e.target
                                .value
                            );

                          const selectedPlayer =
                            matchPlayers.find(
                              (
                                p
                              ) =>
                                p.id ===
                                newPlayerId
                            );

                          if (
                            !selectedPlayer
                          ) {
                            return;
                          }

                          const selectedTeamId =
                            team1?.roster.some(
                              (
                                p
                              ) =>
                                p.id ===
                                selectedPlayer.id
                            )
                              ? team1.id
                              : team2?.id ??
                                player.teamId;

                          updatePlayer(
                            gameIndex,
                            playerIndex,
                            {
                              playerId:
                                selectedPlayer.id,

                              teamId:
                                selectedTeamId,
                            }
                          );
                        }}
                      >
                        {matchPlayers.map(
                          (
                            rosterPlayerOption
                          ) => (
                            <option
                              key={
                                rosterPlayerOption.id
                              }
                              value={
                                rosterPlayerOption.id
                              }
                            >
                              {
                                rosterPlayerOption.riotId
                              }
                            </option>
                          )
                        )}
                      </select>

                      <select
                        value={
                          player.championId
                        }
                        onChange={(
                          e
                        ) =>
                          updatePlayer(
                            gameIndex,
                            playerIndex,
                            {
                              championId:
                                e.target
                                  .value,
                            }
                          )
                        }
                      >
                        <option value="">
                          Champion
                        </option>

                        {champions.map(
                          (
                            champion
                          ) => (
                            <option
                              key={
                                champion.id
                              }
                              value={
                                champion.id
                              }
                            >
                              {
                                champion.name
                              }
                            </option>
                          )
                        )}
                      </select>

                      {(
                        [
                          'kills',
                          'deaths',
                          'assists',
                          'cs',
                          'gold',
                          'damage',
                          'visionScore',
                        ] as const
                      ).map(
                        (
                          field
                        ) => (
                          <input
                            key={
                              field
                            }
                            type="number"
                            min="0"
                            value={
                              player[
                                field
                              ]
                            }
                            onChange={(
                              e
                            ) =>
                              updatePlayer(
                                gameIndex,
                                playerIndex,
                                {
                                  [field]:
                                    Number(
                                      e.target
                                        .value
                                    ) ||
                                    0,
                                }
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            </section>
          )
        )}

        {/* =================================================
            ENREGISTRER
        ================================================= */}

        {games.length >
          0 && (
          <button
            className="saveMatchButton"
            type="button"
            disabled={
              saving
            }
            onClick={
              saveMatch
            }
          >
            {saving
              ? 'Enregistrement...'
              : 'Enregistrer le match'}
          </button>
        )}

        {/* =================================================
            CSS
        ================================================= */}

        <style jsx>{`
          .adminResultsPage {
            position: relative;
          }

          .adminSetup,
          .importCard {
            margin-bottom: 20px;
          }

          .importHeader {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 16px;
          }

          .importHeader h3 {
            margin-bottom: 5px;
          }

          .importHeader p {
            margin: 0;
            max-width: 650px;
            color: var(--navy);
            font-size: 12px;
            line-height: 1.5;
            opacity: 0.75;
          }

          .importBadge {
            padding: 8px 12px;
            border-radius: 5px;
            background: var(--orange);
            color: white;
            font-size: 10px;
            font-weight: 900;
            white-space: nowrap;
          }

          .jsonTextarea {
            width: 100%;
            min-height: 230px;
            resize: vertical;
            padding: 14px;
            border: 1px solid rgba(9, 42, 63, 0.15);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.65);
            color: var(--navy);
            font-family: monospace;
            font-size: 12px;
            line-height: 1.5;
          }

          .jsonTextareaDrop {
            border: 2px dashed var(--orange);
            background: rgba(255, 255, 255, 0.9);
          }

          .importActions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
          }

          .importFileButton {
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            min-height: 46px;
            padding: 0 22px;
            border: 2px solid var(--orange);
            border-radius: 6px;
            background: transparent;
            color: var(--orange);
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
          }

          .importFileButton input {
            display: none;
          }

          .importFileName {
            color: var(--navy);
            font-family: monospace;
            font-size: 12px;
            opacity: 0.75;
          }

          .importButton {
            margin-left: auto;
            min-height: 46px;
            padding: 0 22px;
            border: 0;
            border-radius: 6px;
            background: var(--orange);
            color: white;
            font-weight: 900;
            cursor: pointer;
          }

          .setupGrid {
            display: grid;
            grid-template-columns:
              repeat(
                3,
                minmax(
                  0,
                  1fr
                )
              );
            gap: 14px;
            margin:
              20px
              0;
          }

          label {
            display: flex;
            flex-direction:
              column;
            gap: 6px;
            color:
              var(--navy);
            font-size:
              11px;
            font-weight:
              900;
            text-transform:
              uppercase;
          }

          label input,
          label select {
            width:
              100%;
          }

          .poolNotice {
            margin: 0 0 16px;
            padding: 12px 14px;
            border-left: 4px solid var(--orange);
            background: rgba(255, 126, 42, 0.08);
            color: var(--navy);
            font-size: 12px;
            font-weight: 800;
          }

          .adminMessage {
            margin-top:
              15px;
            color:
              var(--orange);
            font-weight:
              800;
          }

          .gameCard {
            margin-bottom:
              20px;
          }

          .gameHeader {
            display:
              flex;
            align-items:
              flex-end;
            justify-content:
              space-between;
            gap: 20px;
            margin-bottom:
              22px;
          }

          .subNotice {
            display: inline-block;
            margin-top: 6px;
            padding: 5px 8px;
            border-radius: 5px;
            background: rgba(255, 126, 42, 0.1);
            color: var(--orange);
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .gameOptions {
            display:
              flex;
            align-items:
              flex-end;
            gap: 10px;
            flex-wrap:
              wrap;
          }

          .gameOptions label {
            width:
              130px;
          }

          .gameTable {
            overflow-x:
              auto;
          }

          .gameTableHeader,
          .gamePlayerRow {
            display:
              grid;
            grid-template-columns:
              85px
              minmax(
                160px,
                1fr
              )
              minmax(
                150px,
                1fr
              )
              65px
              65px
              65px
              80px
              100px
              100px
              90px;
            gap:
              8px;
            align-items:
              center;
            min-width:
              1100px;
          }

          .gameTableHeader {
            padding:
              0
              8px
              10px;
            color:
              var(--navy);
            font-size:
              10px;
            font-weight:
              900;
            text-transform:
              uppercase;
          }

          .gamePlayerRow {
            padding:
              8px;
            border-top:
              1px
              solid
              rgba(
                9,
                42,
                63,
                0.08
              );
          }

          .gamePlayerRow input,
          .gamePlayerRow select {
            width:
              100%;
            min-height:
              42px;
            padding:
              8px;
          }

          .gamePlayerRow strong {
            color:
              var(--orange);
            font-size:
              11px;
          }

          .saveMatchButton {
            width:
              100%;
            min-height:
              58px;
            margin-top:
              8px;
            border:
              0;
            border-radius:
              8px;
            background:
              var(--navy);
            color:
              white;
            font-size:
              14px;
            font-weight:
              900;
            cursor: pointer;
          }

          .saveMatchButton:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (
            max-width:
              900px
          ) {
            .setupGrid {
              grid-template-columns:
                1fr;
            }

            .gameHeader {
              align-items:
                stretch;
              flex-direction:
                column;
            }

            .importHeader {
              flex-direction:
                column;
            }
          }
        `}</style>
      </main>
    </>
  );
}