'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../../components/Nav';
import { supabase } from '@/lib/supabase';

type Division = 'Yordle' | 'Ixtal' | 'Targon';
type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';

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
};

const ROLES: Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

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
    useState<'pool' | 'playoff'>('pool');

  const [bracket, setBracket] =
    useState<
      'winner' |
      'loser' |
      'grand_final'
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
      const res =
        await fetch('/api/results', {
          cache: 'no-store',
        });

      const data =
        await res.json();

      const allTeams: Team[] =
        data.teams || [];

      setTeams(allTeams);
      setChampions(
        data.champions || []
      );
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
      [teams, division]
    );

  const team1 =
    divisionTeams.find(
      (team) =>
        team.id === team1Id
    );

  const team2 =
    divisionTeams.find(
      (team) =>
        team.id === team2Id
    );

  function createGame(
    number: number
  ): GameForm | null {
    if (!team1 || !team2) {
      return null;
    }

    const players: GamePlayer[] =
      [
        ...team1.roster,
        ...team2.roster,
      ]
        .filter(
          (player) =>
            ROLES.includes(
              player.role as Role
            )
        )
        .map(
          (player) => ({
            playerId:
              player.id,

            teamId:
              team1.roster.some(
                (p) =>
                  p.id ===
                  player.id
              )
                ? team1.id
                : team2.id,

            role:
              player.role as Role,

            championId: '',

            kills: 0,
            deaths: 0,
            assists: 0,

            cs: 0,
            gold: 0,
            damage: 0,
          })
        );

    return {
      gameNumber:
        number,

      durationMinutes: 0,
      durationSeconds: 0,

      winnerTeamId: null,

      mvpPlayerId: null,

      players,
    };
  }

  function regenerateGames() {
    if (!team1 || !team2) {
      setMessage(
        'Choisis les deux équipes.'
      );

      return;
    }

    if (
      team1.roster.length < 5 ||
      team2.roster.length < 5
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

    const nextGames: GameForm[] =
      [];

    for (
      let i = 1;
      i <= gameCount;
      i++
    ) {
      const game =
        createGame(i);

      if (game) {
        nextGames.push(
          game
        );
      }
    }

    setGames(nextGames);

    setMessage(
      'Games préparées.'
    );
  }

  function updatePlayer(
    gameIndex: number,
    playerIndex: number,
    patch: Partial<GamePlayer>
  ) {
    setGames(
      (current) =>
        current.map(
          (game, gi) => {
            if (
              gi !== gameIndex
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
    patch: Partial<GameForm>
  ) {
    setGames(
      (current) =>
        current.map(
          (game, index) =>
            index === gameIndex
              ? {
                  ...game,
                  ...patch,
                }
              : game
        )
    );
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
        playedGames.length === 0
      ) {
        throw new Error(
          'Aucune game terminée.'
        );
      }

      for (
        const game
        of playedGames
      ) {
        for (
          const player
          of game.players
        ) {
          if (
            !player.championId
          ) {
            throw new Error(
              `Champion manquant dans la game ${game.gameNumber}.`
            );
          }
        }
      }

      const winsTeam1 =
        playedGames.filter(
          (game) =>
            game.winnerTeamId ===
            team1Id
        ).length;

      const winsTeam2 =
        playedGames.filter(
          (game) =>
            game.winnerTeamId ===
            team2Id
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
        data: sessionData,
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
          '/api/admin/results/matches',
          {
            method: 'POST',

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
          'Erreur'
        );
      }

      setMessage(
        `Match enregistré ! ID ${data.matchId}`
      );

      setGames([]);
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
                        team.id ===
                        team2Id
                      }
                    >
                      {team.name}
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
                        team.id ===
                        team1Id
                      }
                    >
                      {team.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Phase

              <select
                value={stage}
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
                value={bestOf}
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
            className="joinTeamBtn"
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
              <div className="gameHeader">
                <h3>
                  Game{' '}
                  {
                    game.gameNumber
                  }
                </h3>

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
                                e
                                  .target
                                  .value
                              ),
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
                      ) =>
                        updateGame(
                          gameIndex,
                          {
                            durationSeconds:
                              Number(
                                e
                                  .target
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
                                e
                                  .target
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
                              e
                                .target
                                .value
                                ? Number(
                                    e
                                      .target
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
                            [
                              ...(team1?.roster ??
                                []),
                              ...(team2?.roster ??
                                []),
                            ].find(
                              (
                                p
                              ) =>
                                p.id ===
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

                  <span>K</span>
                  <span>D</span>
                  <span>A</span>
                  <span>CS</span>
                  <span>Gold</span>
                  <span>DMG</span>
                </div>

                {game.players.map(
                  (
                    player,
                    playerIndex
                  ) => {
                    const rosterPlayer =
                      [
                        ...(team1?.roster ??
                          []),
                        ...(team2?.roster ??
                          []),
                      ].find(
                        (p) =>
                          p.id ===
                          player.playerId
                      );

                    return (
                      <div
                        key={`${game.gameNumber}-${player.playerId}`}
                        className="gamePlayerRow"
                      >
                        <strong>
                          {
                            player.role
                          }
                        </strong>

                        <span>
                          {
                            rosterPlayer?.riotId
                          }
                        </span>

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
                                  e
                                    .target
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
                                        e
                                          .target
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
              </div>
            </section>
          )
        )}

        {games.length > 0 && (
          <button
            className="saveMatchButton"
            disabled={saving}
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

          .adminSetup {
            margin-bottom: 20px;
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

            color:
              var(--navy);

            font-size: 11px;
            font-weight: 900;

            text-transform:
              uppercase;
          }

          label input,
          label select {
            width: 100%;
          }

          .adminMessage {
            margin-top: 15px;

            color:
              var(--orange);

            font-weight: 800;
          }

          .gameCard {
            margin-bottom: 20px;
          }

          .gameHeader {
            display: flex;
            align-items: flex-end;
            justify-content:
              space-between;

            gap: 20px;

            margin-bottom: 22px;
          }

          .gameOptions {
            display: flex;
            align-items: flex-end;

            gap: 10px;

            flex-wrap: wrap;
          }

          .gameOptions label {
            width: 130px;
          }

          .gameTable {
            overflow-x: auto;
          }

          .gameTableHeader,
          .gamePlayerRow {
            display: grid;

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
              100px;

            gap: 8px;

            align-items: center;

            min-width: 1000px;
          }

          .gameTableHeader {
            padding:
              0
              8px
              10px;

            color:
              var(--navy);

            font-size: 10px;
            font-weight: 900;

            text-transform:
              uppercase;
          }

          .gamePlayerRow {
            padding: 8px;

            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.08
              );
          }

          .gamePlayerRow input,
          .gamePlayerRow select {
            width: 100%;
            min-height: 42px;

            padding: 8px;
          }

          .gamePlayerRow strong {
            color:
              var(--orange);

            font-size: 11px;
          }

          .gamePlayerRow span {
            color:
              var(--navy);

            font-size: 12px;
            font-weight: 800;
          }

          .saveMatchButton {
            width: 100%;

            min-height: 58px;

            margin-top: 8px;

            border: 0;

            border-radius: 8px;

            background:
              var(--navy);

            color: white;

            font-size: 14px;
            font-weight: 900;
          }

          @media (
            max-width: 900px
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
          }
        `}</style>
      </main>
    </>
  );
}