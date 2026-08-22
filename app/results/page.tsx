'use client';

import { useState } from 'react';
import Nav from '../components/Nav';

type Division = 'Yordle' | 'Ixtal' | 'Targon';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logo?: string;
  wins: number;
  losses: number;
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
    soft: 'rgba(81, 166, 119, 0.10)',
  },
  {
    name: 'Ixtal',
    color: '#4387d8',
    soft: 'rgba(67, 135, 216, 0.10)',
  },
  {
    name: 'Targon',
    color: '#8f6bc7',
    soft: 'rgba(143, 107, 199, 0.10)',
  },
];

/*
  DONNÉES TEMPORAIRES
  -------------------
  Elles servent seulement à voir le rendu.

  Plus tard :
  - les équipes viendront de la BDD
  - les V / D se mettront à jour automatiquement
  - le bracket se remplira automatiquement
*/
const TEAMS: Record<Division, Team[]> = {
  Yordle: [
    { id: 1, name: 'Team Alpha', shortName: 'ALP', wins: 8, losses: 1 },
    { id: 2, name: 'Team Bravo', shortName: 'BRV', wins: 7, losses: 2 },
    { id: 3, name: 'Team Cobra', shortName: 'CBR', wins: 6, losses: 3 },
    { id: 4, name: 'Team Delta', shortName: 'DLT', wins: 6, losses: 3 },
    { id: 5, name: 'Team Echo', shortName: 'ECH', wins: 5, losses: 4 },
    { id: 6, name: 'Team Frost', shortName: 'FST', wins: 4, losses: 5 },
    { id: 7, name: 'Team Ghost', shortName: 'GST', wins: 3, losses: 6 },
    { id: 8, name: 'Team Hydra', shortName: 'HYD', wins: 3, losses: 6 },
    { id: 9, name: 'Team Ivory', shortName: 'IVY', wins: 2, losses: 7 },
    { id: 10, name: 'Team Jinx', shortName: 'JNX', wins: 1, losses: 8 },
  ],

  Ixtal: [
    { id: 1, name: 'Team Jungle', shortName: 'JGL', wins: 8, losses: 1 },
    { id: 2, name: 'Team River', shortName: 'RVR', wins: 7, losses: 2 },
    { id: 3, name: 'Team Viper', shortName: 'VPR', wins: 7, losses: 2 },
    { id: 4, name: 'Team Lotus', shortName: 'LTS', wins: 5, losses: 4 },
    { id: 5, name: 'Team Storm', shortName: 'STM', wins: 5, losses: 4 },
    { id: 6, name: 'Team Jade', shortName: 'JDE', wins: 4, losses: 5 },
    { id: 7, name: 'Team Wild', shortName: 'WLD', wins: 3, losses: 6 },
    { id: 8, name: 'Team Rift', shortName: 'RFT', wins: 3, losses: 6 },
    { id: 9, name: 'Team Bloom', shortName: 'BLM', wins: 2, losses: 7 },
    { id: 10, name: 'Team Root', shortName: 'ROT', wins: 1, losses: 8 },
  ],

  Targon: [
    { id: 1, name: 'Team Solari', shortName: 'SOL', wins: 9, losses: 0 },
    { id: 2, name: 'Team Lunari', shortName: 'LUN', wins: 7, losses: 2 },
    { id: 3, name: 'Team Peak', shortName: 'PEK', wins: 6, losses: 3 },
    { id: 4, name: 'Team Star', shortName: 'STR', wins: 6, losses: 3 },
    { id: 5, name: 'Team Moon', shortName: 'MON', wins: 5, losses: 4 },
    { id: 6, name: 'Team Dawn', shortName: 'DWN', wins: 4, losses: 5 },
    { id: 7, name: 'Team Sky', shortName: 'SKY', wins: 3, losses: 6 },
    { id: 8, name: 'Team Celestial', shortName: 'CEL', wins: 3, losses: 6 },
    { id: 9, name: 'Team Zenith', shortName: 'ZEN', wins: 1, losses: 8 },
    { id: 10, name: 'Team Comet', shortName: 'CMT', wins: 1, losses: 8 },
  ],
};

export default function ResultsPage() {
  const [division, setDivision] = useState<Division>('Yordle');

  const divisionConfig =
    DIVISIONS.find((item) => item.name === division) ?? DIVISIONS[0];

  const teams = [...TEAMS[division]].sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return a.losses - b.losses;
  });

  return (
    <>
      <Nav />

      <main
        className="resultsPage section"
        style={
          {
            '--division-color': divisionConfig.color,
            '--division-soft': divisionConfig.soft,
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
          <div>
            <p className="resultsEyebrow">COMPÉTITION CZF</p>
            <h2>Résultats</h2>
          </div>
        </div>

        <p className="resultsIntro">
          Classements, phases finales et statistiques de chaque division.
        </p>

        {/* DIVISIONS */}
        <div className="divisionTabs">
          {DIVISIONS.map((item) => {
            const active = division === item.name;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setDivision(item.name)}
                className={`divisionTab ${
                  active ? 'divisionTabActive' : ''
                }`}
                style={
                  {
                    '--tab-color': item.color,
                    '--tab-soft': item.soft,
                  } as React.CSSProperties
                }
              >
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* POULE + BRACKET */}
        <div className="resultsMainGrid">
          {/* CLASSEMENT */}
          <section className="resultsCard standingsCard">
            <div className="resultsCardHeader">
              <div>
                <p className="cardEyebrow">PHASE DE POULE</p>
                <h3>Classement</h3>
              </div>

              <div className="divisionBadge">{division}</div>
            </div>

            <div className="standingHeader">
              <span>#</span>
              <span>Équipe</span>
              <span>V / D</span>
            </div>

            <div className="standingRows">
              {teams.map((team, index) => {
                const qualified = index < 8;
                const eliminated = index >= 8;

                return (
                  <div
                    key={team.id}
                    className={`standingRow ${
                      qualified ? 'standingQualified' : ''
                    } ${
                      eliminated ? 'standingEliminated' : ''
                    }`}
                  >
                    <div className="standingRank">
                      {index + 1}
                    </div>

                    <div className="standingTeam">
                      <TeamLogo team={team} />

                      <span>{team.shortName}</span>
                    </div>

                    <div className="standingScore">
                      <strong>{team.wins}</strong>

                      <span>-</span>

                      <strong>{team.losses}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="standingsLegend">
              <div>
                <span className="legendQualified" />
                Top 8 qualifié
              </div>

              <div>
                <span className="legendEliminated" />
                Éliminé
              </div>
            </div>
          </section>

          {/* DOUBLE ELIMINATION */}
          <section className="resultsCard bracketCard">
            <div className="resultsCardHeader">
              <div>
                <p className="cardEyebrow">PHASE FINALE</p>
                <h3>Double élimination</h3>
              </div>

              <div className="bracketInfo">
                TOP 8
              </div>
            </div>

            <div className="bracketScroll">
              {/* WINNER BRACKET */}
              <div className="bracketSection">
                <div className="bracketSectionTitle">
                  <span />
                  WINNER BRACKET
                </div>

                <div className="winnerBracket">
                  {/* QUARTS */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Quarts de finale
                    </BracketColumnTitle>

                    <div className="matchStack quarterStack">
                      <BracketMatch
                        team1="#1"
                        team2="#8"
                      />

                      <BracketMatch
                        team1="#4"
                        team2="#5"
                      />

                      <BracketMatch
                        team1="#2"
                        team2="#7"
                      />

                      <BracketMatch
                        team1="#3"
                        team2="#6"
                      />
                    </div>
                  </div>

                  <BracketArrowColumn />

                  {/* DEMIS */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Demi-finales
                    </BracketColumnTitle>

                    <div className="matchStack semiStack">
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

                  <BracketArrowColumn />

                  {/* WINNER FINAL */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Finale Winner
                    </BracketColumnTitle>

                    <div className="matchStack finalStack">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                        highlighted
                      />
                    </div>
                  </div>

                  <BracketArrowColumn />

                  {/* GRANDE FINALE */}
                  <div className="bracketColumn grandFinalColumn">
                    <BracketColumnTitle>
                      Grande finale
                    </BracketColumnTitle>

                    <div className="matchStack finalStack">
                      <BracketMatch
                        team1="Winner WB"
                        team2="Winner LB"
                        grandFinal
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* LOSER BRACKET */}
              <div className="bracketSection loserSection">
                <div className="bracketSectionTitle loserTitle">
                  <span />
                  LOSER BRACKET
                </div>

                <p className="loserDescription">
                  Une défaite en Winner Bracket envoie
                  l&apos;équipe ici. Une nouvelle défaite
                  l&apos;élimine définitivement.
                </p>

                <div className="loserBracket">
                  {/* ROUND 1 */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Loser Round 1
                    </BracketColumnTitle>

                    <div className="matchStack loserTwoStack">
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

                  <BracketArrowColumn />

                  {/* ROUND 2 */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Loser Round 2
                    </BracketColumnTitle>

                    <div className="matchStack loserTwoStack">
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

                  <BracketArrowColumn />

                  {/* ROUND 3 */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Loser Round 3
                    </BracketColumnTitle>

                    <div className="matchStack finalStack">
                      <BracketMatch
                        team1="TBD"
                        team2="TBD"
                      />
                    </div>
                  </div>

                  <BracketArrowColumn />

                  {/* LOSER FINAL */}
                  <div className="bracketColumn">
                    <BracketColumnTitle>
                      Finale Loser
                    </BracketColumnTitle>

                    <div className="matchStack finalStack">
                      <BracketMatch
                        team1="TBD"
                        team2="Loser WB"
                        highlighted
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bracketFootnote">
                Les équipes seront remplacées automatiquement
                au fur et à mesure de l&apos;avancement du
                tournoi.
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

              <h3>Historique des matchs</h3>
            </div>
          </div>

          <div className="historyEmpty">
            <strong>Aucun match enregistré</strong>

            <span>
              Les matchs passés de la division {division}
              apparaîtront ici.
            </span>
          </div>
        </section>

        {/* STATS JOUEURS */}
        <section className="resultsCard statsPreviewCard">
          <div className="resultsCardHeader">
            <div>
              <p className="cardEyebrow">
                PERFORMANCES
              </p>

              <h3>Statistiques des joueurs</h3>
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
            KDA, kills, assists, gold, DPM, CS/min et MVP
            seront ajoutés ici dans la prochaine étape.
          </p>
        </section>

        <style jsx>{`
          .resultsPage {
            position: relative;
            min-height: calc(100vh - 78px);
            overflow: visible;
          }

          .resultsTitle {
            margin-bottom: 4px;
          }

          .resultsTitle > div {
            display: flex;
            align-items: baseline;
            gap: 16px;
            flex-wrap: wrap;
          }

          .resultsEyebrow {
            margin: 0;
            color: var(--orange);
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.12em;
          }

          .resultsIntro {
            position: relative;
            z-index: 10;
            margin: 0 0 28px 56px;
            color: var(--muted);
            font-size: 15px;
            font-weight: 600;
          }

          /* =========================
             ÉCLAIRS
          ========================= */

          .resultBolt {
            position: absolute;
            z-index: 8;
            object-fit: contain;
            pointer-events: none;
            user-select: none;
          }

          .resultBoltOne {
            width: 150px;
            left: -55px;
            top: 235px;
            opacity: 0.45;
            transform: rotate(-13deg);
          }

          .resultBoltTwo {
            width: 130px;
            right: -45px;
            top: 650px;
            opacity: 0.4;
            transform: rotate(15deg);
          }

          .resultBoltThree {
            width: 155px;
            left: 8%;
            bottom: 100px;
            opacity: 0.25;
            transform: rotate(-9deg);
          }

          /* =========================
             DIVISIONS
          ========================= */

          .divisionTabs {
            position: relative;
            z-index: 12;

            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));

            gap: 14px;

            margin-bottom: 20px;
          }

          .divisionTab {
            position: relative;

            min-height: 68px;

            border:
              1.4px solid
              rgba(9, 42, 63, 0.52);

            border-radius: 11px;

            overflow: hidden;

            background:
              rgba(255, 246, 229, 0.78);

            color: var(--navy);

            font-size: 15px;
            font-weight: 900;

            letter-spacing: 0.07em;

            box-shadow:
              0 8px 20px
              rgba(8, 24, 36, 0.04);

            transition:
              transform 0.17s ease,
              background 0.17s ease,
              box-shadow 0.17s ease;
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

          .divisionTab:hover {
            background:
              rgba(255, 250, 240, 0.96);

            box-shadow:
              0 11px 25px
              rgba(8, 24, 36, 0.08);
          }

          .divisionTabActive {
            background:
              linear-gradient(
                135deg,
                var(--tab-soft),
                rgba(255, 250, 240, 0.94)
              );

            border-color:
              var(--tab-color);

            box-shadow:
              0 11px 25px
              rgba(8, 24, 36, 0.08);
          }

          /* =========================
             CARTES
          ========================= */

          .resultsMainGrid {
            position: relative;
            z-index: 10;

            display: grid;

            grid-template-columns:
              minmax(245px, 0.22fr)
              minmax(0, 0.78fr);

            gap: 18px;

            align-items: stretch;
          }

          .resultsCard {
            position: relative;
            z-index: 10;

            border:
              1.3px solid
              rgba(9, 42, 63, 0.7);

            border-radius: 14px;

            background:
              rgba(255, 246, 229, 0.84);

            box-shadow:
              0 12px 30px
              rgba(8, 24, 36, 0.055);

            overflow: hidden;
          }

          .resultsCardHeader {
            min-height: 83px;

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

            font-family: var(--font-display);

            font-size: 25px;

            text-transform: uppercase;

            letter-spacing: 0.02em;
          }

          .cardEyebrow {
            margin: 0 0 3px;

            color: var(--orange);

            font-size: 9px;
            font-weight: 900;

            letter-spacing: 0.14em;
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

            letter-spacing: 0.08em;

            text-transform: uppercase;
          }

          /* =========================
             CLASSEMENT
          ========================= */

          .standingsCard {
            min-width: 0;
          }

          .standingHeader,
          .standingRow {
            display: grid;

            grid-template-columns:
              25px
              minmax(0, 1fr)
              54px;

            align-items: center;

            gap: 6px;
          }

          .standingHeader {
            padding:
              12px
              15px
              8px;

            color:
              rgba(7, 29, 45, 0.48);

            font-size: 9px;
            font-weight: 900;

            text-transform: uppercase;

            letter-spacing: 0.07em;
          }

          .standingHeader span:last-child {
            text-align: right;
          }

          .standingRows {
            padding: 0 8px 10px;
          }

          .standingRow {
            position: relative;

            min-height: 49px;

            padding: 0 7px;

            border-bottom:
              1px solid
              rgba(9, 42, 63, 0.08);
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

            border-radius: 0 3px 3px 0;

            background:
              var(--division-color);
          }

          .standingEliminated {
            opacity: 0.47;
          }

          .standingEliminated::before {
            content: '';

            position: absolute;

            left: -8px;
            top: 11px;
            bottom: 11px;

            width: 3px;

            border-radius: 0 3px 3px 0;

            background:
              #8d3535;
          }

          .standingRank {
            color:
              rgba(7, 29, 45, 0.55);

            font-size: 11px;
            font-weight: 900;
          }

          .standingTeam {
            min-width: 0;

            display: flex;
            align-items: center;

            gap: 8px;
          }

          .standingTeam span {
            overflow: hidden;

            color: var(--navy);

            font-size: 11px;
            font-weight: 900;

            text-overflow: ellipsis;

            white-space: nowrap;
          }

          .standingScore {
            display: flex;
            justify-content: flex-end;

            gap: 4px;

            color: var(--navy);

            font-size: 11px;
          }

          .standingScore span {
            opacity: 0.35;
          }

          .standingsLegend {
            display: flex;
            flex-direction: column;

            gap: 7px;

            padding: 14px 17px 17px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.09);

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
              var(--division-color);
          }

          .legendEliminated {
            background: #8d3535;
          }

          /* =========================
             TEAM LOGO
          ========================= */

          :global(.resultTeamLogo) {
            width: 28px;
            height: 28px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.18);

            border-radius: 6px;

            background:
              rgba(255, 255, 255, 0.55);

            color: var(--navy);

            font-size: 8px;
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

          .bracketCard {
            min-width: 0;
          }

          .bracketScroll {
            overflow-x: auto;

            padding: 20px 20px 18px;
          }

          .bracketSection {
            min-width: 930px;
          }

          .bracketSection + .bracketSection {
            margin-top: 29px;

            padding-top: 24px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.12);
          }

          .bracketSectionTitle {
            display: flex;
            align-items: center;

            gap: 8px;

            margin-bottom: 18px;

            color: var(--navy);

            font-size: 10px;
            font-weight: 900;

            letter-spacing: 0.12em;
          }

          .bracketSectionTitle span {
            width: 26px;
            height: 3px;

            background:
              var(--division-color);
          }

          .loserTitle span {
            background: var(--orange);
          }

          .winnerBracket,
          .loserBracket {
            display: grid;

            grid-template-columns:
              minmax(150px, 1fr)
              32px
              minmax(150px, 1fr)
              32px
              minmax(150px, 1fr)
              32px
              minmax(150px, 1fr);

            align-items: stretch;

            gap: 0;
          }

          .bracketColumn {
            min-width: 0;
          }

          :global(.bracketColumnTitle) {
            min-height: 20px;

            margin-bottom: 12px;

            color:
              rgba(7, 29, 45, 0.48);

            font-size: 8px;
            font-weight: 900;

            text-align: center;

            text-transform: uppercase;

            letter-spacing: 0.08em;
          }

          .matchStack {
            min-height: 370px;

            display: flex;
            flex-direction: column;
          }

          .quarterStack {
            justify-content: space-between;
          }

          .semiStack {
            justify-content: space-around;

            padding:
              44px
              0;
          }

          .finalStack {
            justify-content: center;
          }

          .loserTwoStack {
            justify-content: space-around;

            padding:
              44px
              0;
          }

          :global(.bracketMatch) {
            position: relative;

            overflow: hidden;

            border:
              1px solid
              rgba(9, 42, 63, 0.27);

            border-radius: 7px;

            background:
              rgba(255, 250, 241, 0.82);

            box-shadow:
              0 5px 12px
              rgba(8, 24, 36, 0.035);
          }

          :global(.bracketMatchHighlighted) {
            border-color:
              var(--division-color);
          }

          :global(.bracketGrandFinal) {
            border:
              1.5px solid
              var(--division-color);

            box-shadow:
              0 8px 20px
              var(--division-soft);
          }

          :global(.bracketMatchTeam) {
            min-height: 38px;

            display: flex;
            align-items: center;

            gap: 7px;

            padding: 0 9px;
          }

          :global(.bracketMatchTeam + .bracketMatchTeam) {
            border-top:
              1px solid
              rgba(9, 42, 63, 0.10);
          }

          :global(.bracketMiniLogo) {
            width: 21px;
            height: 21px;

            flex-shrink: 0;

            display: grid;
            place-items: center;

            border:
              1px solid
              rgba(9, 42, 63, 0.15);

            border-radius: 5px;

            background:
              rgba(255, 255, 255, 0.65);

            color:
              rgba(7, 29, 45, 0.4);

            font-size: 8px;
            font-weight: 900;
          }

          :global(.bracketTeamName) {
            flex: 1;

            min-width: 0;

            overflow: hidden;

            color: var(--navy);

            font-size: 9px;
            font-weight: 900;

            white-space: nowrap;

            text-overflow: ellipsis;
          }

          :global(.bracketScore) {
            color:
              rgba(7, 29, 45, 0.42);

            font-size: 10px;
          }

          :global(.bracketArrowColumn) {
            position: relative;

            display: flex;
            align-items: center;
            justify-content: center;

            padding-top: 20px;
          }

          :global(.bracketArrow) {
            position: relative;

            width: 18px;
            height: 1px;

            background:
              rgba(9, 42, 63, 0.22);
          }

          :global(.bracketArrow::after) {
            content: '';

            position: absolute;

            right: -1px;
            top: -3px;

            width: 6px;
            height: 6px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.35);

            border-right:
              1px solid
              rgba(9, 42, 63, 0.35);

            transform: rotate(45deg);
          }

          .loserDescription {
            margin:
              -8px
              0
              15px;

            color: var(--muted);

            font-size: 10px;
            font-weight: 600;
          }

          .bracketFootnote {
            margin-top: 20px;

            padding-top: 13px;

            border-top:
              1px solid
              rgba(9, 42, 63, 0.09);

            color: var(--muted);

            font-size: 9px;
            font-weight: 700;

            text-align: center;
          }

          /* =========================
             HISTORIQUE
          ========================= */

          .historyCard,
          .statsPreviewCard {
            margin-top: 18px;
          }

          .historyEmpty {
            display: flex;
            flex-direction: column;

            align-items: center;
            justify-content: center;

            gap: 6px;

            min-height: 125px;

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

          /* =========================
             STATS PREVIEW
          ========================= */

          .statsPreview {
            display: grid;

            grid-template-columns:
              repeat(5, minmax(0, 1fr));

            gap: 10px;

            padding: 20px 20px 10px;
          }

          .rolePreview {
            min-height: 48px;

            display: flex;
            align-items: center;
            justify-content: center;

            border:
              1px solid
              rgba(9, 42, 63, 0.25);

            border-radius: 8px;

            background:
              rgba(255, 250, 241, 0.62);

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

          /* =========================
             RESPONSIVE
          ========================= */

          @media (max-width: 1100px) {
            .resultsMainGrid {
              grid-template-columns: 1fr;
            }

            .standingsCard {
              max-width: none;
            }
          }

          @media (max-width: 750px) {
            .divisionTabs {
              grid-template-columns: 1fr;
            }

            .divisionTab {
              min-height: 57px;
            }

            .resultsIntro {
              margin-left: 0;
            }

            .statsPreview {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .resultBolt {
              opacity: 0.18;
            }
          }

          @media (max-width: 500px) {
            .resultsCardHeader {
              align-items: flex-start;

              flex-direction: column;
            }

            .statsPreview {
              grid-template-columns: 1fr;
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

function BracketColumnTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bracketColumnTitle">
      {children}
    </div>
  );
}

function BracketArrowColumn() {
  return (
    <div className="bracketArrowColumn">
      <div className="bracketArrow" />
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