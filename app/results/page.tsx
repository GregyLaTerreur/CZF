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

type StatSort =
  | 'kda'
  | 'kills'
  | 'assists'
  | 'gold'
  | 'dpm'
  | 'csPerMin'
  | 'mvp';

type ResultPlayer = {
  id:
    | number
    | string
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

  roster:
    ResultPlayer[];
};

type Champion = {
  id: string;
  key: string;
  name: string;
  image: string;
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

  mvpPlayerId:
    | number
    | null;

  mvpRiotId:
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

  mvp: number;

  totalDurationSeconds: number;
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

type RoleStats = Record<
  Role,
  PlayerStats[]
>;

type RoleChampions = Record<
  Role,
  ChampionRoleStat[]
>;

type ResultsApiData = {
  success: boolean;

  divisions: {
    Yordle: Team[];
    Ixtal: Team[];
    Targon: Team[];
  };

  teams: Team[];

  champions: Champion[];

  historyByDivision: {
    Yordle: HistoryMatch[];
    Ixtal: HistoryMatch[];
    Targon: HistoryMatch[];
  };

  playerStatsByDivision: {
    Yordle: RoleStats;
    Ixtal: RoleStats;
    Targon: RoleStats;
  };

  championsByDivision: {
    Yordle: RoleChampions;
    Ixtal: RoleChampions;
    Targon: RoleChampions;
  };
};

type DivisionConfig = {
  name: Division;
  color: string;
  soft: string;
};

/* =========================================================
   CONFIG
========================================================= */

const DIVISIONS:
  DivisionConfig[] = [
  {
    name: 'Yordle',
    color: '#51a677',
    soft:
      'rgba(81, 166, 119, 0.11)',
  },

  {
    name: 'Ixtal',
    color: '#4387d8',
    soft:
      'rgba(67, 135, 216, 0.11)',
  },

  {
    name: 'Targon',
    color: '#8f6bc7',
    soft:
      'rgba(143, 107, 199, 0.11)',
  },
];

const ROLES: Role[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

const ROLE_LABELS:
  Record<Role, string> = {
  Top: 'TOP',
  Jungle: 'JGL',
  Mid: 'MID',
  ADC: 'ADC',
  Support: 'SUP',
};

const ROLE_ICONS:
  Record<Role, string> = {
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

const SORTS: {
  id: StatSort;
  label: string;
}[] = [
  {
    id: 'kda',
    label: 'KDA',
  },

  {
    id: 'kills',
    label: 'Kills',
  },

  {
    id: 'assists',
    label: 'Assists',
  },

  {
    id: 'gold',
    label: 'Gold',
  },

  {
    id: 'dpm',
    label: 'DPM',
  },

  {
    id: 'csPerMin',
    label: 'CS/min',
  },

  {
    id: 'mvp',
    label: 'MVP',
  },
];

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
    sortBy,
    setSortBy,
  ] =
    useState<StatSort>(
      'kda'
    );

  const [
    resultsData,
    setResultsData,
  ] =
    useState<
      ResultsApiData |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  /* ======================================================
     FETCH
  ====================================================== */

  useEffect(() => {
    async function loadResults() {
      try {
        setLoading(true);
        setError('');

        const res =
          await fetch(
            '/api/results',
            {
              cache:
                'no-store',
            }
          );

        const data:
          ResultsApiData =
          await res.json();

        if (
          !res.ok ||
          !data.success
        ) {
          throw new Error(
            'Impossible de charger les résultats.'
          );
        }

        setResultsData(
          data
        );
      } catch (
        err: any
      ) {
        console.error(
          err
        );

        setError(
          err?.message ||
            'Erreur de chargement.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, []);

  /* ======================================================
     DIVISION
  ====================================================== */

  const divisionConfig =
    DIVISIONS.find(
      (item) =>
        item.name ===
        division
    ) ??
    DIVISIONS[0];

  const divisionTeams =
    useMemo(() => {
      if (!resultsData) {
        return [];
      }

      return (
        resultsData
          .divisions[
          division
        ] ?? []
      ).slice(
        0,
        10
      );
    }, [
      resultsData,
      division,
    ]);

  const divisionHistory =
    useMemo(() => {
      if (!resultsData) {
        return [];
      }

      return (
        resultsData
          .historyByDivision?.[
          division
        ] ?? []
      );
    }, [
      resultsData,
      division,
    ]);

  const roleStats =
    useMemo(() => {
      if (!resultsData) {
        return [];
      }

      const source =
        resultsData
          .playerStatsByDivision?.[
          division
        ]?.[
          selectedRole
        ] ?? [];

      return [
        ...source,
      ].sort(
        (
          a,
          b
        ) =>
          getSortValue(
            b,
            sortBy
          ) -
          getSortValue(
            a,
            sortBy
          )
      );
    }, [
      resultsData,
      division,
      selectedRole,
      sortBy,
    ]);

  const roleChampions =
    useMemo(() => {
      if (!resultsData) {
        return [];
      }

      return (
        resultsData
          .championsByDivision?.[
          division
        ]?.[
          selectedRole
        ] ?? []
      ).slice(
        0,
        3
      );
    }, [
      resultsData,
      division,
      selectedRole,
    ]);

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
        {/* ÉCLAIRS */}

        <img
          className="resultBolt resultBoltOne"
          src="/assets/eclairs/eclair_czf_04.png"
          alt=""
        />

        <img
          className="resultBolt resultBoltTwo"
          src="/assets/eclairs/eclair_czf_06.png"
          alt=""
        />

        {/* TITRE */}

        <div className="sectionTitle resultsTitle">
          <span />

          <h2>
            Résultats
          </h2>
        </div>

        {/* ERREUR */}

        {error && (
          <div className="resultsError">
            {error}
          </div>
        )}

        {/* DIVISIONS */}

        <div className="divisionTabs">
          {DIVISIONS.map(
            (item) => {
              const active =
                division ===
                item.name;

              return (
                <button
                  key={
                    item.name
                  }
                  type="button"
                  onClick={() => {
                    setDivision(
                      item.name
                    );

                    setSelectedRole(
                      'Top'
                    );

                    setSortBy(
                      'kda'
                    );
                  }}
                  className={`divisionTab ${
                    active
                      ? 'divisionTabActive'
                      : ''
                  }`}
                  style={
                    {
                      '--tab-color':
                        item.color,

                      '--tab-soft':
                        item.soft,
                    } as React.CSSProperties
                  }
                >
                  {item.name}
                </button>
              );
            }
          )}
        </div>

        {/* =================================================
            CLASSEMENT + BRACKET
        ================================================= */}

        <div className="resultsMainGrid">

          {/* CLASSEMENT */}

          <section className="resultsCard standingsCard">
            <div className="resultsCardHeader">
              <div>
                <p className="cardEyebrow">
                  PHASE DE POULE
                </p>

                <h3>
                  Classement
                </h3>
              </div>

              <div className="divisionBadge">
                {division}
              </div>
            </div>

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
              <div className="standingsMessage">
                Chargement...
              </div>
            ) : (
              <div className="standingRows">
                {divisionTeams.map(
                  (
                    team,
                    index
                  ) => {
                    const rank =
                      index +
                      1;

                    const qualified =
                      rank <=
                      8;

                    return (
                      <div
                        key={
                          team.id
                        }
                        className={`standingRow ${
                          qualified
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                      >
                        <div className="standingRank">
                          {rank}
                        </div>

                        <div className="standingTeam">
                          <TeamLogo
                            team={
                              team
                            }
                          />

                          <div className="standingTeamText">
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

                        <div className="standingScore">
                          <strong>
                            {
                              team.wins
                            }
                          </strong>

                          <span>
                            -
                          </span>

                          <strong>
                            {
                              team.losses
                            }
                          </strong>
                        </div>
                      </div>
                    );
                  }
                )}

                {Array.from({
                  length:
                    Math.max(
                      0,
                      10 -
                        divisionTeams.length
                    ),
                }).map(
                  (
                    _,
                    index
                  ) => {
                    const rank =
                      divisionTeams.length +
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
                        <div className="standingRank">
                          {
                            rank
                          }
                        </div>

                        <div className="standingTeam">
                          <div className="resultTeamLogo">
                            ?
                          </div>

                          <div className="standingTeamText">
                            <strong>
                              TBD
                            </strong>
                          </div>
                        </div>

                        <div className="standingScore">
                          <strong>
                            0
                          </strong>

                          <span>
                            -
                          </span>

                          <strong>
                            0
                          </strong>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            <div className="standingsLegend">
              <div>
                <span className="legendQualified" />
                Top 8 qualifié
              </div>

              <div>
                <span className="legendEliminated" />
                9e et 10e éliminés
              </div>
            </div>
          </section>

          {/* BRACKET */}

          <section className="resultsCard bracketCard">
            <div className="resultsCardHeader">
              <div>
                <p className="cardEyebrow">
                  PHASE FINALE
                </p>

                <h3>
                  Double élimination
                </h3>
              </div>

              <div className="divisionBadge">
                TOP 8
              </div>
            </div>

            <div className="bracketScroller">
              <div className="fullBracket">

                {/* WINNER */}

                <div className="laneTitle">
                  <span />
                  WINNER BRACKET
                </div>

                <div className="winnerBracket">

                  {/* QUARTS */}

                  <div className="bracketRound quarterRound">
                    <ColumnTitle>
                      Quarts
                    </ColumnTitle>

                    <div className="quarterMatches">
                      <BracketMatch
                        team1={getSeedTeam(
                          divisionTeams,
                          1
                        )}
                        team2={getSeedTeam(
                          divisionTeams,
                          8
                        )}
                      />

                      <BracketMatch
                        team1={getSeedTeam(
                          divisionTeams,
                          4
                        )}
                        team2={getSeedTeam(
                          divisionTeams,
                          5
                        )}
                      />

                      <BracketMatch
                        team1={getSeedTeam(
                          divisionTeams,
                          2
                        )}
                        team2={getSeedTeam(
                          divisionTeams,
                          7
                        )}
                      />

                      <BracketMatch
                        team1={getSeedTeam(
                          divisionTeams,
                          3
                        )}
                        team2={getSeedTeam(
                          divisionTeams,
                          6
                        )}
                      />
                    </div>
                  </div>

                  <WinnerConnector
                    type="quarters"
                  />

                  {/* DEMIES */}

                  <div className="bracketRound semiRound">
                    <ColumnTitle>
                      Demi-finales
                    </ColumnTitle>

                    <div className="semiMatches">
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

                  <WinnerConnector
                    type="semis"
                  />

                  {/* FINALE WINNER */}

                  <div className="bracketRound winnerFinalRound">
                    <ColumnTitle>
                      Finale Winner
                    </ColumnTitle>

                    <div className="singleMatchCenter">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                        highlighted
                      />
                    </div>
                  </div>

                  <WinnerConnector
                    type="final"
                  />

                  {/* GRANDE FINALE */}

                  <div className="bracketRound grandFinalRound">
                    <ColumnTitle>
                      Grande finale
                    </ColumnTitle>

                    <div className="singleMatchCenter">
                      <BracketMatch
                        team1="Winner WB"
                        team2="Winner LB"
                        grandFinal
                      />

                      <div className="championBox">
                        <span>
                          CHAMPION
                        </span>

                        <strong>
                          TBD
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DESCENTES */}

                <div className="dropArea">
                  <div className="dropMessage">
                    Les perdants du Winner Bracket descendent dans le Loser Bracket
                  </div>

                  <div className="dropLines">
                    <div className="dropLine dropQuarter" />
                    <div className="dropLine dropSemi" />
                    <div className="dropLine dropWinnerFinal" />
                  </div>
                </div>

                {/* LOSER */}

                <div className="laneTitle loserLaneTitle">
                  <span />
                  LOSER BRACKET
                </div>

                <div className="loserBracket">

                  <div className="bracketRound loserRoundOne">
                    <ColumnTitle>
                      Round 1
                    </ColumnTitle>

                    <div className="loserTwoMatches">
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

                  <LoserConnector
                    type="double"
                  />

                  <div className="bracketRound loserRoundTwo">
                    <ColumnTitle>
                      Round 2
                    </ColumnTitle>

                    <div className="loserTwoMatches">
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

                  <LoserConnector
                    type="double"
                  />

                  <div className="bracketRound loserRoundThree">
                    <ColumnTitle>
                      Round 3
                    </ColumnTitle>

                    <div className="singleMatchCenter">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>
                  </div>

                  <LoserConnector
                    type="single"
                  />

                  <div className="bracketRound loserFinalRound">
                    <ColumnTitle>
                      Finale Loser
                    </ColumnTitle>

                    <div className="singleMatchCenter">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser WB"
                        highlighted
                      />

                      <div className="returnFinal">
                        Winner LB

                        <span>
                          {' '}
                          → GRANDE FINALE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="loserReturnLine">
                  Le vainqueur du Loser Bracket rejoint la Grande Finale
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =================================================
            HISTORIQUE
        ================================================= */}

        <section className="resultsCard historyCard">
          <div className="resultsCardHeader">
            <div>
              <p className="cardEyebrow">
                MATCHS TERMINÉS
              </p>

              <h3>
                Historique des matchs
              </h3>
            </div>

            <div className="divisionBadge">
              {
                divisionHistory.length
              } MATCH
              {
                divisionHistory.length >
                1
                  ? 'S'
                  : ''
              }
            </div>
          </div>

          {loading ? (
            <div className="emptySection">
              Chargement...
            </div>
          ) : divisionHistory.length ===
            0 ? (
            <div className="emptySection">
              Aucun match enregistré pour le moment.
            </div>
          ) : (
            <div className="historyList">
              {divisionHistory.map(
                (
                  match
                ) => (
                  <HistoryMatchCard
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
            STATS JOUEURS
        ================================================= */}

        <section className="resultsCard statsCard">
          <div className="resultsCardHeader">
            <div>
              <p className="cardEyebrow">
                PERFORMANCES
              </p>

              <h3>
                Statistiques des joueurs
              </h3>
            </div>

            <div className="divisionBadge">
              {division}
            </div>
          </div>

          {/* ROLES */}

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
                  onClick={() =>
                    setSelectedRole(
                      role
                    )
                  }
                  className={`roleTab ${
                    selectedRole ===
                    role
                      ? 'roleTabActive'
                      : ''
                  }`}
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

          {/* TRI */}

          <div className="statsToolbar">
            <span>
              Trier par
            </span>

            <div className="sortButtons">
              {SORTS.map(
                (
                  sort
                ) => (
                  <button
                    key={
                      sort.id
                    }
                    type="button"
                    onClick={() =>
                      setSortBy(
                        sort.id
                      )
                    }
                    className={
                      sortBy ===
                      sort.id
                        ? 'sortActive'
                        : ''
                    }
                  >
                    {
                      sort.label
                    }
                  </button>
                )
              )}
            </div>
          </div>

          {/* TOP CHAMPIONS */}

          <div className="championStatsSection">
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
                Top 3
              </small>
            </div>

            {roleChampions.length ===
            0 ? (
              <div className="miniEmpty">
                Aucun pick enregistré.
              </div>
            ) : (
              <div className="topChampionsGrid">
                {roleChampions.map(
                  (
                    champion,
                    index
                  ) => (
                    <div
                      key={
                        champion.championId
                      }
                      className="championStatCard"
                    >
                      <span className="championRank">
                        #
                        {
                          index +
                          1
                        }
                      </span>

                      <div className="championIdentity">
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

                        <div>
                          <strong>
                            {
                              champion.name
                            }
                          </strong>

                          <span>
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
                        </div>
                      </div>

                      <div className="championRates">
                        <div>
                          <span>
                            PICK RATE
                          </span>

                          <strong>
                            {
                              champion.pickRate
                            }
                            %
                          </strong>
                        </div>

                        <div>
                          <span>
                            WIN RATE
                          </span>

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

          {/* TABLE JOUEURS */}

          <div className="playerStatsSection">
            <div className="subSectionTitle">
              <div>
                <span />

                <strong>
                  Classement{' '}
                  {
                    ROLE_LABELS[
                      selectedRole
                    ]
                  }
                </strong>
              </div>

              <small>
                {
                  SORTS.find(
                    (
                      item
                    ) =>
                      item.id ===
                      sortBy
                  )?.label
                }
              </small>
            </div>

            {roleStats.length ===
            0 ? (
              <div className="miniEmpty">
                Aucune statistique enregistrée pour ce rôle.
              </div>
            ) : (
              <div className="statsTableScroller">
                <div className="statsTable">
                  <div className="statsTableHeader">
                    <span>
                      #
                    </span>

                    <span>
                      Joueur
                    </span>

                    <span>
                      G
                    </span>

                    <span>
                      KDA
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
                      Gold
                    </span>

                    <span>
                      DPM
                    </span>

                    <span>
                      CS/min
                    </span>

                    <span>
                      MVP
                    </span>
                  </div>

                  {roleStats.map(
                    (
                      player,
                      index
                    ) => (
                      <div
                        key={`${player.playerId}-${player.role}`}
                        className="statsPlayerRow"
                      >
                        <strong className="statsRank">
                          {
                            index +
                            1
                          }
                        </strong>

                        <div className="statsPlayerIdentity">
                          <div className="statsTeamLogo">
                            {player.teamLogo ? (
                              <img
                                src={
                                  player.teamLogo
                                }
                                alt={
                                  player.teamName
                                }
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
                              }{' '}
                              •{' '}
                              {
                                player.wins
                              }
                              -
                              {
                                player.losses
                              }
                            </span>
                          </div>
                        </div>

                        <span>
                          {
                            player.games
                          }
                        </span>

                        <strong
                          className={
                            sortBy ===
                            'kda'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.kda
                          }
                        </strong>

                        <span
                          className={
                            sortBy ===
                            'kills'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.kills
                          }
                        </span>

                        <span>
                          {
                            player.deaths
                          }
                        </span>

                        <span
                          className={
                            sortBy ===
                            'assists'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.assists
                          }
                        </span>

                        <span
                          className={
                            sortBy ===
                            'gold'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.gold
                          }
                        </span>

                        <span
                          className={
                            sortBy ===
                            'dpm'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.dpm
                          }
                        </span>

                        <span
                          className={
                            sortBy ===
                            'csPerMin'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.csPerMin
                          }
                        </span>

                        <strong
                          className={
                            sortBy ===
                            'mvp'
                              ? 'highlightStat'
                              : ''
                          }
                        >
                          {
                            player.mvp
                          }
                        </strong>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            CSS
        ================================================= */}

        <style jsx>{`
          .resultsPage {
            position: relative;
            min-height: 100vh;
            overflow: visible;
          }

          .resultsTitle {
            position: relative;
            z-index: 10;
            margin-bottom: 28px;
          }

          .resultBolt {
            position: absolute;
            z-index: 7;
            object-fit: contain;
            pointer-events: none;
          }

          .resultBoltOne {
            width: 145px;
            left: -65px;
            top: 250px;
            opacity: 0.28;
            transform: rotate(-12deg);
          }

          .resultBoltTwo {
            width: 130px;
            right: -50px;
            top: 720px;
            opacity: 0.22;
            transform: rotate(15deg);
          }

          .resultsError {
            position: relative;
            z-index: 20;

            margin-bottom: 16px;
            padding: 13px 16px;

            border: 1px solid rgba(160, 60, 60, 0.25);
            border-radius: 8px;

            background: rgba(160, 60, 60, 0.08);

            color: #8f3434;
            font-size: 12px;
            font-weight: 800;
          }

          /* =========================
             DIVISIONS
          ========================= */

          .divisionTabs {
            position: relative;
            z-index: 10;

            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));

            gap: 14px;

            margin-bottom: 20px;
          }

          .divisionTab {
            position: relative;

            min-height: 68px;

            overflow: hidden;

            border:
              1.4px solid
              rgba(9, 42, 63, 0.5);

            border-radius: 11px;

            background:
              rgba(255, 246, 229, 0.8);

            color: var(--navy);

            font-size: 17px;
            font-weight: 900;

            letter-spacing: 0.07em;

            cursor: pointer;
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
            border-color:
              var(--tab-color);

            background:
              linear-gradient(
                135deg,
                var(--tab-soft),
                rgba(
                  255,
                  250,
                  240,
                  0.97
                )
              );
          }

          /* =========================
             CARTES
          ========================= */

          .resultsMainGrid {
            position: relative;
            z-index: 10;

            display: grid;

            grid-template-columns:
              minmax(290px, 0.24fr)
              minmax(0, 0.76fr);

            gap: 18px;
          }

          .resultsCard {
            position: relative;
            z-index: 10;

            overflow: hidden;

            border:
              1.3px solid
              rgba(9, 42, 63, 0.7);

            border-radius: 14px;

            background:
              rgba(255, 246, 229, 0.84);

            box-shadow:
              0 12px 30px
              rgba(8, 24, 36, 0.055);
          }

          .resultsCardHeader {
            min-height: 88px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 16px;

            padding: 18px 22px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.12);
          }

          .resultsCardHeader h3 {
            margin: 0;

            color: var(--navy);

            font-family:
              var(--font-display);

            font-size: 28px;

            text-transform: uppercase;
          }

          .cardEyebrow {
            margin: 0 0 4px;

            color: var(--orange);

            font-size: 10px;
            font-weight: 900;

            letter-spacing: 0.14em;
          }

          .divisionBadge {
            padding: 8px 11px;

            border-radius: 6px;

            background:
              var(--division-soft);

            color:
              var(--division-color);

            font-size: 10px;
            font-weight: 900;

            text-transform: uppercase;
          }

          /* =========================
             CLASSEMENT
          ========================= */

          .standingHeader,
          .standingRow {
            display: grid;

            grid-template-columns:
              28px
              minmax(0, 1fr)
              58px;

            align-items: center;

            gap: 9px;
          }

          .standingHeader {
            padding: 14px 15px 9px;

            color:
              rgba(7, 29, 45, 0.48);

            font-size: 10px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .standingHeader span:last-child {
            text-align: right;
          }

          .standingRows {
            padding:
              0
              8px
              10px;
          }

          .standingRow {
            position: relative;

            min-height: 64px;

            padding:
              0
              8px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.08);
          }

          .standingQualified::before,
          .standingEliminated::before {
            content: '';

            position: absolute;

            left: -8px;
            top: 12px;
            bottom: 12px;

            width: 3px;
          }

          .standingQualified::before {
            background:
              var(--division-color);
          }

          .standingEliminated {
            opacity: 0.48;
          }

          .standingEliminated::before {
            background: #9b3838;
          }

          .standingRank {
            color: var(--muted);

            font-size: 13px;
            font-weight: 900;
          }

          .standingTeam {
            min-width: 0;

            display: flex;
            align-items: center;

            gap: 10px;
          }

          .standingTeamText {
            min-width: 0;

            display: flex;
            flex-direction: column;

            gap: 2px;
          }

          .standingTeamText strong {
            overflow: hidden;

            color: var(--navy);

            font-size: 14px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          .standingTeamText span {
            overflow: hidden;

            color: var(--muted);

            font-size: 10px;
            font-weight: 700;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          .standingScore {
            display: flex;
            justify-content: flex-end;

            gap: 4px;

            color: var(--navy);

            font-size: 14px;
          }

          .standingScore span {
            opacity: 0.35;
          }

          .standingEmpty {
            opacity: 0.4;
          }

          .standingsMessage {
            min-height: 200px;

            display: grid;
            place-items: center;

            color: var(--muted);

            font-weight: 700;
          }

          .standingsLegend {
            display: flex;
            flex-direction: column;

            gap: 8px;

            padding: 15px 18px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.1);

            color: var(--muted);

            font-size: 10px;
            font-weight: 800;
          }

          .standingsLegend div {
            display: flex;
            align-items: center;

            gap: 7px;
          }

          .legendQualified,
          .legendEliminated {
            width: 14px;
            height: 3px;
          }

          .legendQualified {
            background:
              var(--division-color);
          }

          .legendEliminated {
            background:
              #9b3838;
          }

          :global(.resultTeamLogo) {
            width: 38px;
            height: 38px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.17);

            border-radius: 8px;

            background:
              rgba(255, 255, 255, 0.65);

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;
          }

          :global(.resultTeamLogo img) {
            width: 100%;
            height: 100%;

            object-fit: contain;
          }

          /* =========================
             BRACKET
          ========================= */

          .bracketScroller {
            overflow-x: auto;

            padding: 22px;
          }

          .fullBracket {
            min-width: 1050px;
          }

          .laneTitle {
            display: flex;
            align-items: center;

            gap: 9px;

            margin-bottom: 18px;

            color: var(--navy);

            font-size: 12px;
            font-weight: 900;

            letter-spacing: 0.11em;
          }

          .laneTitle > span {
            width: 30px;
            height: 3px;

            background:
              var(--division-color);
          }

          .loserLaneTitle > span {
            background:
              var(--orange);
          }

          .winnerBracket,
          .loserBracket {
            display: grid;

            grid-template-columns:
              190px
              72px
              190px
              72px
              190px
              72px
              205px;

            align-items: stretch;
          }

          :global(.columnTitle) {
            margin-bottom: 14px;

            color:
              rgba(7, 29, 45, 0.58);

            font-size: 10px;
            font-weight: 900;

            text-align: center;

            text-transform: uppercase;

            letter-spacing: 0.08em;
          }

          .quarterMatches {
            min-height: 420px;

            display: flex;
            flex-direction: column;

            justify-content: space-between;
          }

          .semiMatches {
            min-height: 420px;

            display: flex;
            flex-direction: column;

            justify-content: space-around;

            padding:
              55px
              0;
          }

          .singleMatchCenter {
            min-height: 420px;

            display: flex;
            flex-direction: column;

            justify-content: center;
          }

          .loserTwoMatches {
            min-height: 300px;

            display: flex;
            flex-direction: column;

            justify-content: space-around;

            padding:
              35px
              0;
          }

          :global(.bracketMatch) {
            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.3);

            border-radius: 8px;

            background:
              rgba(255, 250, 241, 0.9);

            box-shadow:
              0 5px 14px
              rgba(8, 24, 36, 0.05);
          }

          :global(.highlightedMatch) {
            border-color:
              var(--division-color);
          }

          :global(.grandFinalMatch) {
            border:
              1.7px solid
              var(--division-color);
          }

          :global(.bracketTeam) {
            min-height: 52px;

            display: flex;
            align-items: center;

            gap: 9px;

            padding:
              0
              11px;
          }

          :global(.bracketTeam + .bracketTeam) {
            border-top:
              1px solid
              rgba(9, 42, 63, 0.11);
          }

          :global(.miniTeamLogo) {
            width: 30px;
            height: 30px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9, 42, 63, 0.16);

            border-radius: 6px;

            background:
              rgba(255, 255, 255, 0.7);

            color: var(--muted);

            font-size: 10px;
            font-weight: 900;
          }

          :global(.bracketTeamName) {
            flex: 1;

            overflow: hidden;

            color: var(--navy);

            font-size: 12px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          :global(.matchScore) {
            color: var(--muted);

            font-size: 13px;
            font-weight: 900;
          }

          /* CONNECTEURS */

          :global(.winnerConnector),
          :global(.loserConnector) {
            position: relative;
          }

          :global(.winnerConnector) {
            min-height: 420px;
          }

          :global(.winnerConnectorLine),
          :global(.loserConnectorLine) {
            position: absolute;

            background:
              rgba(9, 42, 63, 0.34);
          }

          :global(.winnerConnectorQ1) {
            top: 12%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorQ2) {
            top: 36%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorQ3) {
            top: 64%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorQ4) {
            top: 88%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorQV1) {
            top: 12%;
            left: 50%;
            width: 1px;
            height: 24%;
          }

          :global(.winnerConnectorQV2) {
            top: 64%;
            left: 50%;
            width: 1px;
            height: 24%;
          }

          :global(.winnerConnectorQOut1) {
            top: 24%;
            left: 50%;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorQOut2) {
            top: 76%;
            left: 50%;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorS1) {
            top: 24%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorS2) {
            top: 76%;
            left: 0;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorSV) {
            top: 24%;
            left: 50%;
            width: 1px;
            height: 52%;
          }

          :global(.winnerConnectorSOut) {
            top: 50%;
            left: 50%;
            width: 50%;
            height: 1px;
          }

          :global(.winnerConnectorFinal) {
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
          }

          .dropArea {
            position: relative;

            min-height: 105px;

            margin:
              22px
              0;

            border-top:
              1px dashed
              rgba(9, 42, 63, 0.14);

            border-bottom:
              1px dashed
              rgba(9, 42, 63, 0.14);
          }

          .dropMessage {
            position: absolute;

            left: 50%;
            top: 50%;

            transform:
              translate(-50%, -50%);

            padding:
              6px
              12px;

            background:
              rgba(255, 246, 229, 0.94);

            color: var(--muted);

            font-size: 10px;
            font-weight: 800;

            z-index: 3;
          }

          .dropLines {
            position: absolute;
            inset: 0;
          }

          .dropLine {
            position: absolute;

            top: 0;
            bottom: 0;

            width: 1px;

            background:
              rgba(242, 101, 34, 0.42);
          }

          .dropLine::after {
            content: '';

            position: absolute;

            left: -3px;
            bottom: 0;

            width: 7px;
            height: 7px;

            border-right:
              1px solid
              var(--orange);

            border-bottom:
              1px solid
              var(--orange);

            transform:
              rotate(45deg);
          }

          .dropQuarter {
            left: 20%;
          }

          .dropSemi {
            left: 47%;
          }

          .dropWinnerFinal {
            left: 72%;
          }

          :global(.loserConnector) {
            min-height: 300px;
          }

          :global(.loserDoubleTop) {
            top: 28%;
            left: 0;

            width: 50%;
            height: 1px;
          }

          :global(.loserDoubleBottom) {
            top: 72%;
            left: 0;

            width: 50%;
            height: 1px;
          }

          :global(.loserDoubleVertical) {
            top: 28%;
            left: 50%;

            width: 1px;
            height: 44%;
          }

          :global(.loserDoubleOut) {
            top: 50%;
            left: 50%;

            width: 50%;
            height: 1px;
          }

          :global(.loserSingle) {
            top: 50%;
            left: 0;

            width: 100%;
            height: 1px;
          }

          .championBox {
            display: flex;
            align-items: center;
            justify-content: space-between;

            margin-top: 12px;

            padding: 12px;

            border-radius: 7px;

            background: var(--navy);

            color: white;

            font-size: 10px;
            font-weight: 900;
          }

          .championBox strong {
            color:
              var(--division-color);

            font-size: 12px;
          }

          .returnFinal {
            margin-top: 10px;

            color: var(--orange);

            font-size: 10px;
            font-weight: 900;

            text-align: center;
          }

          .returnFinal span {
            color:
              var(--division-color);
          }

          .loserReturnLine {
            margin-top: 22px;

            padding: 11px;

            border:
              1px dashed
              rgba(9, 42, 63, 0.15);

            border-radius: 7px;

            color: var(--muted);

            font-size: 9px;
            font-weight: 800;

            text-align: center;
          }

          /* =========================
             HISTORIQUE
          ========================= */

          .historyCard,
          .statsCard {
            margin-top: 18px;
          }

          .historyList {
            display: flex;
            flex-direction: column;
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

            font-size: 12px;
          }

          .miniEmpty {
            min-height: 90px;

            border:
              1px dashed
              rgba(9, 42, 63, 0.13);

            border-radius: 8px;

            font-size: 11px;
          }

          /* =========================
             ROLE TABS
          ========================= */

          .roleTabs {
            display: grid;

            grid-template-columns:
              repeat(5, 1fr);

            gap: 10px;

            padding:
              20px
              20px
              0;
          }

          .roleTab {
            min-height: 57px;

            display: flex;
            align-items: center;
            justify-content: center;

            gap: 8px;

            border:
              1px solid
              rgba(9, 42, 63, 0.24);

            border-radius: 8px;

            background:
              rgba(255, 250, 241, 0.54);

            color: var(--navy);

            font-size: 11px;
            font-weight: 900;

            cursor: pointer;
          }

          .roleTab img {
            width: 24px;
            height: 24px;

            object-fit: contain;

            opacity: 0.72;
          }

          .roleTabActive {
            border-color:
              var(--division-color);

            background:
              var(--division-soft);
          }

          .roleTabActive img {
            opacity: 1;
          }

          /* =========================
             TRI
          ========================= */

          .statsToolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 14px;

            padding:
              16px
              20px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.08);
          }

          .statsToolbar > span {
            color: var(--muted);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .sortButtons {
            display: flex;
            align-items: center;

            gap: 6px;

            flex-wrap: wrap;
          }

          .sortButtons button {
            min-height: 31px;

            padding:
              0
              10px;

            border:
              1px solid
              rgba(9, 42, 63, 0.16);

            border-radius: 6px;

            background:
              rgba(255, 255, 255, 0.34);

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            cursor: pointer;
          }

          .sortButtons .sortActive {
            border-color:
              var(--division-color);

            background:
              var(--division-soft);

            color:
              var(--division-color);
          }

          /* =========================
             SOUS SECTIONS
          ========================= */

          .championStatsSection,
          .playerStatsSection {
            padding: 20px;
          }

          .playerStatsSection {
            padding-top: 4px;
          }

          .subSectionTitle {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 14px;

            margin-bottom: 13px;
          }

          .subSectionTitle > div {
            display: flex;
            align-items: center;

            gap: 8px;
          }

          .subSectionTitle > div > span {
            width: 22px;
            height: 3px;

            background:
              var(--division-color);
          }

          .subSectionTitle strong {
            color: var(--navy);

            font-size: 11px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .subSectionTitle small {
            color: var(--muted);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;
          }

          /* =========================
             CHAMPIONS
          ========================= */

          .topChampionsGrid {
            display: grid;

            grid-template-columns:
              repeat(3, minmax(0, 1fr));

            gap: 11px;
          }

          .championStatCard {
            position: relative;

            padding: 13px;

            border:
              1px solid
              rgba(9, 42, 63, 0.18);

            border-radius: 9px;

            background:
              rgba(255, 250, 241, 0.62);
          }

          .championRank {
            position: absolute;

            right: 10px;
            top: 9px;

            color:
              var(--division-color);

            font-size: 10px;
            font-weight: 900;
          }

          .championIdentity {
            display: flex;
            align-items: center;

            gap: 10px;

            padding-right: 25px;
          }

          .championIdentity img,
          .championFallback {
            width: 46px;
            height: 46px;

            flex-shrink: 0;

            border-radius: 8px;
          }

          .championIdentity img {
            object-fit: cover;
          }

          .championFallback {
            display: grid;
            place-items: center;

            background:
              rgba(9, 42, 63, 0.08);

            color: var(--navy);
          }

          .championIdentity > div {
            min-width: 0;

            display: flex;
            flex-direction: column;

            gap: 2px;
          }

          .championIdentity strong {
            overflow: hidden;

            color: var(--navy);

            font-size: 13px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          .championIdentity span {
            color: var(--muted);

            font-size: 9px;
            font-weight: 700;
          }

          .championRates {
            display: grid;

            grid-template-columns:
              repeat(2, 1fr);

            gap: 7px;

            margin-top: 12px;
          }

          .championRates > div {
            display: flex;
            flex-direction: column;

            gap: 2px;

            padding:
              7px
              8px;

            border-radius: 6px;

            background:
              rgba(9, 42, 63, 0.045);
          }

          .championRates span {
            color: var(--muted);

            font-size: 7px;
            font-weight: 900;
          }

          .championRates strong {
            color: var(--navy);

            font-size: 12px;
            font-weight: 900;
          }

          /* =========================
             PLAYER STATS
          ========================= */

          .statsTableScroller {
            overflow-x: auto;
          }

          .statsTable {
            min-width: 920px;

            border:
              1px solid
              rgba(9, 42, 63, 0.14);

            border-radius: 9px;

            overflow: hidden;
          }

          .statsTableHeader,
          .statsPlayerRow {
            display: grid;

            grid-template-columns:
              28px
              minmax(210px, 1fr)
              40px
              58px
              45px
              45px
              45px
              85px
              65px
              65px
              48px;

            gap: 6px;

            align-items: center;

            padding:
              0
              12px;
          }

          .statsTableHeader {
            min-height: 38px;

            background:
              rgba(9, 42, 63, 0.045);

            color: var(--muted);

            font-size: 8px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .statsPlayerRow {
            min-height: 63px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.07);

            color: var(--navy);

            font-size: 10px;
            font-weight: 800;
          }

          .statsRank {
            color:
              var(--division-color);

            font-size: 12px;
          }

          .statsPlayerIdentity {
            min-width: 0;

            display: flex;
            align-items: center;

            gap: 9px;
          }

          .statsTeamLogo {
            width: 35px;
            height: 35px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.14);

            border-radius: 7px;

            background:
              rgba(255, 255, 255, 0.5);

            font-size: 8px;
          }

          .statsTeamLogo img {
            width: 100%;
            height: 100%;

            object-fit: contain;
          }

          .statsPlayerIdentity > div:last-child {
            min-width: 0;

            display: flex;
            flex-direction: column;

            gap: 2px;
          }

          .statsPlayerIdentity strong {
            overflow: hidden;

            font-size: 11px;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          .statsPlayerIdentity span {
            color: var(--muted);

            font-size: 8px;
          }

          .highlightStat {
            color:
              var(--division-color) !important;

            font-weight: 900 !important;
          }

          @media (max-width: 1150px) {
            .resultsMainGrid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 800px) {
            .divisionTabs {
              grid-template-columns: 1fr;
            }

            .roleTabs {
              grid-template-columns:
                repeat(2, 1fr);
            }

            .topChampionsGrid {
              grid-template-columns: 1fr;
            }

            .statsToolbar {
              align-items: flex-start;

              flex-direction: column;
            }

            .resultBolt {
              opacity: 0.12;
            }
          }
        `}</style>
      </main>
    </>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function TeamLogo({
  team,
}: {
  team: Team;
}) {
  return (
    <div className="resultTeamLogo">
      {team.logo ? (
        <img
          src={team.logo}
          alt={team.name}
        />
      ) : (
        <span>
          {team.shortName.slice(
            0,
            2
          )}
        </span>
      )}
    </div>
  );
}

function getSeedTeam(
  teams: Team[],
  seed: number
) {
  const team =
    teams[
      seed -
        1
    ];

  if (!team) {
    return `#${seed} TBD`;
  }

  return `#${seed} ${team.shortName}`;
}

function getSortValue(
  player: PlayerStats,
  sort:
    StatSort
) {
  switch (sort) {
    case 'kda':
      return player.kda;

    case 'kills':
      return player.kills;

    case 'assists':
      return player.assists;

    case 'gold':
      return player.gold;

    case 'dpm':
      return player.dpm;

    case 'csPerMin':
      return player.csPerMin;

    case 'mvp':
      return player.mvp;

    default:
      return player.kda;
  }
}

function formatDuration(
  seconds: number
) {
  const minutes =
    Math.floor(
      seconds /
        60
    );

  const remaining =
    seconds %
    60;

  return `${minutes}:${String(
    remaining
  ).padStart(
    2,
    '0'
  )}`;
}

function formatDate(
  value: string
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

/* =========================================================
   HISTORIQUE
========================================================= */

function HistoryMatchCard({
  match,
}: {
  match: HistoryMatch;
}) {
  if (
    !match.team1 ||
    !match.team2
  ) {
    return null;
  }

  return (
    <div className="historyMatch">
      <div className="historyMeta">
        <span>
          {match.stage ===
          'pool'
            ? 'POULE'
            : 'PLAYOFF'}
        </span>

        {match.round && (
          <span>
            {
              match.round
            }
          </span>
        )}

        <small>
          {formatDate(
            match.playedAt
          )}
        </small>
      </div>

      <div className="historyMain">
        <HistoryTeamSide
          team={
            match.team1
          }
          winner={
            match.winner
              ?.id ===
            match.team1
              .id
          }
        />

        <div className="historyScore">
          <strong>
            {
              match.team1
                .score
            }
          </strong>

          <span>
            -
          </span>

          <strong>
            {
              match.team2
                .score
            }
          </strong>
        </div>

        <HistoryTeamSide
          team={
            match.team2
          }
          winner={
            match.winner
              ?.id ===
            match.team2
              .id
          }
          reverse
        />
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
                G
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

              {game.mvpRiotId && (
                <span>
                  MVP :{' '}
                  {
                    game.mvpRiotId
                  }
                </span>
              )}
            </div>
          )
        )}
      </div>

      <style jsx>{`
        .historyMatch {
          padding:
            16px
            20px;

          border-bottom:
            1px solid
            rgba(
              9,
              42,
              63,
              0.08
            );
        }

        .historyMatch:last-child {
          border-bottom: 0;
        }

        .historyMeta {
          display: flex;
          align-items: center;

          gap: 7px;

          margin-bottom: 10px;
        }

        .historyMeta span {
          padding:
            4px
            7px;

          border-radius: 5px;

          background:
            var(--division-soft);

          color:
            var(--division-color);

          font-size: 8px;
          font-weight: 900;
        }

        .historyMeta small {
          margin-left: auto;

          color:
            var(--muted);

          font-size: 9px;
          font-weight: 700;
        }

        .historyMain {
          display: grid;

          grid-template-columns:
            minmax(
              0,
              1fr
            )
            90px
            minmax(
              0,
              1fr
            );

          align-items: center;

          gap: 18px;
        }

        .historyScore {
          display: flex;
          align-items: center;
          justify-content: center;

          gap: 9px;

          color:
            var(--navy);

          font-family:
            var(--font-display);

          font-size: 25px;
        }

        .historyScore span {
          opacity: 0.35;
        }

        .historyGames {
          display: flex;
          align-items: center;

          gap: 7px;

          flex-wrap: wrap;

          margin-top: 11px;
        }

        .historyGame {
          display: flex;
          align-items: center;

          gap: 7px;

          padding:
            6px
            8px;

          border:
            1px solid
            rgba(
              9,
              42,
              63,
              0.11
            );

          border-radius: 6px;

          color:
            var(--muted);

          font-size: 8px;
          font-weight: 700;
        }

        .historyGame strong {
          color:
            var(--division-color);
        }

        @media (
          max-width: 700px
        ) {
          .historyMain {
            grid-template-columns:
              1fr
              55px
              1fr;

            gap: 7px;
          }

          .historyScore {
            font-size: 19px;
          }
        }
      `}</style>
    </div>
  );
}

function HistoryTeamSide({
  team,
  winner,
  reverse = false,
}: {
  team: HistoryTeam;
  winner: boolean;
  reverse?: boolean;
}) {
  return (
    <div
      className={`historyTeamSide ${
        reverse
          ? 'reverse'
          : ''
      } ${
        winner
          ? 'winner'
          : ''
      }`}
    >
      <div className="historyLogo">
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
        .historyTeamSide {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 10px;

          opacity: 0.66;
        }

        .historyTeamSide.reverse {
          flex-direction:
            row-reverse;

          text-align: right;
        }

        .historyTeamSide.winner {
          opacity: 1;
        }

        .historyLogo {
          width: 42px;
          height: 42px;

          flex-shrink: 0;

          display: grid;
          place-items: center;

          overflow: hidden;

          border:
            1px solid
            rgba(
              9,
              42,
              63,
              0.14
            );

          border-radius: 8px;

          background:
            rgba(
              255,
              255,
              255,
              0.5
            );

          color:
            var(--navy);

          font-size: 8px;
          font-weight: 900;
        }

        .historyLogo img {
          width: 100%;
          height: 100%;

          object-fit: contain;
        }

        .historyTeamSide > div:last-child {
          min-width: 0;

          display: flex;
          flex-direction: column;

          gap: 2px;
        }

        .historyTeamSide strong {
          color:
            var(--navy);

          font-size: 13px;
          font-weight: 900;
        }

        .historyTeamSide.winner strong {
          color:
            var(--division-color);
        }

        .historyTeamSide span {
          overflow: hidden;

          color:
            var(--muted);

          font-size: 9px;

          white-space: nowrap;

          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   BRACKET
========================================================= */

function ColumnTitle({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="columnTitle">
      {children}
    </div>
  );
}

function BracketMatch({
  team1,
  team2,
  highlighted = false,
  grandFinal = false,
}: {
  team1: string;
  team2: string;

  highlighted?: boolean;
  grandFinal?: boolean;
}) {
  return (
    <div
      className={[
        'bracketMatch',

        highlighted
          ? 'highlightedMatch'
          : '',

        grandFinal
          ? 'grandFinalMatch'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="bracketTeam">
        <span className="miniTeamLogo">
          ?
        </span>

        <span className="bracketTeamName">
          {team1}
        </span>

        <strong className="matchScore">
          -
        </strong>
      </div>

      <div className="bracketTeam">
        <span className="miniTeamLogo">
          ?
        </span>

        <span className="bracketTeamName">
          {team2}
        </span>

        <strong className="matchScore">
          -
        </strong>
      </div>
    </div>
  );
}

function WinnerConnector({
  type,
}: {
  type:
    | 'quarters'
    | 'semis'
    | 'final';
}) {
  if (
    type ===
    'quarters'
  ) {
    return (
      <div className="winnerConnector">
        <span className="winnerConnectorLine winnerConnectorQ1" />
        <span className="winnerConnectorLine winnerConnectorQ2" />
        <span className="winnerConnectorLine winnerConnectorQ3" />
        <span className="winnerConnectorLine winnerConnectorQ4" />

        <span className="winnerConnectorLine winnerConnectorQV1" />
        <span className="winnerConnectorLine winnerConnectorQV2" />

        <span className="winnerConnectorLine winnerConnectorQOut1" />
        <span className="winnerConnectorLine winnerConnectorQOut2" />
      </div>
    );
  }

  if (
    type ===
    'semis'
  ) {
    return (
      <div className="winnerConnector">
        <span className="winnerConnectorLine winnerConnectorS1" />
        <span className="winnerConnectorLine winnerConnectorS2" />

        <span className="winnerConnectorLine winnerConnectorSV" />

        <span className="winnerConnectorLine winnerConnectorSOut" />
      </div>
    );
  }

  return (
    <div className="winnerConnector">
      <span className="winnerConnectorLine winnerConnectorFinal" />
    </div>
  );
}

function LoserConnector({
  type,
}: {
  type:
    | 'double'
    | 'single';
}) {
  if (
    type ===
    'double'
  ) {
    return (
      <div className="loserConnector">
        <span className="loserConnectorLine loserDoubleTop" />

        <span className="loserConnectorLine loserDoubleBottom" />

        <span className="loserConnectorLine loserDoubleVertical" />

        <span className="loserConnectorLine loserDoubleOut" />
      </div>
    );
  }

  return (
    <div className="loserConnector">
      <span className="loserConnectorLine loserSingle" />
    </div>
  );
}