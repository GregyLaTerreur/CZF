'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Nav from '../components/Nav';

/* =========================================================
   TYPES
========================================================= */

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

type Team = {
  id:
    | number
    | string;

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
};

type HistoryTeam = {
  id: number;

  name: string;

  shortName: string;

  logo:
    | string
    | null;

  score: number;
};

type HistoryGame = {
  id: number;

  gameNumber: number;

  durationSeconds: number;

  winnerTeamId: number;

  winnerName:
    | string
    | null;
};

type HistoryMatch = {
  id: number;

  division: Division;

  stage:
    | 'pool'
    | 'playoff';

  bracket:
    | 'winner'
    | 'loser'
    | 'grand_final'
    | null;

  round:
    | string
    | null;

  bestOf: number;

  playedAt: string;

  mvpPlayerId:
    | number
    | null;

  mvpRiotId:
    | string
    | null;

  team1:
    | HistoryTeam
    | null;

  team2:
    | HistoryTeam
    | null;

  winner:
    | {
        id: number;

        name: string;

        shortName: string;

        logo:
          | string
          | null;
      }
    | null;

  games:
    HistoryGame[];
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

  visionScore: number;

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

type RoleStats =
  Record<
    Role,
    PlayerStats[]
  >;

type RoleChampions =
  Record<
    Role,
    ChampionRoleStat[]
  >;

type ResultsApiData = {
  success: boolean;

  teams: Team[];

  divisions: {
    Yordle:
      Team[];

    Ixtal:
      Team[];

    Targon:
      Team[];
  };

  historyByDivision: {
    Yordle:
      HistoryMatch[];

    Ixtal:
      HistoryMatch[];

    Targon:
      HistoryMatch[];
  };

  playerStatsByDivision: {
    Yordle:
      RoleStats;

    Ixtal:
      RoleStats;

    Targon:
      RoleStats;
  };

  championsByDivision: {
    Yordle:
      RoleChampions;

    Ixtal:
      RoleChampions;

    Targon:
      RoleChampions;
  };
};

/* =========================================================
   CONFIG
========================================================= */

const DIVISIONS = [
  {
    name:
      'Yordle' as Division,

    color:
      '#51a677',

    soft:
      'rgba(81, 166, 119, 0.11)',
  },

  {
    name:
      'Ixtal' as Division,

    color:
      '#4387d8',

    soft:
      'rgba(67, 135, 216, 0.11)',
  },

  {
    name:
      'Targon' as Division,

    color:
      '#8f6bc7',

    soft:
      'rgba(143, 107, 199, 0.11)',
  },
];

const ROLES:
  Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

const ROLE_LABELS:
  Record<
    Role,
    string
  > = {
  Top:
    'TOP',

  Jungle:
    'JGL',

  Mid:
    'MID',

  ADC:
    'ADC',

  Support:
    'SUP',
};

const ROLE_ICONS:
  Record<
    Role,
    string
  > = {
  Top:
    '/assets/roles/top.png',

  Jungle:
    '/assets/roles/jungle.png',

  Mid:
    '/assets/roles/mid.png',

  ADC:
    '/assets/roles/adc.png',

  Support:
    '/assets/roles/sup.png',
};

/* =========================================================
   PAGE
========================================================= */

export default function ResultsPage() {
  const [
    division,
    setDivision,
  ] =
    useState<Division>(
      'Yordle'
    );

  const [
    selectedRole,
    setSelectedRole,
  ] =
    useState<Role>(
      'Top'
    );

  const [
    data,
    setData,
  ] =
    useState<
      ResultsApiData |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState('');

  /* ======================================================
     LOAD
  ====================================================== */

  useEffect(() => {
    async function load() {
      try {
        setLoading(
          true
        );

        setError('');

        const res =
          await fetch(
            '/api/results',
            {
              cache:
                'no-store',
            }
          );

        const json =
          await res.json();

        if (
          !res.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Impossible de charger les résultats.'
          );
        }

        setData(
          json
        );
      } catch (
        error: any
      ) {
        setError(
          error?.message ||
            'Erreur de chargement.'
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    load();
  }, []);

  /* ======================================================
     DIVISION DATA
  ====================================================== */

  const divisionConfig =
    DIVISIONS.find(
      (
        item
      ) =>
        item.name ===
        division
    ) ??
    DIVISIONS[0];

  const teams =
    data
      ?.divisions?.[
      division
    ] ??
    [];

  const history =
    data
      ?.historyByDivision?.[
      division
    ] ??
    [];

  const roleStats =
    data
      ?.playerStatsByDivision?.[
      division
    ]?.[
      selectedRole
    ] ??
    [];

  const roleChampions =
    data
      ?.championsByDivision?.[
      division
    ]?.[
      selectedRole
    ] ??
    [];

  /* ======================================================
     MVP TOUS ROLES
  ====================================================== */

  const mvpRanking =
    useMemo(
      () => {
        if (
          !data
        ) {
          return [];
        }

        const divisionStats =
          data
            .playerStatsByDivision?.[
            division
          ];

        if (
          !divisionStats
        ) {
          return [];
        }

        const allPlayers =
          ROLES.flatMap(
            (
              role
            ) =>
              divisionStats[
                role
              ] ??
              []
          );

        const map =
          new Map<
            number,
            PlayerStats
          >();

        for (
          const player
          of allPlayers
        ) {
          const existing =
            map.get(
              player.playerId
            );

          if (
            !existing
          ) {
            map.set(
              player.playerId,
              {
                ...player,
              }
            );

            continue;
          }

          existing.mvp +=
            player.mvp;
        }

        return Array.from(
          map.values()
        )
          .filter(
            (
              player
            ) =>
              player.mvp >
              0
          )
          .sort(
            (
              a,
              b
            ) =>
              b.mvp -
              a.mvp
          );
      },
      [
        data,
        division,
      ]
    );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <>
      <Nav />

      <main
        className="resultsPage section"
        style={
          {
            '--division-color':
              divisionConfig.color,

            '--division-soft':
              divisionConfig.soft,
          } as React.CSSProperties
        }
      >
        <div className="sectionTitle">
          <span />

          <h2>
            Résultats
          </h2>
        </div>

        {error && (
          <div className="resultsError">
            {error}
          </div>
        )}

        {/* =================================================
            DIVISIONS
        ================================================= */}

        <div className="divisionTabs">
          {DIVISIONS.map(
            (
              item
            ) => (
              <button
                key={
                  item.name
                }
                type="button"
                className={`divisionTab ${
                  division ===
                  item.name
                    ? 'divisionTabActive'
                    : ''
                }`}
                onClick={() => {
                  setDivision(
                    item.name
                  );

                  setSelectedRole(
                    'Top'
                  );
                }}
                style={
                  {
                    '--tab-color':
                      item.color,

                    '--tab-soft':
                      item.soft,
                  } as React.CSSProperties
                }
              >
                {
                  item.name
                }
              </button>
            )
          )}
        </div>

        {/* =================================================
            CLASSEMENT + BRACKET
        ================================================= */}

        <div className="resultsMainGrid">
          <section className="resultsCard standingsCard">
            <CardHeader
              eyebrow="PHASE DE POULE"
              title="Classement"
              badge={
                division
              }
            />

            <div className="standingHeader">
              <span>
                #
              </span>

              <span>
                Équipe
              </span>

              <span>
                V/D
              </span>
            </div>

            {loading ? (
              <div className="emptySection">
                Chargement...
              </div>
            ) : (
              <div className="standingRows">
                {teams
                  .slice(
                    0,
                    10
                  )
                  .map(
                    (
                      team,
                      index
                    ) => (
                      <div
                        key={
                          team.id
                        }
                        className={`standingRow ${
                          index <
                          8
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                      >
                        <strong className="standingRank">
                          {
                            index +
                            1
                          }
                        </strong>

                        <div className="standingTeam">
                          <TeamLogo
                            team={
                              team
                            }
                          />

                          <div>
                            <strong>
                              {
                                team.shortName
                              }
                            </strong>

                            <span>
                              {
                                team.name
                              }
                            </span>
                          </div>
                        </div>

                        <strong className="standingScore">
                          {
                            team.wins
                          }
                          {' - '}
                          {
                            team.losses
                          }
                        </strong>
                      </div>
                    )
                  )}

                {Array.from({
                  length:
                    Math.max(
                      0,
                      10 -
                        teams.length
                    ),
                }).map(
                  (
                    _,
                    index
                  ) => {
                    const rank =
                      teams.length +
                      index +
                      1;

                    return (
                      <div
                        key={`empty-${rank}`}
                        className={`standingRow standingEmpty ${
                          rank <=
                          8
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                      >
                        <strong className="standingRank">
                          {
                            rank
                          }
                        </strong>

                        <div className="standingTeam">
                          <div className="resultTeamLogo">
                            ?
                          </div>

                          <div>
                            <strong>
                              TBD
                            </strong>
                          </div>
                        </div>

                        <strong className="standingScore">
                          0 - 0
                        </strong>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section className="resultsCard bracketCard">
            <CardHeader
              eyebrow="PHASE FINALE"
              title="Double élimination"
              badge="TOP 8"
            />

            <div className="bracketScroller">
              <div className="fullBracket">
                <div className="laneTitle">
                  <span />

                  WINNER BRACKET
                </div>

                <div className="bracketColumns">
                  <div className="bracketRound">
                    <h4>
                      QUARTS
                    </h4>

                    <div className="quarterMatches">
                      <BracketMatch
                        team1={
                          getSeedName(
                            teams,
                            1
                          )
                        }
                        team2={
                          getSeedName(
                            teams,
                            8
                          )
                        }
                      />

                      <BracketMatch
                        team1={
                          getSeedName(
                            teams,
                            4
                          )
                        }
                        team2={
                          getSeedName(
                            teams,
                            5
                          )
                        }
                      />

                      <BracketMatch
                        team1={
                          getSeedName(
                            teams,
                            2
                          )
                        }
                        team2={
                          getSeedName(
                            teams,
                            7
                          )
                        }
                      />

                      <BracketMatch
                        team1={
                          getSeedName(
                            teams,
                            3
                          )
                        }
                        team2={
                          getSeedName(
                            teams,
                            6
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      DEMI-FINALES
                    </h4>

                    <div className="doubleMatches">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />

                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      FINALE WINNER
                    </h4>

                    <div className="singleMatch">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                        highlighted
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      GRANDE FINALE
                    </h4>

                    <div className="singleMatch">
                      <BracketMatch
                        team1="Winner WB"
                        team2="Winner LB"
                        highlighted
                      />
                    </div>
                  </div>
                </div>

                <div className="bracketDrop">
                  Les perdants du Winner Bracket descendent dans le Loser Bracket
                </div>

                <div className="laneTitle loserLane">
                  <span />

                  LOSER BRACKET
                </div>

                <div className="bracketColumns">
                  <div className="bracketRound">
                    <h4>
                      ROUND 1
                    </h4>

                    <div className="doubleMatches">
                      <BracketMatch
                        team1="Loser QF"
                        team2="Loser QF"
                      />

                      <BracketMatch
                        team1="Loser QF"
                        team2="Loser QF"
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      ROUND 2
                    </h4>

                    <div className="doubleMatches">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser SF"
                      />

                      <BracketMatch
                        team1="TBD"
                        team2="Loser SF"
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      ROUND 3
                    </h4>

                    <div className="singleMatch">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>
                  </div>

                  <div className="bracketArrow">
                    →
                  </div>

                  <div className="bracketRound">
                    <h4>
                      FINALE LOSER
                    </h4>

                    <div className="singleMatch">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser WB"
                        highlighted
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =================================================
            HISTORIQUE
        ================================================= */}

        <section className="resultsCard historyCard">
          <CardHeader
            eyebrow="MATCHS TERMINÉS"
            title="Historique des matchs"
            badge={`${history.length} MATCH${
              history.length ===
              1
                ? ''
                : 'S'
            }`}
          />

          {history.length ===
          0 ? (
            <div className="emptySection">
              Aucun match enregistré pour le moment.
            </div>
          ) : (
            <div className="historyList">
              {history.map(
                (
                  match
                ) => (
                  <HistoryCard
                    key={
                      match.id
                    }
                    match={
                      match
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
            STATS
        ================================================= */}

        <section className="resultsCard statsCard">
          <CardHeader
            eyebrow="PERFORMANCES"
            title="Statistiques joueurs"
            badge={
              division
            }
          />

          <div className="roleTabs">
            {ROLES.map(
              (
                role
              ) => (
                <button
                  key={
                    role
                  }
                  type="button"
                  className={
                    selectedRole ===
                    role
                      ? 'roleActive'
                      : ''
                  }
                  onClick={() =>
                    setSelectedRole(
                      role
                    )
                  }
                >
                  <img
                    src={
                      ROLE_ICONS[
                        role
                      ]
                    }
                    alt=""
                  />

                  <span>
                    {
                      ROLE_LABELS[
                        role
                      ]
                    }
                  </span>
                </button>
              )
            )}
          </div>

          <div className="statRankingGrid">
            <RankingCard
              title="KDA"
              players={
                roleStats
              }
              valueKey="kda"
              formatter={(
                value
              ) =>
                value.toFixed(
                  2
                )
              }
            />

            <RankingCard
              title="GOLD"
              players={
                roleStats
              }
              valueKey="goldPerMin"
              formatter={(
                value
              ) =>
                `${Math.round(
                  value
                )} GPM`
              }
            />

            <RankingCard
              title="DPM"
              players={
                roleStats
              }
              valueKey="dpm"
              formatter={(
                value
              ) =>
                Math.round(
                  value
                ).toString()
              }
            />

            {selectedRole ===
            'Support' ? (
              <RankingCard
                title="VISION"
                players={
                  roleStats
                }
                valueKey="visionScore"
                formatter={(
                  value
                ) =>
                  Math.round(
                    value
                  ).toString()
                }
              />
            ) : (
              <RankingCard
                title="CS / MIN"
                players={
                  roleStats
                }
                valueKey="csPerMin"
                formatter={(
                  value
                ) =>
                  value.toFixed(
                    1
                  )
                }
              />
            )}
          </div>

          <div className="statsSubSection">
            <div className="subSectionTitle">
              <div>
                <span />

                <strong>
                  Champions les plus joués —{' '}
                  {
                    ROLE_LABELS[
                      selectedRole
                    ]
                  }
                </strong>
              </div>

              <small>
                TOP 5
              </small>
            </div>

            {roleChampions.length ===
            0 ? (
              <div className="miniEmpty">
                Aucun champion enregistré pour le moment.
              </div>
            ) : (
              <div className="championRow">
                {roleChampions
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (
                      champion,
                      index
                    ) => (
                      <div
                        key={
                          champion.championId
                        }
                        className="championCard"
                      >
                        <span className="championRank">
                          #
                          {
                            index +
                            1
                          }
                        </span>

                        {champion.image ? (
                          <img
                            src={
                              champion.image
                            }
                            alt={
                              champion.name
                            }
                          />
                        ) : (
                          <div className="championFallback">
                            ?
                          </div>
                        )}

                        <strong className="championName">
                          {
                            champion.name
                          }
                        </strong>

                        <span className="championPicks">
                          {
                            champion.picks
                          }{' '}
                          pick
                          {
                            champion.picks >
                            1
                              ? 's'
                              : ''
                          }
                        </span>

                        <div className="championStats">
                          <div>
                            <small>
                              PICK RATE
                            </small>

                            <strong>
                              {
                                champion.pickRate
                              }
                              %
                            </strong>
                          </div>

                          <div>
                            <small>
                              WIN RATE
                            </small>

                            <strong>
                              {
                                champion.winRate
                              }
                              %
                            </strong>
                          </div>
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </div>

          <div className="statsSubSection">
            <div className="subSectionTitle">
              <div>
                <span />

                <strong>
                  Classement MVP
                </strong>
              </div>

              <small>
                TOUS RÔLES
              </small>
            </div>

            {mvpRanking.length ===
            0 ? (
              <div className="miniEmpty">
                Aucun MVP attribué pour le moment.
              </div>
            ) : (
              <MvpRanking
                players={
                  mvpRanking
                }
              />
            )}
          </div>
        </section>

        <style jsx>{`
          .resultsPage {
            position: relative;
            min-height: 100vh;
          }

          .resultsError {
            margin-bottom: 18px;
            padding: 14px 16px;
            border: 1px solid rgba(150, 55, 55, 0.3);
            border-radius: 9px;
            background: rgba(150, 55, 55, 0.08);
            color: #933838;
            font-size: 12px;
            font-weight: 900;
          }

          .divisionTabs {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .divisionTab {
            position: relative;
            min-height: 68px;
            overflow: hidden;
            border: 1.4px solid rgba(9, 42, 63, 0.5);
            border-radius: 11px;
            background: rgba(255, 246, 229, 0.8);
            color: var(--navy);
            font-size: 17px;
            font-weight: 900;
            letter-spacing: 0.07em;
          }

          .divisionTab::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 5px;
            background: var(--tab-color);
          }

          .divisionTabActive {
            border-color: var(--tab-color);
            background: var(--tab-soft);
          }

          .resultsCard {
            overflow: hidden;
            border: 1.3px solid rgba(9, 42, 63, 0.7);
            border-radius: 14px;
            background: rgba(255, 246, 229, 0.84);
            box-shadow: 0 12px 30px rgba(8, 24, 36, 0.055);
          }

          .resultsMainGrid {
            display: grid;
            grid-template-columns: minmax(290px, 0.25fr) minmax(0, 0.75fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .standingHeader,
          .standingRow {
            display: grid;
            grid-template-columns: 30px minmax(0, 1fr) 62px;
            align-items: center;
            gap: 8px;
          }

          .standingHeader {
            padding: 13px 15px;
            color: var(--muted);
            font-size: 9px;
            font-weight: 900;
          }

          .standingRows {
            padding: 0 8px 8px;
          }

          .standingRow {
            position: relative;
            min-height: 65px;
            padding: 0 8px;
            border-top: 1px solid rgba(9, 42, 63, 0.07);
          }

          .standingRow::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 12px;
            bottom: 12px;
            width: 3px;
          }

          .standingQualified::before {
            background: var(--division-color);
          }

          .standingEliminated {
            opacity: 0.5;
          }

          .standingEliminated::before {
            background: #9b3d3d;
          }

          .standingEmpty {
            opacity: 0.4;
          }

          .standingRank {
            color: var(--muted);
            font-size: 13px;
          }

          .standingTeam {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .standingTeam > div:last-child {
            min-width: 0;
            display: flex;
            flex-direction: column;
          }

          .standingTeam strong {
            overflow: hidden;
            color: var(--navy);
            font-size: 13px;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .standingTeam span {
            overflow: hidden;
            color: var(--muted);
            font-size: 9px;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .standingScore {
            color: var(--navy);
            font-size: 13px;
            text-align: right;
          }

          :global(.resultTeamLogo) {
            width: 38px;
            height: 38px;
            flex-shrink: 0;
            display: grid;
            place-items: center;
            overflow: hidden;
            border: 1px solid rgba(9, 42, 63, 0.16);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.55);
            color: var(--navy);
            font-size: 8px;
            font-weight: 900;
          }

          :global(.resultTeamLogo img) {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .bracketScroller {
            overflow-x: auto;
            padding: 21px;
          }

          .fullBracket {
            min-width: 1040px;
          }

          .laneTitle {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 14px;
            color: var(--navy);
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.09em;
          }

          .laneTitle span {
            width: 30px;
            height: 3px;
            background: var(--division-color);
          }

          .loserLane span {
            background: var(--orange);
          }

          .bracketColumns {
            display: grid;
            grid-template-columns: 190px 60px 190px 60px 190px 60px 205px;
            align-items: stretch;
          }

          .bracketRound h4 {
            margin: 0 0 12px;
            color: var(--muted);
            font-size: 9px;
            text-align: center;
          }

          .quarterMatches {
            min-height: 400px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .doubleMatches {
            min-height: 400px;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
          }

          .singleMatch {
            min-height: 400px;
            display: flex;
            align-items: center;
          }

          .bracketArrow {
            min-height: 400px;
            display: grid;
            place-items: center;
            color: rgba(9, 42, 63, 0.35);
            font-size: 24px;
          }

          .bracketDrop {
            margin: 22px 0;
            padding: 12px;
            border-top: 1px dashed rgba(9, 42, 63, 0.15);
            border-bottom: 1px dashed rgba(9, 42, 63, 0.15);
            color: var(--muted);
            font-size: 9px;
            text-align: center;
          }

          .historyCard {
            margin-bottom: 18px;
          }

          .historyList {
            display: flex;
            flex-direction: column;
          }

          .roleTabs {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 10px;
            padding: 20px;
          }

          .roleTabs button {
            min-height: 57px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid rgba(9, 42, 63, 0.23);
            border-radius: 8px;
            background: transparent;
            color: var(--navy);
            font-size: 10px;
            font-weight: 900;
          }

          .roleTabs img {
            width: 25px;
            height: 25px;
            object-fit: contain;
            opacity: 0.7;
          }

          .roleTabs button.roleActive {
            border-color: var(--division-color);
            background: var(--division-soft);
          }

          .roleTabs button.roleActive img {
            opacity: 1;
          }

          .statRankingGrid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            padding: 0 20px 20px;
          }

          .statsSubSection {
            padding: 18px 20px 22px;
            border-top: 1px solid rgba(9, 42, 63, 0.08);
          }

          .subSectionTitle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }

          .subSectionTitle > div {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .subSectionTitle > div > span {
            width: 23px;
            height: 3px;
            background: var(--division-color);
          }

.subSectionTitle strong {
  color: var(--navy);
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
}


.subSectionTitle small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
}
          .championRow {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 10px;
          }

          .championCard {
            position: relative;
            min-width: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 13px;
            border: 1px solid rgba(9, 42, 63, 0.15);
            border-radius: 9px;
            background: rgba(255, 250, 241, 0.52);
            text-align: center;
          }

          .championRank {
            position: absolute;
            top: 8px;
            right: 9px;
            color: var(--division-color);
            font-size: 9px;
            font-weight: 900;
          }

          .championCard > img,
          .championFallback {
            width: 62px;
            height: 62px;
            margin-bottom: 8px;
            border-radius: 9px;
          }

          .championCard > img {
            object-fit: cover;
          }

          .championFallback {
            display: grid;
            place-items: center;
            background: rgba(9, 42, 63, 0.07);
            color: var(--navy);
          }

.championName {
  overflow: hidden;
  max-width: 100%;
  color: var(--navy);
  font-size: 14px;
  font-weight: 900;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.championPicks {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}

          .championStats {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 5px;
            margin-top: 10px;
          }

          .championStats > div {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 6px;
            border-radius: 5px;
            background: rgba(9, 42, 63, 0.045);
          }

.championStats small {
  color: var(--muted);
  font-size: 9px;
  font-weight: 900;
}

.championStats strong {
  color: var(--navy);
  font-size: 14px;
  font-weight: 900;
}

          .emptySection,
          .miniEmpty {
            display: grid;
            place-items: center;
            color: var(--muted);
            font-weight: 700;
            text-align: center;
          }

          .emptySection {
            min-height: 115px;
            padding: 20px;
            font-size: 11px;
          }

          .miniEmpty {
            min-height: 90px;
            border: 1px dashed rgba(9, 42, 63, 0.14);
            border-radius: 8px;
            font-size: 10px;
          }

          @media (max-width: 1200px) {
            .resultsMainGrid {
              grid-template-columns: 1fr;
            }

            .statRankingGrid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 760px) {
            .divisionTabs {
              grid-template-columns: 1fr;
            }

            .roleTabs {
              grid-template-columns: repeat(2, 1fr);
            }

            .statRankingGrid {
              grid-template-columns: 1fr;
            }

            .championRow {
              grid-template-columns: repeat(2, 1fr);
            }
          }
        `}</style>
      </main>
    </>
  );
}

/* =========================================================
   CARD HEADER
========================================================= */

function CardHeader({
  eyebrow,
  title,
  badge,
}: {
  eyebrow:
    string;

  title:
    string;

  badge:
    string;
}) {
  return (
    <div className="cardHeader">
      <div>
        <p>
          {
            eyebrow
          }
        </p>

        <h3>
          {
            title
          }
        </h3>
      </div>

      <span>
        {
          badge
        }
      </span>

      <style jsx>{`
        .cardHeader {
          min-height: 86px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 17px 21px;
          border-bottom: 1px solid rgba(9, 42, 63, 0.1);
        }

        p {
          margin: 0 0 3px;
          color: var(--orange);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        h3 {
          margin: 0;
          color: var(--navy);
          font-family: var(--font-display);
          font-size: 27px;
          text-transform: uppercase;
        }

        .cardHeader > span {
          padding: 7px 10px;
          border-radius: 6px;
          background: var(--division-soft);
          color: var(--division-color);
          font-size: 8px;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   TEAM LOGO
========================================================= */

function TeamLogo({
  team,
}: {
  team:
    Team;
}) {
  return (
    <div className="resultTeamLogo">
      {team.logo ? (
        <img
          src={
            team.logo
          }
          alt={
            team.name
          }
        />
      ) : (
        <span>
          {
            team.shortName.slice(
              0,
              2
            )
          }
        </span>
      )}
    </div>
  );
}

/* =========================================================
   RANKING CARD
========================================================= */

function RankingCard({
  title,
  players,
  valueKey,
  formatter,
}: {
  title:
    string;

  players:
    PlayerStats[];

  valueKey:
    | 'kda'
    | 'goldPerMin'
    | 'dpm'
    | 'csPerMin'
    | 'visionScore';

  formatter:
    (
      value:
        number
    ) =>
      string;
}) {
  const [
    expanded,
    setExpanded,
  ] =
    useState(
      false
    );

  const ranking =
    [
      ...players,
    ]
      .filter(
        (
          player
        ) =>
          Number(
            player[
              valueKey
            ] ??
              0
          ) >
          0
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b[
              valueKey
            ] ??
              0
          ) -
          Number(
            a[
              valueKey
            ] ??
              0
          )
      );

  const visible =
    ranking.slice(
      0,
      expanded
        ? 10
        : 5
    );

  const max =
    Number(
      ranking[
        0
      ]?.[
        valueKey
      ] ??
        0
    );

  return (
    <div className="rankingCard">
      <div className="rankingHeader">
        <strong>
          {
            title
          }
        </strong>

        <span>
          TOP{' '}
          {expanded
            ? '10'
            : '5'}
        </span>
      </div>

      {visible.length ===
      0 ? (
        <div className="rankingEmpty">
          Aucune donnée
        </div>
      ) : (
        <div className="rankingPlayers">
          {visible.map(
            (
              player,
              index
            ) => {
              const value =
                Number(
                  player[
                    valueKey
                  ] ??
                    0
                );

              const percentage =
                max >
                0
                  ? Math.max(
                      4,
                      Math.min(
                        100,
                        (
                          value /
                          max
                        ) *
                          100
                      )
                    )
                  : 0;

              return (
                <div
                  key={`${player.playerId}-${valueKey}`}
                  className="rankingPlayer"
                >
                  <div className="rankingPlayerTop">
                    <span className="rankNumber">
                      #
                      {
                        index +
                        1
                      }
                    </span>

                    <div className="rankingIdentity">
                      <div className="rankingLogo">
                        {player.teamLogo ? (
                          <img
                            src={
                              player.teamLogo
                            }
                            alt=""
                          />
                        ) : (
                          player.teamShortName?.slice(
                            0,
                            2
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            player.riotId
                          }
                        </strong>

                        <span>
                          {
                            player.teamShortName
                          }
                        </span>
                      </div>
                    </div>

                    <strong className="rankingValue">
                      {
                        formatter(
                          value
                        )
                      }
                    </strong>
                  </div>

                  <div className="rankingBarTrack">
                    <div
                      className="rankingBarFill"
                      style={{
                        width:
                          `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {ranking.length >
        5 && (
        <button
          type="button"
          className="expandRanking"
          onClick={() =>
            setExpanded(
              (
                value
              ) =>
                !value
            )
          }
        >
          {expanded
            ? 'Réduire'
            : 'Voir top 10'}
        </button>
      )}

      <style jsx>{`
        .rankingCard {
          min-width: 0;
          padding: 13px;
          border: 1px solid rgba(9, 42, 63, 0.16);
          border-radius: 9px;
          background: rgba(255, 250, 241, 0.56);
        }

        .rankingHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 13px;
        }

        .rankingHeader strong {
          color: var(--navy);
          font-size: 12px;
        }

        .rankingHeader span {
          color: var(--division-color);
          font-size: 7px;
          font-weight: 900;
        }

        .rankingPlayers {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rankingPlayerTop {
          min-width: 0;
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          align-items: center;
          gap: 6px;
        }

        .rankNumber {
          color: var(--division-color);
          font-size: 9px;
          font-weight: 900;
        }

        .rankingIdentity {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rankingLogo {
          width: 27px;
          height: 27px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 5px;
          background: rgba(9, 42, 63, 0.07);
          font-size: 6px;
        }

        .rankingLogo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .rankingIdentity > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

.rankingIdentity strong {
  overflow: hidden;
  color: var(--navy);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rankingIdentity span {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
}
.rankingValue {
  color: var(--navy);
  font-size: 12px;
  font-weight: 900;
}

        .rankingBarTrack {
          height: 6px;
          margin-top: 5px;
          overflow: hidden;
          border-radius: 100px;
          background: rgba(9, 42, 63, 0.08);
        }

        .rankingBarFill {
          height: 100%;
          border-radius: inherit;
          background: var(--division-color);
        }

        .rankingEmpty {
          min-height: 150px;
          display: grid;
          place-items: center;
          color: var(--muted);
          font-size: 8px;
        }

        .expandRanking {
          width: 100%;
          min-height: 31px;
          margin-top: 13px;
          border: 1px solid rgba(9, 42, 63, 0.14);
          border-radius: 6px;
          background: transparent;
          color: var(--navy);
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   MVP
========================================================= */

function MvpRanking({
  players,
}: {
  players:
    PlayerStats[];
}) {
  const max =
    players[
      0
    ]?.mvp ??
    1;

  return (
    <div className="mvpRanking">
      {players.map(
        (
          player,
          index
        ) => {
          const width =
            (
              player.mvp /
              max
            ) *
            100;

          return (
            <div
              key={
                player.playerId
              }
              className="mvpRow"
            >
              <div className="mvpTop">
                <strong>
                  #
                  {
                    index +
                    1
                  }
                </strong>

                <span>
                  {
                    player.riotId
                  }
                </span>

                <small>
                  {
                    player.teamShortName
                  }
                </small>

                <b>
                  {
                    player.mvp
                  }{' '}
                  MVP
                </b>
              </div>

              <div className="mvpTrack">
                <div
                  className="mvpFill"
                  style={{
                    width:
                      `${width}%`,
                  }}
                />
              </div>
            </div>
          );
        }
      )}

      <style jsx>{`
        .mvpRanking {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 20px;
        }

.mvpTop {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  color: var(--navy);
  font-size: 12px;
}

        .mvpTop > strong {
          color: var(--division-color);
        }

.mvpTop small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}
.mvpTop b {
  font-size: 12px;
  font-weight: 900;
} }

        .mvpTrack {
          height: 6px;
          margin-top: 6px;
          overflow: hidden;
          border-radius: 100px;
          background: rgba(9, 42, 63, 0.08);
        }

        .mvpFill {
          height: 100%;
          border-radius: inherit;
          background: var(--division-color);
        }

        @media (max-width: 800px) {
          .mvpRanking {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   BRACKET
========================================================= */

function BracketMatch({
  team1,
  team2,
  highlighted =
    false,
}: {
  team1:
    string;

  team2:
    string;

  highlighted?:
    boolean;
}) {
  return (
    <div
      className={`bracketMatch ${
        highlighted
          ? 'highlighted'
          : ''
      }`}
    >
      <div>
        <span>
          ?
        </span>

        <strong>
          {
            team1
          }
        </strong>

        <b>
          -
        </b>
      </div>

      <div>
        <span>
          ?
        </span>

        <strong>
          {
            team2
          }
        </strong>

        <b>
          -
        </b>
      </div>

      <style jsx>{`
        .bracketMatch {
          width: 100%;
          overflow: hidden;
          border: 1px solid rgba(9, 42, 63, 0.3);
          border-radius: 8px;
          background: rgba(255, 250, 241, 0.9);
        }

        .bracketMatch.highlighted {
          border-color: var(--division-color);
        }

        .bracketMatch > div {
          min-height: 48px;
          display: grid;
          grid-template-columns: 29px minmax(0, 1fr) 20px;
          align-items: center;
          gap: 8px;
          padding: 0 9px;
        }

        .bracketMatch > div + div {
          border-top: 1px solid rgba(9, 42, 63, 0.1);
        }

        span {
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(9, 42, 63, 0.15);
          border-radius: 5px;
          font-size: 8px;
        }

        strong {
          overflow: hidden;
          color: var(--navy);
          font-size: 10px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        b {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   HISTORY
========================================================= */

function HistoryCard({
  match,
}: {
  match:
    HistoryMatch;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(
      false
    );

  if (
    !match.team1 ||
    !match.team2
  ) {
    return null;
  }

  return (
    <div className="historyMatch">
      <button
        type="button"
        className="historySummary"
        onClick={() =>
          setOpen(
            (
              value
            ) =>
              !value
          )
        }
      >
        <div className="historyMeta">
          <span>
            {match.stage ===
            'pool'
              ? 'POULE'
              : 'PLAYOFF'}
          </span>

          <small>
            {
              formatDate(
                match.playedAt
              )
            }
          </small>
        </div>

        <div className="historyTeams">
          <HistoryTeam
            team={
              match.team1
            }
          />

          <div className="historyScore">
            {
              match.team1
                .score
            }

            <span>
              -
            </span>

            {
              match.team2
                .score
            }
          </div>

          <HistoryTeam
            team={
              match.team2
            }
            reverse
          />
        </div>

        <span className="historyOpen">
          {open
            ? 'Réduire'
            : 'Voir le match'}
        </span>
      </button>

      {open && (
        <div className="historyDetails">
          <div className="historyMvp">
            <span>
              MVP DU BO
            </span>

            <strong>
              {
                match.mvpRiotId ??
                '-'
              }
            </strong>
          </div>

          <div className="historyGames">
            {match.games.map(
              (
                game
              ) => (
                <div
                  key={
                    game.id
                  }
                  className="historyGame"
                >
                  <strong>
                    GAME{' '}
                    {
                      game.gameNumber
                    }
                  </strong>

                  <span>
                    {
                      formatDuration(
                        game.durationSeconds
                      )
                    }
                  </span>

                  <span>
                    Winner :{' '}
                    {
                      game.winnerName ??
                      '-'
                    }
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .historyMatch {
          border-bottom: 1px solid rgba(9, 42, 63, 0.08);
        }

        .historyMatch:last-child {
          border-bottom: 0;
        }

        .historySummary {
          width: 100%;
          display: grid;
          grid-template-columns: 115px minmax(0, 1fr) 110px;
          align-items: center;
          gap: 15px;
          padding: 16px 20px;
          border: 0;
          background: transparent;
          text-align: left;
        }

        .historyMeta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .historyMeta span {
          width: auto;
          height: auto;
          padding: 4px 7px;
          border: 0;
          border-radius: 5px;
          background: var(--division-soft);
          color: var(--division-color);
          font-size: 7px;
          font-weight: 900;
        }

        .historyMeta small {
          color: var(--muted);
          font-size: 8px;
        }

        .historyTeams {
          display: grid;
          grid-template-columns: 1fr 85px 1fr;
          align-items: center;
          gap: 10px;
        }

        .historyScore {
          color: var(--navy);
          font-family: var(--font-display);
          font-size: 24px;
          text-align: center;
        }

        .historyScore span {
          width: auto;
          height: auto;
          margin: 0 8px;
          border: 0;
          opacity: 0.35;
        }

        .historyOpen {
          width: auto;
          height: auto;
          border: 0;
          color: var(--division-color);
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .historyDetails {
          padding: 0 20px 15px;
        }

        .historyMvp {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 10px;
          padding: 8px 11px;
          border: 1px solid rgba(9, 42, 63, 0.13);
          border-radius: 6px;
          background: var(--division-soft);
        }

        .historyMvp span {
          color: var(--division-color);
          font-size: 7px;
          font-weight: 900;
        }

        .historyMvp strong {
          color: var(--navy);
          font-size: 9px;
        }

        .historyGames {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .historyGame {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 9px;
          border: 1px solid rgba(9, 42, 63, 0.13);
          border-radius: 6px;
          color: var(--muted);
          font-size: 8px;
        }

        .historyGame strong {
          color: var(--division-color);
        }

        @media (max-width: 700px) {
          .historySummary {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .historyTeams {
            grid-template-columns: 1fr 55px 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function HistoryTeam({
  team,
  reverse =
    false,
}: {
  team:
    HistoryTeam;

  reverse?:
    boolean;
}) {
  return (
    <div
      className={`historyTeam ${
        reverse
          ? 'reverse'
          : ''
      }`}
    >
      <div className="historyLogo">
        {team.logo ? (
          <img
            src={
              team.logo
            }
            alt=""
          />
        ) : (
          team.shortName.slice(
            0,
            2
          )
        )}
      </div>

      <div>
        <strong>
          {
            team.shortName
          }
        </strong>

        <span>
          {
            team.name
          }
        </span>
      </div>

      <style jsx>{`
        .historyTeam {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          text-align: left;
        }

        .historyTeam.reverse {
          flex-direction: row-reverse;
          text-align: right;
        }

        .historyLogo {
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(9, 42, 63, 0.13);
          border-radius: 7px;
          font-size: 7px;
        }

        .historyLogo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .historyTeam > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        strong {
          color: var(--navy);
          font-size: 11px;
        }

        span {
          overflow: hidden;
          color: var(--muted);
          font-size: 7px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getSeedName(
  teams:
    Team[],

  seed:
    number
) {
  const team =
    teams[
      seed -
        1
    ];

  if (
    !team
  ) {
    return `#${seed} TBD`;
  }

  return `#${seed} ${team.shortName}`;
}

function formatDuration(
  seconds:
    number
) {
  const minutes =
    Math.floor(
      seconds /
        60
    );

  const rest =
    seconds %
    60;

  return `${minutes}:${String(
    rest
  ).padStart(
    2,
    '0'
  )}`;
}

function formatDate(
  value:
    string
) {
  try {
    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          '2-digit',

        year:
          'numeric',
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return '';
  }
}