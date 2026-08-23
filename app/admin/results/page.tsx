
'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../../components/Nav';
import { supabase } from '@/lib/supabase';

type Division = 'Yordle' | 'Ixtal' | 'Targon';

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
};

type GameForm = {
  gameNumber: number;

  durationMinutes: number;
  durationSeconds: number;

  winnerTeamId: number | null;
  mvpPlayerId: number | null;

  players: GamePlayer[];

  jsonImport: string;
  importMessage: string;
};

type JsonPlayer = {
  riotId?: string;
  playerId?: number;

  role: Role;

  championId: string;

  kills: number;
  deaths: number;
  assists: number;

  cs: number;
  gold: number;
  damage: number;
};

type JsonGame = {
  durationMinutes: number;
  durationSeconds: number;

  winner:
    | 'team1'
    | 'team2'
    | number
    | string;

  players: JsonPlayer[];
};

const ROLES: Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

const SAVE_ENDPOINT =
  '/api/admin/results';

export default function AdminResultsPage() {
  const [division, setDivision] =
    useState<Division>('Yordle');

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [champions, setChampions] =
    useState<Champion[]>([]);

  const [team1Id, setTeam1Id] =
    useState<number | null>(null);

  const [team2Id, setTeam2Id] =
    useState<number | null>(null);

  const [stage, setStage] =
    useState<'pool' | 'playoff'>(
      'pool'
    );

  const [bracket, setBracket] =
    useState<
      | 'winner'
      | 'loser'
      | 'grand_final'
    >('winner');

  const [round, setRound] =
    useState('');

  const [bestOf, setBestOf] =
    useState(1);

  const [games, setGames] =
    useState<GameForm[]>([]);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    async function load() {
      try {
        const res =
          await fetch(
            '/api/results',
            {
              cache: 'no-store',
            }
          );

        const data =
          await res.json();

        const allTeams: Team[] =
          (data.teams || []).map(
            (team: any) => ({
              ...team,
              id: Number(team.id),

              roster:
                (
                  team.roster ||
                  []
                ).map(
                  (player: any) => ({
                    ...player,
                    id: Number(
                      player.id
                    ),
                  })
                ),
            })
          );

        setTeams(
          allTeams
        );

        setChampions(
          data.champions || []
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setMessage(
          'Impossible de charger les équipes.'
        );
      }
    }

    load();
  }, []);

  const divisionTeams =
    useMemo(
      () =>
        teams.filter(
          (team) =>
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
      (team) =>
        team.id ===
        team1Id
    );

  const team2 =
    divisionTeams.find(
      (team) =>
        team.id ===
        team2Id
    );

  function normalizeRiotId(
    value: string
  ) {
    return value
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        ''
      );
  }

  function getPlayer(
    playerId: number
  ) {
    return [
      ...(team1?.roster ??
        []),

      ...(team2?.roster ??
        []),
    ].find(
      (player) =>
        Number(
          player.id
        ) ===
        Number(
          playerId
        )
    );
  }

  function getTeamForPlayer(
    playerId: number
  ) {
    if (
      team1?.roster.some(
        (player) =>
          Number(
            player.id
          ) ===
          Number(
            playerId
          )
      )
    ) {
      return team1;
    }

    if (
      team2?.roster.some(
        (player) =>
          Number(
            player.id
          ) ===
          Number(
            playerId
          )
      )
    ) {
      return team2;
    }

    return null;
  }

  function playersForRole(
    team: Team,
    role: Role
  ) {
    const normal =
      team.roster.filter(
        (player) =>
          player.role === role
      );

    const others =
      team.roster.filter(
        (player) =>
          player.role !== role
      );

    return [
      ...normal,
      ...others,
    ];
  }

  function initialPlayerForRole(
    team: Team,
    role: Role
  ) {
    const exact =
      team.roster.find(
        (player) =>
          player.role === role
      );

    return (
      exact ??
      team.roster[0] ??
      null
    );
  }

  function createGame(
    number: number
  ): GameForm | null {
    if (
      !team1 ||
      !team2
    ) {
      return null;
    }

    const players:
      GamePlayer[] = [];

    for (
      const role
      of ROLES
    ) {
      const player =
        initialPlayerForRole(
          team1,
          role
        );

      if (!player) {
        return null;
      }

      players.push({
        playerId:
          Number(
            player.id
          ),

        teamId:
          Number(
            team1.id
          ),

        role,

        championId:
          '',

        kills: 0,
        deaths: 0,
        assists: 0,

        cs: 0,
        gold: 0,
        damage: 0,
      });
    }

    for (
      const role
      of ROLES
    ) {
      const player =
        initialPlayerForRole(
          team2,
          role
        );

      if (!player) {
        return null;
      }

      players.push({
        playerId:
          Number(
            player.id
          ),

        teamId:
          Number(
            team2.id
          ),

        role,

        championId:
          '',

        kills: 0,
        deaths: 0,
        assists: 0,

        cs: 0,
        gold: 0,
        damage: 0,
      });
    }

    return {
      gameNumber:
        number,

      durationMinutes:
        0,

      durationSeconds:
        0,

      winnerTeamId:
        null,

      mvpPlayerId:
        null,

      players,

      jsonImport:
        '',

      importMessage:
        '',
    };
  }

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
      bestOf === 1
        ? 1
        : bestOf === 3
        ? 3
        : 5;

    const nextGames:
      GameForm[] = [];

    for (
      let i = 1;
      i <= gameCount;
      i++
    ) {
      const game =
        createGame(i);

      if (!game) {
        setMessage(
          'Impossible de créer les 5 rôles pour une des équipes.'
        );

        return;
      }

      nextGames.push(
        game
      );
    }

    setGames(
      nextGames
    );

    setMessage(
      'Match préparé. Tu peux maintenant importer le JSON CZF de chaque game.'
    );
  }

  function updatePlayer(
    gameIndex: number,
    playerIndex: number,
    patch:
      Partial<GamePlayer>
  ) {
    setGames(
      (current) =>
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

  function updateGame(
    gameIndex: number,
    patch:
      Partial<GameForm>
  ) {
    setGames(
      (current) =>
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

  function changeParticipant(
    gameIndex: number,
    playerIndex: number,
    newPlayerId: number
  ) {
    const game =
      games[gameIndex];

    if (!game) {
      return;
    }

    const currentSlot =
      game.players[
        playerIndex
      ];

    const team =
      currentSlot.teamId ===
      team1?.id
        ? team1
        : team2;

    if (!team) {
      return;
    }

    const newPlayer =
      team.roster.find(
        (player) =>
          Number(
            player.id
          ) ===
          Number(
            newPlayerId
          )
      );

    if (!newPlayer) {
      setMessage(
        'Ce joueur ne fait pas partie de cette équipe.'
      );

      return;
    }

    const alreadyUsed =
      game.players.some(
        (
          player,
          index
        ) =>
          index !==
            playerIndex &&
          Number(
            player.playerId
          ) ===
            Number(
              newPlayerId
            )
      );

    if (
      alreadyUsed
    ) {
      setMessage(
        'Ce joueur participe déjà à cette game.'
      );

      return;
    }

    updatePlayer(
      gameIndex,
      playerIndex,
      {
        playerId:
          Number(
            newPlayer.id
          ),

        role:
          currentSlot.role,

        championId:
          '',

        kills: 0,
        deaths: 0,
        assists: 0,

        cs: 0,
        gold: 0,
        damage: 0,
      }
    );

    if (
      game.mvpPlayerId ===
      currentSlot.playerId
    ) {
      updateGame(
        gameIndex,
        {
          mvpPlayerId:
            null,
        }
      );
    }
  }

  function resolveWinner(
    value:
      JsonGame['winner']
  ) {
    if (
      !team1 ||
      !team2
    ) {
      return null;
    }

    if (
      value ===
      'team1'
    ) {
      return team1.id;
    }

    if (
      value ===
      'team2'
    ) {
      return team2.id;
    }

    if (
      Number(value) ===
      Number(
        team1.id
      )
    ) {
      return team1.id;
    }

    if (
      Number(value) ===
      Number(
        team2.id
      )
    ) {
      return team2.id;
    }

    const normalized =
      String(value)
        .trim()
        .toLowerCase();

    if (
      normalized ===
        team1.name
          .toLowerCase() ||
      normalized ===
        team1.shortName
          .toLowerCase()
    ) {
      return team1.id;
    }

    if (
      normalized ===
        team2.name
          .toLowerCase() ||
      normalized ===
        team2.shortName
          .toLowerCase()
    ) {
      return team2.id;
    }

    return null;
  }

  function findRosterPlayerFromJson(
    jsonPlayer:
      JsonPlayer
  ) {
    const allPlayers =
      [
        ...(team1?.roster ??
          []),

        ...(team2?.roster ??
          []),
      ];

    if (
      jsonPlayer.playerId
    ) {
      const byId =
        allPlayers.find(
          (player) =>
            Number(
              player.id
            ) ===
            Number(
              jsonPlayer.playerId
            )
        );

      if (byId) {
        return byId;
      }
    }

    if (
      jsonPlayer.riotId
    ) {
      return (
        allPlayers.find(
          (player) =>
            normalizeRiotId(
              player.riotId
            ) ===
            normalizeRiotId(
              jsonPlayer.riotId!
            )
        ) ?? null
      );
    }

    return null;
  }

  function importJson(
    gameIndex: number
  ) {
    try {
      const game =
        games[
          gameIndex
        ];

      if (!game) {
        return;
      }

      if (
        !game.jsonImport.trim()
      ) {
        throw new Error(
          'Colle le JSON CZF avant de cliquer sur Importer.'
        );
      }

      let raw =
        game.jsonImport.trim();

      raw = raw
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
          raw
        ) as JsonGame;

      if (
        !Array.isArray(
          parsed.players
        )
      ) {
        throw new Error(
          'Le JSON ne contient pas de tableau players.'
        );
      }

      if (
        parsed.players.length !==
        10
      ) {
        throw new Error(
          `Le JSON contient ${parsed.players.length} joueurs au lieu de 10.`
        );
      }

      const winnerId =
        resolveWinner(
          parsed.winner
        );

      if (!winnerId) {
        throw new Error(
          'Impossible de reconnaître le vainqueur.'
        );
      }

      const newPlayers:
        GamePlayer[] = [];

      const usedPlayerIds =
        new Set<number>();

      for (
        const jsonPlayer
        of parsed.players
      ) {
        if (
          !ROLES.includes(
            jsonPlayer.role
          )
        ) {
          throw new Error(
            `Rôle invalide : ${jsonPlayer.role}`
          );
        }

        const rosterPlayer =
          findRosterPlayerFromJson(
            jsonPlayer
          );

        if (
          !rosterPlayer
        ) {
          throw new Error(
            `Joueur introuvable : ${
              jsonPlayer.riotId ??
              jsonPlayer.playerId ??
              'inconnu'
            }.`
          );
        }

        if (
          usedPlayerIds.has(
            Number(
              rosterPlayer.id
            )
          )
        ) {
          throw new Error(
            `${rosterPlayer.riotId} apparaît deux fois dans le JSON.`
          );
        }

        usedPlayerIds.add(
          Number(
            rosterPlayer.id
          )
        );

        const team =
          getTeamForPlayer(
            Number(
              rosterPlayer.id
            )
          );

        if (!team) {
          throw new Error(
            `${rosterPlayer.riotId} n'appartient à aucune des deux équipes.`
          );
        }

        const champion =
          champions.find(
            (champion) =>
              champion.id
                .toLowerCase() ===
              String(
                jsonPlayer.championId
              ).toLowerCase()
          );

        if (!champion) {
          throw new Error(
            `Champion non reconnu : ${jsonPlayer.championId}`
          );
        }

        newPlayers.push({
          playerId:
            Number(
              rosterPlayer.id
            ),

          teamId:
            Number(
              team.id
            ),

          role:
            jsonPlayer.role,

          championId:
            champion.id,

          kills:
            Number(
              jsonPlayer.kills
            ) || 0,

          deaths:
            Number(
              jsonPlayer.deaths
            ) || 0,

          assists:
            Number(
              jsonPlayer.assists
            ) || 0,

          cs:
            Number(
              jsonPlayer.cs
            ) || 0,

          gold:
            Number(
              jsonPlayer.gold
            ) || 0,

          damage:
            Number(
              jsonPlayer.damage
            ) || 0,
        });
      }

      const team1Players =
        newPlayers.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(
              team1?.id
            )
        );

      const team2Players =
        newPlayers.filter(
          (player) =>
            Number(
              player.teamId
            ) ===
            Number(
              team2?.id
            )
        );

      if (
        team1Players.length !==
          5 ||
        team2Players.length !==
          5
      ) {
        throw new Error(
          'Le JSON doit contenir exactement 5 joueurs de chaque équipe.'
        );
      }

      for (
        const teamPlayers
        of [
          team1Players,
          team2Players,
        ]
      ) {
        for (
          const role
          of ROLES
        ) {
          if (
            !teamPlayers.some(
              (player) =>
                player.role ===
                role
            )
          ) {
            throw new Error(
              `Le rôle ${role} est manquant dans une équipe.`
            );
          }
        }
      }

      setGames(
        (current) =>
          current.map(
            (
              currentGame,
              index
            ) =>
              index ===
              gameIndex
                ? {
                    ...currentGame,

                    durationMinutes:
                      Number(
                        parsed.durationMinutes
                      ) || 0,

                    durationSeconds:
                      Number(
                        parsed.durationSeconds
                      ) || 0,

                    winnerTeamId:
                      Number(
                        winnerId
                      ),

                    mvpPlayerId:
                      null,

                    players:
                      newPlayers,

                    jsonImport:
                      '',

                    importMessage:
                      'Import réussi. Vérifie les stats puis choisis le MVP.',
                  }
                : currentGame
          )
      );

      setMessage(
        `Game ${
          game.gameNumber
        } importée avec succès.`
      );
    } catch (
      error: any
    ) {
      updateGame(
        gameIndex,
        {
          importMessage:
            error?.message ||
            'Erreur pendant l’import JSON.',
        }
      );
    }
  }

  function validateGame(
    game: GameForm
  ) {
    if (
      game.players.length !==
      10
    ) {
      return false;
    }

    const uniqueIds =
      new Set(
        game.players.map(
          (player) =>
            Number(
              player.playerId
            )
        )
      );

    if (
      uniqueIds.size !==
      10
    ) {
      return false;
    }

    if (
      !game.winnerTeamId
    ) {
      return false;
    }

    for (
      const player
      of game.players
    ) {
      if (
        !player.championId
      ) {
        return false;
      }
    }

    const t1 =
      game.players.filter(
        (player) =>
          Number(
            player.teamId
          ) ===
          Number(
            team1Id
          )
      );

    const t2 =
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
      t1.length !== 5 ||
      t2.length !== 5
    ) {
      return false;
    }

    for (
      const players
      of [
        t1,
        t2,
      ]
    ) {
      for (
        const role
        of ROLES
      ) {
        if (
          !players.some(
            (player) =>
              player.role ===
              role
          )
        ) {
          return false;
        }
      }
    }

    return true;
  }

  async function saveMatch() {
    try {
      setSaving(true);
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
          (game) =>
            game.winnerTeamId !==
            null
        );

      if (
        playedGames.length ===
        0
      ) {
        throw new Error(
          'Aucune game terminée.'
        );
      }

      for (
        const game
        of playedGames
      ) {
        if (
          !validateGame(
            game
          )
        ) {
          throw new Error(
            `La Game ${game.gameNumber} n'est pas valide.`
          );
        }
      }

      const winsTeam1 =
        playedGames.filter(
          (game) =>
            Number(
              game.winnerTeamId
            ) ===
            Number(
              team1Id
            )
        ).length;

      const winsTeam2 =
        playedGames.filter(
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
          'Impossible de déterminer le vainqueur du match.'
        );
      }

      const winnerTeamId =
        winsTeam1 >
        winsTeam2
          ? team1Id
          : team2Id;

      const {
        data:
          sessionData,
      } =
        await supabase.auth.getSession();

      const token =
        sessionData.session
          ?.access_token;

      if (!token) {
        throw new Error(
          'Tu dois être connecté.'
        );
      }

      const body = {
        division,

        team1Id,
        team2Id,

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

        bestOf,

        games:
          playedGames.map(
            (game) => ({
              gameNumber:
                game.gameNumber,

              durationSeconds:
                game.durationMinutes *
                  60 +
                game.durationSeconds,

              winnerTeamId:
                game.winnerTeamId,

              mvpPlayerId:
                game.mvpPlayerId,

              players:
                game.players,
            })
          ),
      };

      const res =
        await fetch(
          SAVE_ENDPOINT,
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
          'Erreur pendant l’enregistrement.'
        );
      }

      setMessage(
        `Match enregistré ! ID ${data.matchId}`
      );

      setGames([]);
      setTeam1Id(null);
      setTeam2Id(null);
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
        'Erreur inconnue'
      );
    } finally {
      setSaving(false);
    }
  }

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

        <section className="card adminSetup">
          <div className="adminTitleRow">
            <div>
              <p className="eyebrow">
                CZF MATCH CENTER
              </p>

              <h3>
                Nouveau match
              </h3>
            </div>

            <span className="adminBadge">
              ADMIN
            </span>
          </div>

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

                  setGames([]);
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
                  setTeam1Id(
                    Number(
                      e.target
                        .value
                    )
                  );

                  setGames([]);
                }}
              >
                <option value="">
                  Choisir
                </option>

                {divisionTeams.map(
                  (team) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                      disabled={
                        Number(
                          team.id
                        ) ===
                        Number(
                          team2Id
                        )
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
                  setTeam2Id(
                    Number(
                      e.target
                        .value
                    )
                  );

                  setGames([]);
                }}
              >
                <option value="">
                  Choisir
                </option>

                {divisionTeams.map(
                  (team) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                      disabled={
                        Number(
                          team.id
                        ) ===
                        Number(
                          team1Id
                        )
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

                  setGames([]);
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
            </label>
          </div>

          <button
            className="prepareButton"
            onClick={
              regenerateGames
            }
          >
            Préparer le match
          </button>

          {message && (
            <p className="adminMessage">
              {message}
            </p>
          )}
        </section>

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
              <div className="gameTitle">
                <div>
                  <p className="eyebrow">
                    MATCH DATA
                  </p>

                  <h3>
                    Game{' '}
                    {
                      game.gameNumber
                    }
                  </h3>
                </div>

                <span
                  className={`gameStatus ${
                    validateGame(
                      game
                    )
                      ? 'valid'
                      : ''
                  }`}
                >
                  {validateGame(
                    game
                  )
                    ? 'PRÊTE'
                    : 'À VÉRIFIER'}
                </span>
              </div>

              <div className="jsonImportBox">
                <div className="jsonHeader">
                  <div>
                    <strong>
                      Import JSON CZF
                    </strong>

                    <span>
                      Envoie les captures à ChatGPT, copie le JSON reçu puis colle-le ici.
                    </span>
                  </div>

                  <span className="freeBadge">
                    SANS API
                  </span>
                </div>

                <textarea
                  value={
                    game.jsonImport
                  }
                  onChange={(
                    e
                  ) =>
                    updateGame(
                      gameIndex,
                      {
                        jsonImport:
                          e.target
                            .value,
                      }
                    )
                  }
                  placeholder={`Colle ici le JSON CZF de la Game ${game.gameNumber}...`}
                />

                <button
                  className="importButton"
                  onClick={() =>
                    importJson(
                      gameIndex
                    )
                  }
                >
                  Importer les stats
                </button>

                {game.importMessage && (
                  <div className="importMessage">
                    {
                      game.importMessage
                    }
                  </div>
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
                            ),
                        }
                      )
                    }
                  />
                </label>

                <label>
                  Secondes

                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={
                      game.durationSeconds
                    }
                    onChange={(
                      e
                    ) =>
                      updateGame(
                        gameIndex,
                        {
                          durationSeconds:
                            Number(
                              e.target
                                .value
                            ),
                        }
                      )
                    }
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
                    ) =>
                      updateGame(
                        gameIndex,
                        {
                          winnerTeamId:
                            Number(
                              e.target
                                .value
                            ),
                        }
                      )
                    }
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

                <label>
                  MVP

                  <select
                    value={
                      game.mvpPlayerId ??
                      ''
                    }
                    onChange={(
                      e
                    ) =>
                      updateGame(
                        gameIndex,
                        {
                          mvpPlayerId:
                            e.target
                              .value
                              ? Number(
                                  e.target
                                    .value
                                )
                              : null,
                        }
                      )
                    }
                  >
                    <option value="">
                      Aucun
                    </option>

                    {game.players.map(
                      (
                        player
                      ) => {
                        const rosterPlayer =
                          getPlayer(
                            player.playerId
                          );

                        return (
                          <option
                            key={
                              player.playerId
                            }
                            value={
                              player.playerId
                            }
                          >
                            {
                              rosterPlayer?.riotId
                            }
                          </option>
                        );
                      }
                    )}
                  </select>
                </label>
              </div>

              <GameTeamTable
                title={
                  team1?.name ??
                  'Équipe 1'
                }
                team={
                  team1
                }
                game={
                  game
                }
                gameIndex={
                  gameIndex
                }
                champions={
                  champions
                }
                getPlayer={
                  getPlayer
                }
                playersForRole={
                  playersForRole
                }
                changeParticipant={
                  changeParticipant
                }
                updatePlayer={
                  updatePlayer
                }
              />

              <GameTeamTable
                title={
                  team2?.name ??
                  'Équipe 2'
                }
                team={
                  team2
                }
                game={
                  game
                }
                gameIndex={
                  gameIndex
                }
                champions={
                  champions
                }
                getPlayer={
                  getPlayer
                }
                playersForRole={
                  playersForRole
                }
                changeParticipant={
                  changeParticipant
                }
                updatePlayer={
                  updatePlayer
                }
              />
            </section>
          )
        )}

        {games.length >
          0 && (
          <button
            className="saveMatchButton"
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

        <style jsx>{`
          .adminResultsPage {
            position: relative;
          }

          .adminSetup,
          .gameCard {
            margin-bottom: 22px;
          }

          .adminTitleRow,
          .gameTitle {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 20px;

            margin-bottom: 20px;
          }

          .adminTitleRow h3,
          .gameTitle h3 {
            margin: 0;

            color: var(--navy);

            font-family: var(--font-display);

            font-size: 30px;

            text-transform: uppercase;
          }

          .eyebrow {
            margin: 0 0 3px;

            color: var(--orange);

            font-size: 9px;
            font-weight: 900;

            letter-spacing: 0.12em;
          }

          .adminBadge,
          .freeBadge,
          .gameStatus {
            padding: 7px 10px;

            border-radius: 6px;

            background:
              rgba(
                9,
                42,
                63,
                0.08
              );

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;
          }

          .gameStatus.valid {
            background:
              rgba(
                70,
                150,
                95,
                0.13
              );

            color: #357c4d;
          }

          .freeBadge {
            flex-shrink: 0;

            background:
              rgba(
                70,
                150,
                95,
                0.13
              );

            color: #357c4d;
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
            flex-direction: column;

            gap: 6px;

            color: var(--navy);

            font-size: 10px;
            font-weight: 900;

            text-transform: uppercase;
          }

          label input,
          label select {
            width: 100%;
          }

          .prepareButton,
          .importButton,
          .saveMatchButton {
            border: 0;

            border-radius: 8px;

            font-weight: 900;

            cursor: pointer;
          }

          .prepareButton {
            min-height: 48px;

            padding: 0 20px;

            background: var(--navy);

            color: white;
          }

          .adminMessage {
            margin-top: 15px;

            color: var(--orange);

            font-size: 12px;
            font-weight: 900;
          }

          .jsonImportBox {
            margin-bottom: 22px;

            padding: 17px;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.18
              );

            border-radius: 10px;

            background:
              rgba(
                9,
                42,
                63,
                0.035
              );
          }

          .jsonHeader {
            display: flex;

            align-items: center;
            justify-content: space-between;

            gap: 20px;

            margin-bottom: 12px;
          }

          .jsonHeader > div {
            display: flex;
            flex-direction: column;

            gap: 3px;
          }

          .jsonHeader strong {
            color: var(--navy);

            font-size: 13px;
          }

          .jsonHeader span:not(.freeBadge) {
            color: var(--muted);

            font-size: 10px;
            font-weight: 600;
          }

          .jsonImportBox textarea {
            width: 100%;

            min-height: 125px;

            resize: vertical;

            padding: 12px;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.22
              );

            border-radius: 7px;

            background:
              rgba(
                255,
                255,
                255,
                0.55
              );

            color: var(--navy);

            font-family:
              monospace;

            font-size: 11px;
          }

          .importButton {
            min-height: 42px;

            margin-top: 10px;

            padding: 0 17px;

            background:
              var(--orange);

            color: white;
          }

          .importMessage {
            margin-top: 10px;

            color: var(--navy);

            font-size: 10px;
            font-weight: 800;
          }

          .gameOptions {
            display: grid;

            grid-template-columns:
              repeat(
                4,
                minmax(
                  0,
                  1fr
                )
              );

            gap: 10px;

            margin-bottom: 25px;
          }

          .saveMatchButton {
            width: 100%;

            min-height: 62px;

            margin-top: 8px;

            background:
              var(--navy);

            color: white;

            font-size: 14px;
          }

          .saveMatchButton:disabled {
            opacity: 0.55;

            cursor: not-allowed;
          }

          @media (
            max-width: 900px
          ) {
            .setupGrid,
            .gameOptions {
              grid-template-columns:
                1fr;
            }

            .adminTitleRow,
            .gameTitle,
            .jsonHeader {
              align-items:
                flex-start;

              flex-direction:
                column;
            }
          }
        `}</style>
      </main>
    </>
  );
}

function GameTeamTable({
  title,
  team,
  game,
  gameIndex,
  champions,
  getPlayer,
  playersForRole,
  changeParticipant,
  updatePlayer,
}: {
  title: string;

  team:
    | Team
    | undefined;

  game: GameForm;

  gameIndex: number;

  champions:
    Champion[];

  getPlayer:
    (
      playerId: number
    ) =>
      | Player
      | undefined;

  playersForRole:
    (
      team: Team,
      role: Role
    ) => Player[];

  changeParticipant:
    (
      gameIndex: number,
      playerIndex: number,
      playerId: number
    ) => void;

  updatePlayer:
    (
      gameIndex: number,
      playerIndex: number,
      patch:
        Partial<GamePlayer>
    ) => void;
}) {
  if (!team) {
    return null;
  }

  const teamPlayers =
    game.players
      .map(
        (
          player,
          playerIndex
        ) => ({
          player,
          playerIndex,
        })
      )
      .filter(
        ({
          player,
        }) =>
          Number(
            player.teamId
          ) ===
          Number(
            team.id
          )
      );

  return (
    <div className="teamGameBlock">
      <div className="teamBlockTitle">
        <div>
          {team.logo && (
            <img
              src={
                team.logo
              }
              alt={
                team.name
              }
            />
          )}

          <strong>
            {title}
          </strong>
        </div>

        <span>
          5 participants
        </span>
      </div>

      <div className="gameTable">
        <div className="gameTableHeader">
          <span>Rôle</span>
          <span>Participant</span>
          <span>Champion</span>
          <span>K</span>
          <span>D</span>
          <span>A</span>
          <span>CS</span>
          <span>Gold</span>
          <span>DMG</span>
        </div>

        {teamPlayers.map(
          ({
            player,
            playerIndex,
          }) => {
            const rosterPlayer =
              getPlayer(
                player.playerId
              );

            const isSub =
              rosterPlayer &&
              rosterPlayer.role !==
                player.role;

            const available =
              playersForRole(
                team,
                player.role
              );

            return (
              <div
                key={`${game.gameNumber}-${team.id}-${player.role}`}
                className={`gamePlayerRow ${
                  isSub
                    ? 'subRow'
                    : ''
                }`}
              >
                <div className="roleCell">
                  <strong>
                    {
                      player.role
                    }
                  </strong>

                  {isSub && (
                    <span>
                      SUB
                    </span>
                  )}
                </div>

                <select
                  className={
                    isSub
                      ? 'subSelect'
                      : ''
                  }
                  value={
                    player.playerId
                  }
                  onChange={(
                    e
                  ) =>
                    changeParticipant(
                      gameIndex,
                      playerIndex,
                      Number(
                        e.target
                          .value
                      )
                    )
                  }
                >
                  {available.map(
                    (
                      optionPlayer
                    ) => (
                      <option
                        key={
                          optionPlayer.id
                        }
                        value={
                          optionPlayer.id
                        }
                      >
                        {
                          optionPlayer.riotId
                        }
                        {optionPlayer.role ===
                        player.role
                          ? ''
                          : ` — SUB (${optionPlayer.role ?? '?'})`}
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
                              ),
                          }
                        )
                      }
                    />
                  )
                )}
              </div>
            );
          }
        )}

        <style jsx>{`
          .teamGameBlock {
            margin-top: 18px;

            overflow-x: auto;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.15
              );

            border-radius: 10px;

            background:
              rgba(
                255,
                255,
                255,
                0.22
              );
          }

          .teamBlockTitle {
            display: flex;

            align-items: center;
            justify-content: space-between;

            gap: 15px;

            padding:
              12px
              14px;

            border-bottom:
              1px solid
              rgba(
                9,
                42,
                63,
                0.1
              );
          }

          .teamBlockTitle > div {
            display: flex;
            align-items: center;

            gap: 9px;
          }

          .teamBlockTitle img {
            width: 31px;
            height: 31px;

            object-fit: contain;
          }

          .teamBlockTitle strong {
            color: var(--navy);

            font-size: 13px;
          }

          .teamBlockTitle > span {
            color: var(--muted);

            font-size: 9px;
            font-weight: 800;
          }

          .gameTable {
            overflow-x: auto;

            padding: 8px;
          }

          .gameTableHeader,
          .gamePlayerRow {
            display: grid;

            grid-template-columns:
              85px
              minmax(
                190px,
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
              100px;

            gap: 8px;

            align-items: center;

            min-width: 1080px;
          }

          .gameTableHeader {
            padding:
              4px
              8px
              9px;

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .gamePlayerRow {
            padding: 8px;

            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.07
              );
          }

          .subRow {
            border:
              1px solid
              rgba(
                80,
                80,
                80,
                0.16
              );

            border-radius: 7px;

            background:
              rgba(
                80,
                80,
                80,
                0.08
              );
          }

          .gamePlayerRow input,
          .gamePlayerRow select {
            width: 100%;

            min-height: 40px;

            padding: 7px;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.2
              );

            border-radius: 6px;
          }

          .subSelect {
            background:
              rgba(
                80,
                80,
                80,
                0.08
              );
          }

          .roleCell {
            display: flex;
            flex-direction: column;

            gap: 2px;
          }

          .roleCell strong {
            color: var(--orange);

            font-size: 10px;
          }

          .roleCell span {
            width: fit-content;

            padding:
              2px
              5px;

            border-radius: 4px;

            background:
              #737373;

            color: white;

            font-size: 7px;
            font-weight: 900;
          }
        `}</style>
      </div>
    </div>
  );
}