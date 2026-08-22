'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../components/Nav';

type Division = 'Yordle' | 'Ixtal' | 'Targon';

type ResultPlayer = {
  id: number | string | null;
  riotId: string;
  discordName: string | null;
  role: string | null;
  avatar: string | null;
};

type Team = {
  id: number | string;
  name: string;
  shortName: string;
  logo: string | null;
  division: Division | null;
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

type DivisionConfig = {
  name: Division;
  color: string;
  soft: string;
};

type ResultsApiData = {
  success: boolean;

  divisions: {
    Yordle: Team[];
    Ixtal: Team[];
    Targon: Team[];
  };

  champions: Champion[];
};

const DIVISIONS: DivisionConfig[] = [
  {
    name: 'Yordle',
    color: '#51a677',
    soft: 'rgba(81, 166, 119, 0.11)',
  },
  {
    name: 'Ixtal',
    color: '#4387d8',
    soft: 'rgba(67, 135, 216, 0.11)',
  },
  {
    name: 'Targon',
    color: '#8f6bc7',
    soft: 'rgba(143, 107, 199, 0.11)',
  },
];

export default function ResultsPage() {
  const [division, setDivision] =
    useState<Division>('Yordle');

  const [resultsData, setResultsData] =
    useState<ResultsApiData | null>(null);

  const [champions, setChampions] =
    useState<Champion[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadResults() {
      try {
        setLoading(true);

        const res = await fetch('/api/results', {
          cache: 'no-store',
        });

        const data: ResultsApiData =
          await res.json();

        if (!res.ok || !data.success) {
          throw new Error(
            'Impossible de récupérer les résultats'
          );
        }

        setResultsData(data);

        setChampions(
          data.champions || []
        );
      } catch (error) {
        console.error(
          'Erreur chargement résultats :',
          error
        );

        setResultsData(null);
        setChampions([]);
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, []);

  const divisionConfig =
    DIVISIONS.find(
      (item) =>
        item.name === division
    ) || DIVISIONS[0];

  const divisionTeams =
    useMemo(() => {
      if (!resultsData) {
        return [];
      }

      return (
        resultsData.divisions[
          division
        ] || []
      ).slice(0, 10);
    }, [
      resultsData,
      division,
    ]);

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
        {/* ÉCLAIRS LÉGERS */}

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
          <h2>Résultats</h2>
        </div>

        {/* CHOIX DIVISION */}

        <div className="divisionTabs">
          {DIVISIONS.map(
            (item) => {
              const active =
                division === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() =>
                    setDivision(
                      item.name
                    )
                  }
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

        {/* CLASSEMENT + BRACKET */}

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
              <span>#</span>
              <span>Équipe</span>
              <span>V/D</span>
            </div>

            {loading ? (
              <div className="standingsMessage">
                Chargement...
              </div>
            ) : (
              <div className="standingRows">
                {divisionTeams.map(
                  (team, index) => {
                    const rank =
                      index + 1;

                    const qualified =
                      rank <= 8;

                    const roster =
                      team.roster || [];

                    return (
                      <div
                        key={
                          team.id ??
                          index
                        }
                        className={`standingRow ${
                          qualified
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                        title={
                          roster.length > 0
                            ? roster
                                .map(
                                  (
                                    player
                                  ) =>
                                    `${player.role ?? 'Rôle'} : ${player.riotId}`
                                )
                                .join(
                                  '\n'
                                )
                            : 'Roster non trouvé'
                        }
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

                          <span>
                            {team.shortName}
                          </span>
                        </div>

                        <div className="standingScore">
                          <strong>
                            {team.wins}
                          </strong>

                          <span>
                            -
                          </span>

                          <strong>
                            {team.losses}
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
                  (_, index) => {
                    const rank =
                      divisionTeams.length +
                      index +
                      1;

                    return (
                      <div
                        key={`empty-${rank}`}
                        className={`standingRow standingEmpty ${
                          rank <= 8
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                      >
                        <div className="standingRank">
                          {rank}
                        </div>

                        <div className="standingTeam">
                          <div className="resultTeamLogo">
                            ?
                          </div>

                          <span>
                            TBD
                          </span>
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
                  <div className="bracketColumn quarterColumn">
                    <ColumnTitle>
                      Quarts
                    </ColumnTitle>

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

                  <Arrow />

                  <div className="bracketColumn semiColumn">
                    <ColumnTitle>
                      Demi-finales
                    </ColumnTitle>

                    <BracketMatch
                      team1="TBD"
                      team2="TBD"
                    />

                    <BracketMatch
                      team1="TBD"
                      team2="TBD"
                    />
                  </div>

                  <Arrow />

                  <div className="bracketColumn centerColumn">
                    <ColumnTitle>
                      Finale Winner
                    </ColumnTitle>

                    <BracketMatch
                      team1="TBD"
                      team2="TBD"
                      highlighted
                    />
                  </div>

                  <Arrow />

                  <div className="bracketColumn centerColumn">
                    <ColumnTitle>
                      Grande finale
                    </ColumnTitle>

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

                {/* DESCENTE */}

                <div className="loserDrop">
                  <span>
                    Les équipes battues
                    descendent dans le
                    Loser Bracket
                  </span>
                </div>

                {/* LOSER */}

                <div className="laneTitle loserLaneTitle">
                  <span />
                  LOSER BRACKET
                </div>

                <div className="loserBracket">
                  <div className="bracketColumn loserTwo">
                    <ColumnTitle>
                      Round 1
                    </ColumnTitle>

                    <BracketMatch
                      team1="Loser QF"
                      team2="Loser QF"
                    />

                    <BracketMatch
                      team1="Loser QF"
                      team2="Loser QF"
                    />
                  </div>

                  <Arrow />

                  <div className="bracketColumn loserTwo">
                    <ColumnTitle>
                      Round 2
                    </ColumnTitle>

                    <BracketMatch
                      team1="TBD"
                      team2="Loser SF"
                    />

                    <BracketMatch
                      team1="TBD"
                      team2="Loser SF"
                    />
                  </div>

                  <Arrow />

                  <div className="bracketColumn centerColumn">
                    <ColumnTitle>
                      Round 3
                    </ColumnTitle>

                    <BracketMatch
                      team1="TBD"
                      team2="TBD"
                    />
                  </div>

                  <Arrow />

                  <div className="bracketColumn centerColumn">
                    <ColumnTitle>
                      Finale Loser
                    </ColumnTitle>

                    <BracketMatch
                      team1="TBD"
                      team2="Loser WB"
                      highlighted
                    />

                    <div className="returnFinal">
                      Winner LB
                      <span>
                        → GRANDE FINALE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* MATCHS PASSÉS */}

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
          </div>

          <div className="emptySection">
            Aucun match enregistré pour le moment.
          </div>
        </section>

        {/* STATS */}

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
          </div>

          <div className="roleTabsPreview">
            {[
              'TOP',
              'JGL',
              'MID',
              'ADC',
              'SUP',
            ].map((role) => (
              <div
                key={role}
                className="rolePreview"
              >
                {role}
              </div>
            ))}
          </div>

          <div className="emptySection statsEmpty">
            KDA, kills, assists, gold,
            DPM, CS/min et MVP seront
            alimentés par les games CZF.
          </div>
        </section>

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

          /* DIVISIONS */

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

            min-height: 66px;

            overflow: hidden;

            border:
              1.4px solid
              rgba(9, 42, 63, 0.5);

            border-radius: 11px;

            background:
              rgba(255, 246, 229, 0.8);

            color: var(--navy);

            font-size: 15px;
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

          /* LAYOUT */

          .resultsMainGrid {
            position: relative;
            z-index: 10;

            display: grid;

            grid-template-columns:
              minmax(245px, 0.21fr)
              minmax(0, 0.79fr);

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
            min-height: 82px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 16px;

            padding: 18px 21px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.12);
          }

          .resultsCardHeader h3 {
            margin: 0;

            color: var(--navy);

            font-family:
              var(--font-display);

            font-size: 25px;

            text-transform: uppercase;
          }

          .cardEyebrow {
            margin: 0 0 3px;

            color: var(--orange);

            font-size: 9px;
            font-weight: 900;

            letter-spacing: 0.14em;
          }

          .divisionBadge {
            padding: 7px 10px;

            border-radius: 6px;

            background: var(--division-soft);

            color: var(--division-color);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;
          }

          /* STANDINGS */

          .standingHeader,
          .standingRow {
            display: grid;

            grid-template-columns:
              24px
              minmax(0, 1fr)
              48px;

            align-items: center;

            gap: 7px;
          }

          .standingHeader {
            padding: 12px 14px 8px;

            color:
              rgba(7, 29, 45, 0.48);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;
          }

          .standingHeader span:last-child {
            text-align: right;
          }

          .standingRows {
            padding: 0 8px 10px;
          }

          .standingRow {
            position: relative;

            min-height: 52px;

            padding: 0 7px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.08);
          }

          .standingQualified::before,
          .standingEliminated::before {
            content: '';

            position: absolute;

            left: -8px;
            top: 11px;
            bottom: 11px;

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

            font-size: 10px;
            font-weight: 900;
          }

          .standingTeam {
            min-width: 0;

            display: flex;
            align-items: center;

            gap: 8px;
          }

          .standingTeam > span {
            overflow: hidden;

            color: var(--navy);

            font-size: 11px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          .standingScore {
            display: flex;
            justify-content: flex-end;

            gap: 3px;

            color: var(--navy);

            font-size: 10px;
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

            gap: 7px;

            padding: 14px 17px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.1);

            color: var(--muted);

            font-size: 9px;
            font-weight: 800;
          }

          .standingsLegend div {
            display: flex;
            align-items: center;

            gap: 7px;
          }

          .legendQualified,
          .legendEliminated {
            width: 12px;
            height: 3px;
          }

          .legendQualified {
            background:
              var(--division-color);
          }

          .legendEliminated {
            background: #9b3838;
          }

          :global(.resultTeamLogo) {
            width: 29px;
            height: 29px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.17);

            border-radius: 6px;

            background:
              rgba(255,255,255,.65);

            color: var(--navy);

            font-size: 8px;
            font-weight: 900;
          }

          :global(.resultTeamLogo img) {
            width: 100%;
            height: 100%;

            object-fit: cover;
          }

          /* BRACKET */

          .bracketScroller {
            overflow-x: auto;

            padding: 20px;
          }

          .fullBracket {
            min-width: 920px;
          }

          .laneTitle {
            display: flex;
            align-items: center;

            gap: 8px;

            margin-bottom: 15px;

            color: var(--navy);

            font-size: 10px;
            font-weight: 900;

            letter-spacing: 0.11em;
          }

          .laneTitle > span {
            width: 26px;
            height: 3px;

            background:
              var(--division-color);
          }

          .loserLaneTitle > span {
            background: var(--orange);
          }

          .winnerBracket,
          .loserBracket {
            display: grid;

            grid-template-columns:
              minmax(150px, 1fr)
              35px
              minmax(150px, 1fr)
              35px
              minmax(150px, 1fr)
              35px
              minmax(165px, 1fr);

            gap: 0;
          }

          .bracketColumn {
            display: flex;
            flex-direction: column;

            gap: 14px;
          }

          .quarterColumn {
            min-height: 365px;

            justify-content: space-between;
          }

          .semiColumn {
            min-height: 365px;

            justify-content: space-around;

            padding: 45px 0;
          }

          .centerColumn {
            min-height: 365px;

            justify-content: center;
          }

          .loserTwo {
            min-height: 270px;

            justify-content: space-around;

            padding: 30px 0;
          }

          :global(.columnTitle) {
            color:
              rgba(7,29,45,.5);

            font-size: 8px;
            font-weight: 900;

            text-align: center;

            text-transform: uppercase;

            letter-spacing: 0.08em;
          }

          :global(.bracketMatch) {
            overflow: hidden;

            border:
              1px solid
              rgba(9,42,63,.25);

            border-radius: 7px;

            background:
              rgba(255,250,241,.85);
          }

          :global(.highlightedMatch) {
            border-color:
              var(--division-color);
          }

          :global(.grandFinalMatch) {
            border:
              1.5px solid
              var(--division-color);
          }

          :global(.bracketTeam) {
            min-height: 38px;

            display: flex;
            align-items: center;

            gap: 7px;

            padding: 0 9px;
          }

          :global(.bracketTeam + .bracketTeam) {
            border-top:
              1px solid
              rgba(9,42,63,.1);
          }

          :global(.miniTeamLogo) {
            width: 21px;
            height: 21px;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9,42,63,.15);

            border-radius: 5px;

            color: var(--muted);

            font-size: 8px;
          }

          :global(.bracketTeamName) {
            flex: 1;

            overflow: hidden;

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          :global(.matchScore) {
            color: var(--muted);

            font-size: 10px;
          }

          :global(.bracketArrowBox) {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          :global(.bracketArrowLine) {
            width: 20px;
            height: 1px;

            background:
              rgba(9,42,63,.25);
          }

          .championBox {
            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 10px;

            border-radius: 6px;

            background: var(--navy);

            color: white;

            font-size: 8px;
            font-weight: 900;
          }

          .championBox strong {
            color:
              var(--division-color);
          }

          .loserDrop {
            min-height: 70px;

            display: flex;
            align-items: center;
            justify-content: center;

            margin: 15px 0;

            border-top:
              1px dashed
              rgba(9,42,63,.15);

            border-bottom:
              1px dashed
              rgba(9,42,63,.15);

            color: var(--muted);

            font-size: 9px;
            font-weight: 700;
          }

          .returnFinal {
            margin-top: 4px;

            color: var(--orange);

            font-size: 8px;
            font-weight: 900;

            text-align: center;
          }

          .returnFinal span {
            color:
              var(--division-color);
          }

          /* BAS PAGE */

          .historyCard,
          .statsCard {
            margin-top: 18px;
          }

          .emptySection {
            min-height: 110px;

            display: grid;
            place-items: center;

            padding: 20px;

            color: var(--muted);

            font-size: 11px;
            font-weight: 700;

            text-align: center;
          }

          .roleTabsPreview {
            display: grid;

            grid-template-columns:
              repeat(5, 1fr);

            gap: 10px;

            padding: 20px 20px 0;
          }

          .rolePreview {
            min-height: 46px;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9,42,63,.25);

            border-radius: 8px;

            color: var(--navy);

            font-size: 11px;
            font-weight: 900;
          }

          .statsEmpty {
            min-height: 80px;
          }

          @media (max-width: 1100px) {
            .resultsMainGrid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 750px) {
            .divisionTabs {
              grid-template-columns: 1fr;
            }

            .roleTabsPreview {
              grid-template-columns:
                repeat(2, 1fr);
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
          {team.shortName.slice(0, 2)}
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
    teams[seed - 1];

  if (!team) {
    return `#${seed} TBD`;
  }

  return `#${seed} ${team.shortName}`;
}

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

function Arrow() {
  return (
    <div className="bracketArrowBox">
      <div className="bracketArrowLine" />
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