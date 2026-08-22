'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../components/Nav';

type Division = 'Yordle' | 'Ixtal' | 'Targon';

type Team = {
  id?: string | number;
  name?: string;
  team_name?: string;
  short_name?: string;
  tag?: string;
  logo?: string;
  logo_url?: string;
  image?: string;
  division?: string;
  is_validated?: boolean;
  wins?: number;
  losses?: number;
};

type DivisionConfig = {
  name: Division;
  color: string;
  soft: string;
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

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true);

        const res =
          await fetch('/api/teams');

        const data =
          await res.json();

        if (data?.teams) {
          setTeams(data.teams);
        } else {
          setTeams([]);
        }
      } catch (error) {
        console.error(
          'Erreur récupération équipes :',
          error
        );

        setTeams([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  const divisionConfig =
    DIVISIONS.find(
      (item) =>
        item.name === division
    ) ?? DIVISIONS[0];

  const divisionTeams =
    useMemo(() => {
      return teams
        .filter(
          (team) =>
            team.is_validated === true
        )
        .filter(
          (team) =>
            normalizeDivision(
              team.division
            ) === division
        )
        .slice(0, 10);
    }, [teams, division]);

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
        {/* ÉCLAIRS TRÈS LÉGERS */}

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

        <img
          className="resultBolt resultBoltThree"
          src="/assets/eclairs/eclair_czf_09.png"
          alt=""
        />

        {/* TITRE */}

        <div className="sectionTitle resultsTitle">
          <span />

          <h2>Résultats</h2>
        </div>

        {/* DIVISIONS */}

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

        {/* POULE + DOUBLE ÉLIMINATION */}

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
              <span>V / D</span>
            </div>

            {loading ? (
              <div className="standingsMessage">
                Chargement...
              </div>
            ) : divisionTeams.length ===
              0 ? (
              <div className="standingsMessage">
                Aucune équipe validée
                dans cette division.
              </div>
            ) : (
              <div className="standingRows">
                {divisionTeams.map(
                  (team, index) => {
                    const qualified =
                      index < 8;

                    const eliminated =
                      index >= 8;

                    return (
                      <div
                        key={
                          team.id ??
                          `${getTeamName(
                            team
                          )}-${index}`
                        }
                        className={`standingRow ${
                          qualified
                            ? 'standingQualified'
                            : ''
                        } ${
                          eliminated
                            ? 'standingEliminated'
                            : ''
                        }`}
                      >
                        <div className="standingRank">
                          {index + 1}
                        </div>

                        <div className="standingTeam">
                          <TeamLogo
                            team={
                              team
                            }
                          />

                          <div className="standingTeamText">
                            <strong>
                              {getTeamShortName(
                                team
                              )}
                            </strong>

                            <span>
                              {getTeamName(
                                team
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="standingScore">
                          <strong>
                            {team.wins ??
                              0}
                          </strong>

                          <span>
                            -
                          </span>

                          <strong>
                            {team.losses ??
                              0}
                          </strong>
                        </div>
                      </div>
                    );
                  }
                )}

                {Array.from({
                  length: Math.max(
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
                          rank > 8
                            ? 'standingEliminated'
                            : ''
                        }`}
                      >
                        <div className="standingRank">
                          {rank}
                        </div>

                        <div className="standingTeam">
                          <div className="resultTeamLogo emptyLogo">
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
                1er à 8e :
                qualifiés
              </div>

              <div>
                <span className="legendEliminated" />
                9e et 10e :
                éliminés
              </div>
            </div>
          </section>

          {/* GRAND BRACKET UNIQUE */}

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

              <div className="bracketInfo">
                TOP 8
              </div>
            </div>

            <div className="bracketScroller">
              <div className="fullBracket">
                {/* TITRES COLONNES */}

                <div className="bracketColumnLabels">
                  <div>
                    Quarts
                  </div>

                  <div />

                  <div>
                    Demi-finales
                  </div>

                  <div />

                  <div>
                    Finale Winner
                  </div>

                  <div />

                  <div>
                    Grande finale
                  </div>
                </div>

                {/* WINNER BRACKET */}

                <div className="bracketLane winnerLane">
                  <div className="laneLabel winnerLabel">
                    <span />
                    WINNER BRACKET
                  </div>

                  <div className="bracketGrid">
                    {/* QUARTS */}

                    <div className="bracketColumn quarterColumn">
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

                    <BracketConnector />

                    {/* DEMI */}

                    <div className="bracketColumn semiColumn">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />

                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>

                    <BracketConnector />

                    {/* WINNER FINAL */}

                    <div className="bracketColumn winnerFinalColumn">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                        highlighted
                      />
                    </div>

                    <BracketConnector />

                    {/* GRANDE FINALE */}

                    <div className="bracketColumn grandFinalColumn">
                      <div className="grandFinalBox">
                        <span className="grandFinalTag">
                          GRANDE FINALE
                        </span>

                        <BracketMatch
                          team1="Winner WB"
                          team2="Winner LB"
                          grandFinal
                        />

                        <div className="championOutput">
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
                </div>

                {/* DESCENTE VERS LOSER */}

                <div className="dropZone">
                  <div className="dropLine dropLineOne">
                    <span>
                      Perdants des
                      quarts
                    </span>
                  </div>

                  <div className="dropLine dropLineTwo">
                    <span>
                      Perdants des
                      demies
                    </span>
                  </div>

                  <div className="dropLine dropLineThree">
                    <span>
                      Perdant finale
                      Winner
                    </span>
                  </div>
                </div>

                {/* LOSER BRACKET */}

                <div className="bracketLane loserLane">
                  <div className="laneLabel loserLabel">
                    <span />
                    LOSER BRACKET
                  </div>

                  <div className="bracketGrid loserGrid">
                    {/* LOSER ROUND 1 */}

                    <div className="bracketColumn loserRoundOne">
                      <BracketMatch
                        team1="Loser QF"
                        team2="Loser QF"
                      />

                      <BracketMatch
                        team1="Loser QF"
                        team2="Loser QF"
                      />
                    </div>

                    <BracketConnector />

                    {/* LOSER ROUND 2 */}

                    <div className="bracketColumn loserRoundTwo">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser SF"
                      />

                      <BracketMatch
                        team1="TBD"
                        team2="Loser SF"
                      />
                    </div>

                    <BracketConnector />

                    {/* LOSER ROUND 3 */}

                    <div className="bracketColumn loserRoundThree">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>

                    <BracketConnector />

                    {/* LOSER FINAL */}

                    <div className="bracketColumn loserFinalColumn">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser WB"
                        highlighted
                      />

                      <div className="loserToFinal">
                        <span>
                          Winner LB
                        </span>

                        <div className="loserToFinalLine" />

                        <div className="loserToFinalArrow" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bracketExplanation">
                  Une équipe éliminée du
                  Winner Bracket descend
                  dans le Loser Bracket.
                  Elle peut ensuite remonter
                  jusqu&apos;à la Grande
                  Finale.
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* HISTORIQUE */}

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

          <div className="historyEmpty">
            <strong>
              Aucun match enregistré
            </strong>

            <span>
              Les matchs terminés de
              la division {division}
              apparaîtront ici.
            </span>
          </div>
        </section>

        {/* STATS */}

        <section className="resultsCard statsPreviewCard">
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

          <div className="statsPreview">
            <div className="rolePreview">
              TOP
            </div>

            <div className="rolePreview">
              JGL
            </div>

            <div className="rolePreview">
              MID
            </div>

            <div className="rolePreview">
              ADC
            </div>

            <div className="rolePreview">
              SUP
            </div>
          </div>

          <p className="statsComing">
            KDA, kills, assists,
            gold, DPM, CS/min et MVP
            seront ajoutés ici.
          </p>
        </section>

        <style jsx>{`
          .resultsPage {
            position: relative;
            min-height: calc(
              100vh - 78px
            );
            overflow: visible;
          }

          .resultsTitle {
            position: relative;
            z-index: 20;

            margin-bottom: 28px;
          }

          /* ======================
             ÉCLAIRS
          ====================== */

          .resultBolt {
            position: absolute;

            z-index: 8;

            object-fit: contain;

            pointer-events: none;
            user-select: none;
          }

          .resultBoltOne {
            width: 145px;

            left: -60px;
            top: 250px;

            opacity: 0.34;

            transform:
              rotate(-13deg);
          }

          .resultBoltTwo {
            width: 125px;

            right: -45px;
            top: 670px;

            opacity: 0.28;

            transform:
              rotate(15deg);
          }

          .resultBoltThree {
            width: 150px;

            left: 8%;
            bottom: 120px;

            opacity: 0.18;

            transform:
              rotate(-9deg);
          }

          /* ======================
             DIVISIONS
          ====================== */

          .divisionTabs {
            position: relative;
            z-index: 20;

            display: grid;

            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );

            gap: 14px;

            margin-bottom: 20px;
          }

          .divisionTab {
            position: relative;

            min-height: 66px;

            overflow: hidden;

            border:
              1.4px solid
              rgba(
                9,
                42,
                63,
                0.5
              );

            border-radius: 11px;

            background:
              rgba(
                255,
                246,
                229,
                0.78
              );

            color: var(--navy);

            font-size: 15px;
            font-weight: 900;

            letter-spacing:
              0.07em;

            box-shadow:
              0 8px 20px
              rgba(
                8,
                24,
                36,
                0.04
              );
          }

          .divisionTab::after {
            content: '';

            position: absolute;

            left: 0;
            right: 0;
            bottom: 0;

            height: 5px;

            background:
              var(--tab-color);
          }

          .divisionTab:hover {
            background:
              rgba(
                255,
                250,
                240,
                0.97
              );
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
                  0.96
                )
              );

            box-shadow:
              0 10px 24px
              rgba(
                8,
                24,
                36,
                0.08
              );
          }

          /* ======================
             LAYOUT
          ====================== */

          .resultsMainGrid {
            position: relative;

            z-index: 15;

            display: grid;

            grid-template-columns:
              minmax(
                250px,
                0.21fr
              )
              minmax(
                0,
                0.79fr
              );

            gap: 18px;

            align-items: stretch;
          }

          .resultsCard {
            position: relative;

            z-index: 15;

            overflow: hidden;

            border:
              1.3px solid
              rgba(
                9,
                42,
                63,
                0.7
              );

            border-radius: 14px;

            background:
              rgba(
                255,
                246,
                229,
                0.84
              );

            box-shadow:
              0 12px 30px
              rgba(
                8,
                24,
                36,
                0.055
              );
          }

          .resultsCardHeader {
            min-height: 82px;

            display: flex;
            align-items: center;
            justify-content:
              space-between;

            gap: 16px;

            padding: 18px 21px;

            border-bottom:
              1px solid
              rgba(
                9,
                42,
                63,
                0.12
              );
          }

          .resultsCardHeader h3 {
            margin: 0;

            color: var(--navy);

            font-family:
              var(--font-display);

            font-size: 25px;

            text-transform:
              uppercase;

            letter-spacing:
              0.02em;
          }

          .cardEyebrow {
            margin: 0 0 3px;

            color: var(--orange);

            font-size: 9px;
            font-weight: 900;

            letter-spacing:
              0.14em;
          }

          .divisionBadge,
          .bracketInfo {
            flex-shrink: 0;

            padding: 7px 10px;

            border-radius: 6px;

            background:
              var(--division-soft);

            color:
              var(--division-color);

            font-size: 9px;
            font-weight: 900;

            letter-spacing:
              0.08em;

            text-transform:
              uppercase;
          }

          /* ======================
             CLASSEMENT
          ====================== */

          .standingHeader,
          .standingRow {
            display: grid;

            grid-template-columns:
              24px
              minmax(0, 1fr)
              50px;

            align-items: center;

            gap: 6px;
          }

          .standingHeader {
            padding:
              12px
              14px
              8px;

            color:
              rgba(
                7,
                29,
                45,
                0.48
              );

            font-size: 9px;
            font-weight: 900;

            text-transform:
              uppercase;
          }

          .standingHeader
            span:last-child {
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

            min-height: 53px;

            padding: 0 7px;

            border-bottom:
              1px solid
              rgba(
                9,
                42,
                63,
                0.08
              );
          }

          .standingRow:last-child {
            border-bottom: 0;
          }

          .standingQualified::before {
            content: '';

            position: absolute;

            left: -8px;
            top: 11px;
            bottom: 11px;

            width: 3px;

            border-radius:
              0 3px 3px 0;

            background:
              var(
                --division-color
              );
          }

          .standingEliminated {
            opacity: 0.48;
          }

          .standingEliminated::before {
            content: '';

            position: absolute;

            left: -8px;
            top: 11px;
            bottom: 11px;

            width: 3px;

            border-radius:
              0 3px 3px 0;

            background: #9c3b3b;
          }

          .standingRank {
            color:
              rgba(
                7,
                29,
                45,
                0.55
              );

            font-size: 11px;
            font-weight: 900;
          }

          .standingTeam {
            min-width: 0;

            display: flex;
            align-items: center;

            gap: 8px;
          }

          .standingTeamText {
            min-width: 0;

            display: flex;
            flex-direction: column;

            gap: 1px;
          }

          .standingTeamText strong {
            overflow: hidden;

            color: var(--navy);

            font-size: 10px;
            font-weight: 900;

            text-overflow:
              ellipsis;

            white-space: nowrap;
          }

          .standingTeamText span {
            overflow: hidden;

            max-width: 110px;

            color: var(--muted);

            font-size: 8px;
            font-weight: 700;

            text-overflow:
              ellipsis;

            white-space: nowrap;
          }

          .standingScore {
            display: flex;
            justify-content:
              flex-end;

            gap: 4px;

            color: var(--navy);

            font-size: 10px;
          }

          .standingScore span {
            opacity: 0.35;
          }

          .standingEmpty {
            opacity: 0.45;
          }

          .standingsMessage {
            min-height: 170px;

            display: flex;
            align-items: center;
            justify-content:
              center;

            padding: 20px;

            color: var(--muted);

            font-size: 11px;
            font-weight: 700;

            text-align: center;
          }

          .standingsLegend {
            display: flex;
            flex-direction: column;

            gap: 7px;

            padding:
              14px
              17px
              17px;

            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.09
              );

            color: var(--muted);

            font-size: 9px;
            font-weight: 800;
          }

          .standingsLegend > div {
            display: flex;
            align-items: center;

            gap: 7px;
          }

          .legendQualified,
          .legendEliminated {
            width: 12px;
            height: 3px;

            border-radius: 20px;
          }

          .legendQualified {
            background:
              var(
                --division-color
              );
          }

          .legendEliminated {
            background: #9c3b3b;
          }

          :global(
              .resultTeamLogo
            ) {
            width: 29px;
            height: 29px;

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
                0.17
              );

            border-radius: 6px;

            background:
              rgba(
                255,
                255,
                255,
                0.62
              );

            color: var(--navy);

            font-size: 8px;
            font-weight: 900;
          }

          :global(
              .resultTeamLogo img
            ) {
            width: 100%;
            height: 100%;

            object-fit: cover;
          }

          .emptyLogo {
            opacity: 0.55;
          }

          /* ======================
             BRACKET GLOBAL
          ====================== */

          .bracketScroller {
            overflow-x: auto;

            padding:
              18px
              18px
              20px;
          }

          .fullBracket {
            min-width: 960px;
          }

          .bracketColumnLabels {
            display: grid;

            grid-template-columns:
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                165px,
                1.05fr
              );

            margin:
              0
              0
              12px;

            color:
              rgba(
                7,
                29,
                45,
                0.47
              );

            font-size: 8px;
            font-weight: 900;

            text-align: center;

            text-transform:
              uppercase;

            letter-spacing:
              0.08em;
          }

          .bracketLane {
            position: relative;
          }

          .winnerLane {
            padding-bottom: 20px;
          }

          .loserLane {
            padding-top: 10px;
          }

          .laneLabel {
            display: flex;
            align-items: center;

            gap: 8px;

            margin-bottom: 13px;

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            letter-spacing:
              0.12em;
          }

          .laneLabel span {
            width: 24px;
            height: 3px;
          }

          .winnerLabel span {
            background:
              var(
                --division-color
              );
          }

          .loserLabel span {
            background:
              var(--orange);
          }

          .bracketGrid {
            display: grid;

            grid-template-columns:
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                150px,
                1fr
              )
              35px
              minmax(
                165px,
                1.05fr
              );

            align-items: stretch;
          }

          .bracketColumn {
            min-width: 0;

            display: flex;
            flex-direction: column;

            justify-content:
              center;

            gap: 15px;
          }

          .quarterColumn {
            justify-content:
              space-between;

            min-height: 360px;
          }

          .semiColumn {
            justify-content:
              space-around;

            min-height: 360px;

            padding:
              38px
              0;
          }

          .winnerFinalColumn,
          .grandFinalColumn {
            min-height: 360px;

            justify-content:
              center;
          }

          :global(
              .bracketMatch
            ) {
            overflow: hidden;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.25
              );

            border-radius: 7px;

            background:
              rgba(
                255,
                250,
                241,
                0.84
              );

            box-shadow:
              0 5px 12px
              rgba(
                8,
                24,
                36,
                0.035
              );
          }

          :global(
              .bracketMatchHighlighted
            ) {
            border-color:
              var(
                --division-color
              );
          }

          :global(
              .bracketGrandFinal
            ) {
            border:
              1.5px solid
              var(
                --division-color
              );

            box-shadow:
              0 8px 24px
              var(
                --division-soft
              );
          }

          :global(
              .bracketMatchTeam
            ) {
            min-height: 38px;

            display: flex;
            align-items: center;

            gap: 7px;

            padding: 0 9px;
          }

          :global(
              .bracketMatchTeam +
                .bracketMatchTeam
            ) {
            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.1
              );
          }

          :global(
              .bracketMiniLogo
            ) {
            width: 21px;
            height: 21px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.15
              );

            border-radius: 5px;

            background:
              rgba(
                255,
                255,
                255,
                0.65
              );

            color:
              rgba(
                7,
                29,
                45,
                0.4
              );

            font-size: 8px;
            font-weight: 900;
          }

          :global(
              .bracketTeamName
            ) {
            flex: 1;

            min-width: 0;

            overflow: hidden;

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow:
              ellipsis;
          }

          :global(
              .bracketScore
            ) {
            color:
              rgba(
                7,
                29,
                45,
                0.42
              );

            font-size: 10px;
          }

          :global(
              .bracketConnector
            ) {
            position: relative;

            display: flex;
            align-items: center;
            justify-content:
              center;
          }

          :global(
              .bracketConnectorLine
            ) {
            position: relative;

            width: 20px;
            height: 1px;

            background:
              rgba(
                9,
                42,
                63,
                0.22
              );
          }

          :global(
              .bracketConnectorLine::after
            ) {
            content: '';

            position: absolute;

            right: -1px;
            top: -3px;

            width: 6px;
            height: 6px;

            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.35
              );

            border-right:
              1px solid
              rgba(
                9,
                42,
                63,
                0.35
              );

            transform:
              rotate(45deg);
          }

          /* ======================
             GRANDE FINALE
          ====================== */

          .grandFinalBox {
            position: relative;

            display: flex;
            flex-direction: column;

            gap: 10px;
          }

          .grandFinalTag {
            color:
              var(
                --division-color
              );

            font-size: 8px;
            font-weight: 900;

            letter-spacing:
              0.1em;

            text-align: center;
          }

          .championOutput {
            display: flex;
            align-items: center;
            justify-content:
              space-between;

            min-height: 38px;

            padding: 0 11px;

            border-radius: 7px;

            background:
              var(--navy);

            color: white;
          }

          .championOutput span {
            font-size: 8px;
            font-weight: 900;

            letter-spacing:
              0.1em;
          }

          .championOutput strong {
            color:
              var(
                --division-color
              );

            font-size: 10px;
          }

          /* ======================
             DESCENTE LOSER
          ====================== */

          .dropZone {
            position: relative;

            min-height: 80px;

            margin:
              0
              18px;

            border-top:
              1px dashed
              rgba(
                9,
                42,
                63,
                0.13
              );

            border-bottom:
              1px dashed
              rgba(
                9,
                42,
                63,
                0.13
              );
          }

          .dropLine {
            position: absolute;

            top: 15px;
            bottom: 15px;

            width: 1px;

            background:
              linear-gradient(
                to bottom,
                rgba(
                  242,
                  101,
                  34,
                  0.1
                ),
                rgba(
                  242,
                  101,
                  34,
                  0.55
                ),
                rgba(
                  242,
                  101,
                  34,
                  0.1
                )
              );
          }

          .dropLine span {
            position: absolute;

            left: 8px;
            top: 50%;

            width: 100px;

            transform:
              translateY(-50%);

            color:
              var(--muted);

            font-size: 7px;
            font-weight: 800;
          }

          .dropLineOne {
            left: 15%;
          }

          .dropLineTwo {
            left: 43%;
          }

          .dropLineThree {
            left: 69%;
          }

          /* ======================
             LOSER
          ====================== */

          .loserGrid {
            position: relative;
          }

          .loserRoundOne,
          .loserRoundTwo {
            min-height: 260px;

            justify-content:
              space-around;

            padding:
              25px
              0;
          }

          .loserRoundThree,
          .loserFinalColumn {
            min-height: 260px;

            justify-content:
              center;
          }

          .loserFinalColumn {
            position: relative;
          }

          .loserToFinal {
            position: absolute;

            left: 50%;
            top: 50%;

            display: flex;
            align-items: center;

            width: 250px;

            transform:
              translate(
                80px,
                -50%
              );

            pointer-events: none;
          }

          .loserToFinal span {
            flex-shrink: 0;

            margin-right: 7px;

            color:
              var(--orange);

            font-size: 7px;
            font-weight: 900;

            letter-spacing:
              0.06em;
          }

          .loserToFinalLine {
            flex: 1;

            height: 1px;

            background:
              linear-gradient(
                90deg,
                var(--orange),
                var(
                  --division-color
                )
              );

            opacity: 0.55;
          }

          .loserToFinalArrow {
            width: 7px;
            height: 7px;

            margin-left: -6px;

            border-top:
              1.5px solid
              var(
                --division-color
              );

            border-right:
              1.5px solid
              var(
                --division-color
              );

            transform:
              rotate(45deg);
          }

          .bracketExplanation {
            margin-top: 17px;

            padding-top: 13px;

            border-top:
              1px solid
              rgba(
                9,
                42,
                63,
                0.09
              );

            color: var(--muted);

            font-size: 9px;
            font-weight: 700;

            text-align: center;
          }

          /* ======================
             HISTORIQUE
          ====================== */

          .historyCard,
          .statsPreviewCard {
            margin-top: 18px;
          }

          .historyEmpty {
            min-height: 125px;

            display: flex;
            flex-direction: column;

            align-items: center;
            justify-content:
              center;

            gap: 6px;

            padding: 22px;

            color: var(--navy);

            text-align: center;
          }

          .historyEmpty strong {
            font-size: 13px;
          }

          .historyEmpty span {
            color: var(--muted);

            font-size: 11px;
            font-weight: 600;
          }

          /* ======================
             STATS
          ====================== */

          .statsPreview {
            display: grid;

            grid-template-columns:
              repeat(
                5,
                minmax(0, 1fr)
              );

            gap: 10px;

            padding:
              20px
              20px
              10px;
          }

          .rolePreview {
            min-height: 48px;

            display: flex;
            align-items: center;
            justify-content:
              center;

            border:
              1px solid
              rgba(
                9,
                42,
                63,
                0.25
              );

            border-radius: 8px;

            background:
              rgba(
                255,
                250,
                241,
                0.62
              );

            color: var(--navy);

            font-size: 11px;
            font-weight: 900;
          }

          .statsComing {
            margin: 0;

            padding:
              8px
              20px
              20px;

            color: var(--muted);

            font-size: 10px;
            font-weight: 600;

            text-align: center;
          }

          /* ======================
             RESPONSIVE
          ====================== */

          @media (
            max-width: 1100px
          ) {
            .resultsMainGrid {
              grid-template-columns:
                1fr;
            }
          }

          @media (
            max-width: 750px
          ) {
            .divisionTabs {
              grid-template-columns:
                1fr;
            }

            .divisionTab {
              min-height: 57px;
            }

            .statsPreview {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
            }

            .resultBolt {
              opacity: 0.15;
            }
          }

          @media (
            max-width: 500px
          ) {
            .resultsCardHeader {
              align-items:
                flex-start;

              flex-direction:
                column;
            }

            .statsPreview {
              grid-template-columns:
                1fr;
            }
          }
        `}</style>
      </main>
    </>
  );
}

/* =========================================================
   HELPERS TEAMS
========================================================= */

function normalizeDivision(
  division?: string
): Division | null {
  if (!division) {
    return null;
  }

  const normalized =
    division
      .trim()
      .toLowerCase();

  if (
    normalized === 'yordle'
  ) {
    return 'Yordle';
  }

  if (
    normalized === 'ixtal'
  ) {
    return 'Ixtal';
  }

  if (
    normalized === 'targon'
  ) {
    return 'Targon';
  }

  return null;
}

function getTeamName(
  team: Team
) {
  return (
    team.name ??
    team.team_name ??
    'Équipe'
  );
}

function getTeamShortName(
  team: Team
) {
  if (
    team.short_name
  ) {
    return team.short_name;
  }

  if (team.tag) {
    return team.tag;
  }

  const name =
    getTeamName(team);

  const words =
    name
      .trim()
      .split(/\s+/);

  if (
    words.length >= 2
  ) {
    return words
      .map(
        (word) =>
          word[0]
      )
      .join('')
      .slice(0, 4)
      .toUpperCase();
  }

  return name
    .slice(0, 4)
    .toUpperCase();
}

function getTeamLogo(
  team: Team
) {
  return (
    team.logo ??
    team.logo_url ??
    team.image ??
    ''
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

  return `#${seed} ${getTeamShortName(
    team
  )}`;
}

/* =========================================================
   LOGO
========================================================= */

function TeamLogo({
  team,
}: {
  team: Team;
}) {
  const logo =
    getTeamLogo(team);

  return (
    <div className="resultTeamLogo">
      {logo ? (
        <img
          src={logo}
          alt={getTeamName(
            team
          )}
        />
      ) : (
        <span>
          {getTeamShortName(
            team
          ).slice(
            0,
            2
          )}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   BRACKET
========================================================= */

function BracketConnector() {
  return (
    <div className="bracketConnector">
      <div className="bracketConnectorLine" />
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
          ? 'bracketMatchHighlighted'
          : '',

        grandFinal
          ? 'bracketGrandFinal'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="bracketMatchTeam">
        <span className="bracketMiniLogo">
          ?
        </span>

        <span className="bracketTeamName">
          {team1}
        </span>

        <strong className="bracketScore">
          -
        </strong>
      </div>

      <div className="bracketMatchTeam">
        <span className="bracketMiniLogo">
          ?
        </span>

        <span className="bracketTeamName">
          {team2}
        </span>

        <strong className="bracketScore">
          -
        </strong>
      </div>
    </div>
  );
}