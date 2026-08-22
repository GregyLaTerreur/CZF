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

        <div className="sectionTitle resultsTitle">
          <span />
          <h2>Résultats</h2>
        </div>

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

        <div className="resultsMainGrid">
          {/* =========================
              CLASSEMENT
          ========================= */}

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
                        key={team.id}
                        className={`standingRow ${
                          qualified
                            ? 'standingQualified'
                            : 'standingEliminated'
                        }`}
                        title={
                          roster.length > 0
                            ? roster
                                .map(
                                  (player) =>
                                    `${player.role ?? 'Rôle'} : ${player.riotId}`
                                )
                                .join('\n')
                            : 'Roster non trouvé'
                        }
                      >
                        <div className="standingRank">
                          {rank}
                        </div>

                        <div className="standingTeam">
                          <TeamLogo
                            team={team}
                          />

                          <div className="standingTeamText">
                            <strong>
                              {team.shortName}
                            </strong>

                            <span>
                              {team.name}
                            </span>
                          </div>
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

          {/* =========================
              BRACKET
          ========================= */}

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

                {/* WINNER BRACKET */}

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

                  {/* WINNER FINAL */}

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

                {/* DESCENTES WINNER -> LOSER */}

                <div className="dropArea">
                  <div className="dropMessage">
                    Les perdants du Winner Bracket descendent dans le Loser Bracket
                  </div>

                  <div className="dropLines">
                    <div className="dropLine dropQuarter">
                      <span />
                    </div>

                    <div className="dropLine dropSemi">
                      <span />
                    </div>

                    <div className="dropLine dropWinnerFinal">
                      <span />
                    </div>
                  </div>
                </div>

                {/* LOSER BRACKET */}

                <div className="laneTitle loserLaneTitle">
                  <span />
                  LOSER BRACKET
                </div>

                <div className="loserBracket">

                  {/* ROUND 1 */}

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

                  {/* ROUND 2 */}

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

                  {/* ROUND 3 */}

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

                  {/* LOSER FINAL */}

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
                          → GRANDE FINALE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="loserReturnLine">
                  <span>
                    Le vainqueur du Loser Bracket remonte en Grande Finale
                  </span>

                  <div className="loserReturnPath">
                    <div className="returnHorizontal" />
                    <div className="returnVertical" />
                    <div className="returnTop" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =========================
            HISTORIQUE
        ========================= */}

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

        {/* =========================
            STATS
        ========================= */}

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

          /* =========================
             LAYOUT
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

            background: var(--division-soft);

            color: var(--division-color);

            font-size: 10px;
            font-weight: 900;

            text-transform: uppercase;
          }

          /* =========================
             CLASSEMENT PLUS GROS
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
            padding: 0 8px 10px;
          }

          .standingRow {
            position: relative;

            min-height: 64px;

            padding: 0 8px;

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
            background: #9b3838;
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
              rgba(255,255,255,.65);

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;
          }

          :global(.resultTeamLogo img) {
            width: 100%;
            height: 100%;

            object-fit: cover;
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
            background: var(--orange);
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

          .bracketRound {
            min-width: 0;
          }

          :global(.columnTitle) {
            margin-bottom: 14px;

            color:
              rgba(7,29,45,.58);

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

            padding: 55px 0;
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

            padding: 35px 0;
          }

          :global(.bracketMatch) {
            overflow: hidden;

            border:
              1px solid
              rgba(9,42,63,.3);

            border-radius: 8px;

            background:
              rgba(255,250,241,.9);

            box-shadow:
              0 5px 14px
              rgba(8,24,36,.05);
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

            padding: 0 11px;
          }

          :global(.bracketTeam + .bracketTeam) {
            border-top:
              1px solid
              rgba(9,42,63,.11);
          }

          :global(.miniTeamLogo) {
            width: 30px;
            height: 30px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9,42,63,.16);

            border-radius: 6px;

            background:
              rgba(255,255,255,.7);

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

          /* =========================
             CONNECTEURS WINNER
          ========================= */

          :global(.winnerConnector) {
            position: relative;

            min-height: 420px;
          }

          :global(.winnerConnectorLine) {
            position: absolute;

            background:
              rgba(9,42,63,.32);
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

          /* =========================
             DESCENTE LOSER
          ========================= */

          .dropArea {
            position: relative;

            min-height: 105px;

            margin: 22px 0;

            border-top:
              1px dashed
              rgba(9,42,63,.14);

            border-bottom:
              1px dashed
              rgba(9,42,63,.14);
          }

          .dropMessage {
            position: absolute;

            left: 50%;
            top: 50%;

            transform:
              translate(-50%, -50%);

            padding: 6px 12px;

            background:
              rgba(255,246,229,.92);

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
              rgba(242,101,34,.42);
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

          /* =========================
             CONNECTEURS LOSER
          ========================= */

          :global(.loserConnector) {
            position: relative;

            min-height: 300px;
          }

          :global(.loserConnectorLine) {
            position: absolute;

            background:
              rgba(242,101,34,.38);
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

          /* =========================
             GRANDE FINALE
          ========================= */

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
            position: relative;

            min-height: 80px;

            margin-top: 10px;

            color: var(--muted);

            font-size: 9px;
            font-weight: 800;
          }

          .loserReturnLine > span {
            position: absolute;

            left: 50%;
            bottom: 0;

            transform:
              translateX(-50%);
          }

          .loserReturnPath {
            position: absolute;

            right: 85px;
            top: -10px;

            width: 250px;
            height: 80px;
          }

          .returnHorizontal {
            position: absolute;

            right: 0;
            bottom: 0;

            width: 190px;
            height: 1px;

            background:
              linear-gradient(
                90deg,
                var(--orange),
                var(--division-color)
              );
          }

          .returnVertical {
            position: absolute;

            right: 0;
            top: 0;

            width: 1px;
            height: 80px;

            background:
              var(--division-color);
          }

          .returnTop {
            position: absolute;

            right: 0;
            top: 0;

            width: 70px;
            height: 1px;

            background:
              var(--division-color);
          }

          /* =========================
             BAS PAGE
          ========================= */

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

            font-size: 12px;
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
            min-height: 50px;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9,42,63,.25);

            border-radius: 8px;

            color: var(--navy);

            font-size: 12px;
            font-weight: 900;
          }

          .statsEmpty {
            min-height: 80px;
          }

          @media (max-width: 1150px) {
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
  children: React.ReactNode;
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
  type: 'quarters' | 'semis' | 'final';
}) {
  if (type === 'quarters') {
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

  if (type === 'semis') {
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
  type: 'double' | 'single';
}) {
  if (type === 'double') {
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