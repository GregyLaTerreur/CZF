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

const DIVISIONS: {
  name: Division;
  color: string;
  glow: string;
}[] = [
  {
    name: 'Yordle',
    color: '#f2c94c',
    glow: 'rgba(242, 201, 76, 0.22)',
  },
  {
    name: 'Ixtal',
    color: '#25c98b',
    glow: 'rgba(37, 201, 139, 0.22)',
  },
  {
    name: 'Targon',
    color: '#7b8cff',
    glow: 'rgba(123, 140, 255, 0.22)',
  },
];

/*
  DONNÉES TEMPORAIRES

  Pour l'instant, elles servent uniquement à construire le design.
  Plus tard, elles seront récupérées automatiquement depuis la BDD.
*/
const TEAMS: Record<Division, Team[]> = {
  Yordle: [
    {
      id: 1,
      name: 'Team Alpha',
      shortName: 'ALP',
      wins: 6,
      losses: 1,
    },
    {
      id: 2,
      name: 'Team Bravo',
      shortName: 'BRV',
      wins: 5,
      losses: 2,
    },
    {
      id: 3,
      name: 'Team Cobra',
      shortName: 'CBR',
      wins: 4,
      losses: 3,
    },
    {
      id: 4,
      name: 'Team Delta',
      shortName: 'DLT',
      wins: 4,
      losses: 3,
    },
    {
      id: 5,
      name: 'Team Echo',
      shortName: 'ECH',
      wins: 3,
      losses: 4,
    },
    {
      id: 6,
      name: 'Team Frost',
      shortName: 'FST',
      wins: 3,
      losses: 4,
    },
    {
      id: 7,
      name: 'Team Ghost',
      shortName: 'GST',
      wins: 2,
      losses: 5,
    },
    {
      id: 8,
      name: 'Team Hydra',
      shortName: 'HYD',
      wins: 1,
      losses: 6,
    },
  ],

  Ixtal: [
    {
      id: 1,
      name: 'Team Jungle',
      shortName: 'JGL',
      wins: 6,
      losses: 1,
    },
    {
      id: 2,
      name: 'Team River',
      shortName: 'RVR',
      wins: 5,
      losses: 2,
    },
    {
      id: 3,
      name: 'Team Viper',
      shortName: 'VPR',
      wins: 5,
      losses: 2,
    },
    {
      id: 4,
      name: 'Team Lotus',
      shortName: 'LTS',
      wins: 4,
      losses: 3,
    },
    {
      id: 5,
      name: 'Team Storm',
      shortName: 'STM',
      wins: 3,
      losses: 4,
    },
    {
      id: 6,
      name: 'Team Jade',
      shortName: 'JDE',
      wins: 2,
      losses: 5,
    },
    {
      id: 7,
      name: 'Team Wild',
      shortName: 'WLD',
      wins: 2,
      losses: 5,
    },
    {
      id: 8,
      name: 'Team Rift',
      shortName: 'RFT',
      wins: 1,
      losses: 6,
    },
  ],

  Targon: [
    {
      id: 1,
      name: 'Team Solari',
      shortName: 'SOL',
      wins: 7,
      losses: 0,
    },
    {
      id: 2,
      name: 'Team Lunari',
      shortName: 'LUN',
      wins: 5,
      losses: 2,
    },
    {
      id: 3,
      name: 'Team Peak',
      shortName: 'PEK',
      wins: 5,
      losses: 2,
    },
    {
      id: 4,
      name: 'Team Star',
      shortName: 'STR',
      wins: 4,
      losses: 3,
    },
    {
      id: 5,
      name: 'Team Moon',
      shortName: 'MON',
      wins: 3,
      losses: 4,
    },
    {
      id: 6,
      name: 'Team Dawn',
      shortName: 'DWN',
      wins: 2,
      losses: 5,
    },
    {
      id: 7,
      name: 'Team Sky',
      shortName: 'SKY',
      wins: 1,
      losses: 6,
    },
    {
      id: 8,
      name: 'Team Celestial',
      shortName: 'CEL',
      wins: 1,
      losses: 6,
    },
  ],
};

export default function ResultsPage() {
  const [division, setDivision] = useState<Division>('Yordle');

  const currentDivision =
    DIVISIONS.find((item) => item.name === division) || DIVISIONS[0];

  const teams = [...TEAMS[division]].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });

  return (
    <>
      <Nav />

      <main className="results-page">
        {/* Éclairs très légers */}
        <div className="lightning lightning-one" />
        <div className="lightning lightning-two" />
        <div className="lightning lightning-three" />

        <div className="results-container">
          {/* HEADER */}
          <section className="header">
            <div>
              <span className="eyebrow">CZF COMPETITION</span>
              <h1>Résultats</h1>
              <p>
                Suivez le classement des divisions et l&apos;avancée des
                phases finales.
              </p>
            </div>
          </section>

          {/* DIVISIONS */}
          <section className="division-selector">
            {DIVISIONS.map((item) => {
              const active = division === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => setDivision(item.name)}
                  className={`division-button ${active ? 'active' : ''}`}
                  style={
                    {
                      '--division-color': item.color,
                      '--division-glow': item.glow,
                    } as React.CSSProperties
                  }
                >
                  <span className="division-name">{item.name}</span>

                  <span
                    className="division-status"
                    style={{ color: active ? item.color : undefined }}
                  >
                    {active ? 'Division sélectionnée' : 'Voir la division'}
                  </span>
                </button>
              );
            })}
          </section>

          {/* POULES + PLAYOFFS */}
          <section className="competition-grid">
            {/* CLASSEMENT */}
            <div
              className="panel standings-panel"
              style={
                {
                  '--division-color': currentDivision.color,
                  '--division-glow': currentDivision.glow,
                } as React.CSSProperties
              }
            >
              <div className="panel-header">
                <div>
                  <span className="panel-kicker">PHASE DE POULES</span>
                  <h2>Classement</h2>
                </div>

                <span className="division-small">{division}</span>
              </div>

              <div className="standings-head">
                <span>#</span>
                <span>Équipe</span>
                <span>V / D</span>
              </div>

              <div className="standings-list">
                {teams.map((team, index) => {
                  const qualified = index < 4;

                  return (
                    <div
                      key={team.id}
                      className={`standing-row ${
                        qualified ? 'qualified' : ''
                      }`}
                    >
                      <div className="rank">{index + 1}</div>

                      <div className="team">
                        <div className="team-logo">
                          {team.logo ? (
                            <img src={team.logo} alt={team.name} />
                          ) : (
                            <span>{team.shortName.slice(0, 2)}</span>
                          )}
                        </div>

                        <span className="team-name">{team.shortName}</span>
                      </div>

                      <div className="record">
                        <strong>{team.wins}</strong>
                        <span>—</span>
                        <strong>{team.losses}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="qualification-info">
                <span
                  className="qualification-line"
                  style={{ background: currentDivision.color }}
                />
                Top 4 qualifié pour la phase finale
              </div>
            </div>

            {/* ARBRE */}
            <div
              className="panel bracket-panel"
              style={
                {
                  '--division-color': currentDivision.color,
                  '--division-glow': currentDivision.glow,
                } as React.CSSProperties
              }
            >
              <div className="panel-header bracket-header">
                <div>
                  <span className="panel-kicker">PHASE FINALE</span>
                  <h2>Arbre des éliminations</h2>
                </div>

                <span className="live-status">
                  <span className="status-dot" />
                  En attente
                </span>
              </div>

              <div className="bracket">
                {/* DEMI-FINALES */}
                <div className="round">
                  <div className="round-title">DEMI-FINALES</div>

                  <div className="round-content semifinals">
                    <MatchCard
                      first="#1 Poule"
                      second="#4 Poule"
                      color={currentDivision.color}
                    />

                    <MatchCard
                      first="#2 Poule"
                      second="#3 Poule"
                      color={currentDivision.color}
                    />
                  </div>
                </div>

                {/* CONNECTEUR */}
                <div className="connector">
                  <div className="connector-top" />
                  <div className="connector-bottom" />
                  <div
                    className="connector-center"
                    style={{ background: currentDivision.color }}
                  />
                </div>

                {/* FINALE */}
                <div className="round final-round">
                  <div className="round-title">FINALE</div>

                  <div className="round-content final-content">
                    <MatchCard
                      first="TBD"
                      second="TBD"
                      color={currentDivision.color}
                      final
                    />
                  </div>
                </div>

                {/* CONNECTEUR */}
                <div className="champion-connector">
                  <div
                    className="champion-line"
                    style={{ background: currentDivision.color }}
                  />
                </div>

                {/* CHAMPION */}
                <div className="round champion-round">
                  <div className="round-title">CHAMPION</div>

                  <div
                    className="champion-card"
                    style={{
                      borderColor: `${currentDivision.color}55`,
                      boxShadow: `0 0 30px ${currentDivision.glow}`,
                    }}
                  >
                    <div className="champion-logo">?</div>
                    <strong>TBD</strong>
                    <span>{division}</span>
                  </div>
                </div>
              </div>

              <div className="bracket-note">
                L&apos;arbre se complètera automatiquement selon les résultats
                de la phase de poules.
              </div>
            </div>
          </section>

          {/* PLACEHOLDER PROCHAINE PARTIE */}
          <section className="next-section">
            <div>
              <span className="panel-kicker">À VENIR SUR CETTE PAGE</span>
              <h2>Historique & statistiques</h2>
            </div>

            <p>
              Les matchs joués, les performances individuelles et les
              champions les plus joués seront affichés ici.
            </p>
          </section>
        </div>

        <style jsx>{`
          .results-page {
            position: relative;
            min-height: 100vh;
            overflow: hidden;
            background:
              radial-gradient(
                circle at 50% -20%,
                rgba(35, 74, 125, 0.16),
                transparent 42%
              ),
              #050914;
            color: #ffffff;
            padding: 62px 24px 100px;
          }

          .results-container {
            position: relative;
            z-index: 2;
            width: min(1420px, 100%);
            margin: 0 auto;
          }

          /* HEADER */

          .header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 30px;
          }

          .eyebrow,
          .panel-kicker {
            display: block;
            margin-bottom: 7px;
            color: #6f819e;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.16em;
          }

          .header h1 {
            margin: 0;
            font-size: clamp(34px, 4vw, 54px);
            line-height: 1;
            letter-spacing: -0.04em;
          }

          .header p {
            margin: 12px 0 0;
            color: #8593a9;
            font-size: 14px;
          }

          /* DIVISIONS */

          .division-selector {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 18px;
          }

          .division-button {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 68px;
            overflow: hidden;
            padding: 0 21px;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 10px;
            background: rgba(10, 17, 31, 0.88);
            color: white;
            cursor: pointer;
            transition:
              transform 0.2s ease,
              background 0.2s ease,
              border-color 0.2s ease;
          }

          .division-button::after {
            content: '';
            position: absolute;
            right: 0;
            bottom: 0;
            left: 0;
            height: 2px;
            background: var(--division-color);
            opacity: 0.75;
          }

          .division-button:hover {
            transform: translateY(-2px);
            background: rgba(14, 23, 41, 0.96);
          }

          .division-button.active {
            border-color: color-mix(
              in srgb,
              var(--division-color) 30%,
              transparent
            );
            background:
              linear-gradient(
                90deg,
                var(--division-glow),
                transparent 55%
              ),
              #0a1120;
            box-shadow: 0 10px 35px rgba(0, 0, 0, 0.2);
          }

          .division-name {
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .division-status {
            color: #53627a;
            font-size: 11px;
            font-weight: 700;
          }

          /* GRID PRINCIPALE */

          .competition-grid {
            display: grid;
            grid-template-columns: minmax(270px, 0.28fr) minmax(0, 0.72fr);
            gap: 18px;
          }

          .panel {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 12px;
            background:
              linear-gradient(
                135deg,
                rgba(15, 24, 42, 0.97),
                rgba(7, 13, 25, 0.97)
              );
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2);
          }

          .panel::after {
            content: '';
            position: absolute;
            right: 0;
            bottom: 0;
            left: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              var(--division-color),
              transparent
            );
            opacity: 0.38;
          }

          .panel-header {
            min-height: 82px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 21px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.055);
          }

          .panel-header h2 {
            margin: 0;
            font-size: 18px;
            letter-spacing: -0.02em;
          }

          .panel-kicker {
            margin-bottom: 4px;
            font-size: 9px;
          }

          .division-small {
            padding: 6px 9px;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 5px;
            color: var(--division-color);
            background: var(--division-glow);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          /* CLASSEMENT */

          .standings-head,
          .standing-row {
            display: grid;
            grid-template-columns: 28px 1fr 54px;
            align-items: center;
          }

          .standings-head {
            padding: 12px 18px 8px;
            color: #526078;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }

          .standings-head span:last-child {
            text-align: right;
          }

          .standings-list {
            padding: 0 10px 10px;
          }

          .standing-row {
            position: relative;
            min-height: 50px;
            padding: 0 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.045);
          }

          .standing-row:last-child {
            border-bottom: 0;
          }

          .standing-row.qualified::before {
            content: '';
            position: absolute;
            top: 12px;
            bottom: 12px;
            left: -10px;
            width: 2px;
            border-radius: 2px;
            background: var(--division-color);
            opacity: 0.55;
          }

          .rank {
            color: #607089;
            font-size: 11px;
            font-weight: 800;
          }

          .qualified .rank {
            color: #ffffff;
          }

          .team {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .team-logo {
            width: 27px;
            height: 27px;
            flex-shrink: 0;
            display: grid;
            place-items: center;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            background: #101a2c;
            color: #75859e;
            font-size: 8px;
            font-weight: 900;
          }

          .team-logo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .team-name {
            overflow: hidden;
            color: #dce4ef;
            font-size: 12px;
            font-weight: 800;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .record {
            display: flex;
            justify-content: flex-end;
            gap: 4px;
            font-size: 11px;
          }

          .record span {
            color: #3c4960;
          }

          .qualification-info {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 12px 18px 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.045);
            color: #65738a;
            font-size: 9px;
          }

          .qualification-line {
            width: 12px;
            height: 2px;
            border-radius: 10px;
          }

          /* ARBRE */

          .bracket-panel {
            min-height: 570px;
          }

          .live-status {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #68768c;
            font-size: 10px;
            font-weight: 700;
          }

          .status-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #65758c;
          }

          .bracket {
            min-height: 410px;
            display: grid;
            grid-template-columns:
              minmax(180px, 1fr)
              55px
              minmax(180px, 1fr)
              55px
              minmax(130px, 0.7fr);
            align-items: stretch;
            padding: 25px 25px 10px;
          }

          .round {
            min-width: 0;
          }

          .round-title {
            margin-bottom: 18px;
            color: #536178;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.13em;
            text-align: center;
          }

          .round-content {
            height: 315px;
          }

          .semifinals {
            display: flex;
            flex-direction: column;
            justify-content: space-around;
          }

          .final-content,
          .champion-round {
            display: flex;
            flex-direction: column;
          }

          .final-content {
            justify-content: center;
          }

          .match-card {
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 8px;
            background: rgba(10, 17, 31, 0.94);
          }

          .match-team {
            min-height: 44px;
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 0 12px;
          }

          .match-team + .match-team {
            border-top: 1px solid rgba(255, 255, 255, 0.055);
          }

          .match-logo {
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 5px;
            background: #111b2d;
            color: #526078;
            font-size: 10px;
            font-weight: 900;
          }

          .match-team span:nth-child(2) {
            flex: 1;
            color: #cdd7e6;
            font-size: 11px;
            font-weight: 800;
          }

          .score {
            color: #64738b;
            font-size: 11px;
          }

          .connector,
          .champion-connector {
            position: relative;
            margin-top: 27px;
          }

          .connector-top,
          .connector-bottom {
            position: absolute;
            left: 0;
            width: 50%;
            height: 25%;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
          }

          .connector-top {
            top: 25%;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }

          .connector-bottom {
            bottom: 25%;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .connector-center {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 50%;
            height: 1px;
            opacity: 0.35;
          }

          .champion-line {
            position: absolute;
            top: 50%;
            right: 0;
            left: 0;
            height: 1px;
            opacity: 0.35;
          }

          .champion-round {
            justify-content: flex-start;
          }

          .champion-card {
            height: 105px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            margin-top: 105px;
            border: 1px solid;
            border-radius: 9px;
            background: rgba(10, 17, 31, 0.94);
          }

          .champion-logo {
            width: 30px;
            height: 30px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 50%;
            background: #121d31;
            color: #66758d;
            font-size: 11px;
            font-weight: 900;
          }

          .champion-card strong {
            font-size: 12px;
          }

          .champion-card span {
            color: #5d6b81;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .bracket-note {
            margin: 0 25px 20px;
            padding-top: 13px;
            border-top: 1px solid rgba(255, 255, 255, 0.045);
            color: #536178;
            font-size: 9px;
            text-align: center;
          }

          /* PROCHAINE SECTION */

          .next-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 30px;
            margin-top: 18px;
            padding: 22px 24px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 11px;
            background: rgba(9, 15, 28, 0.7);
          }

          .next-section h2 {
            margin: 0;
            font-size: 17px;
          }

          .next-section p {
            max-width: 500px;
            margin: 0;
            color: #647289;
            font-size: 11px;
            text-align: right;
          }

          /* ÉCLAIRS TRÈS DISCRETS */

          .lightning {
            position: absolute;
            z-index: 1;
            width: 1px;
            background: linear-gradient(
              transparent,
              rgba(118, 171, 255, 0.32),
              transparent
            );
            opacity: 0.22;
            pointer-events: none;
            filter: blur(0.2px);
            transform: rotate(25deg);
          }

          .lightning::before,
          .lightning::after {
            content: '';
            position: absolute;
            width: 1px;
            background: inherit;
          }

          .lightning-one {
            top: 145px;
            right: 6%;
            height: 170px;
          }

          .lightning-one::before {
            top: 55px;
            left: -19px;
            height: 58px;
            transform: rotate(42deg);
          }

          .lightning-two {
            top: 590px;
            left: 3%;
            height: 120px;
            opacity: 0.13;
            transform: rotate(-31deg);
          }

          .lightning-two::before {
            top: 40px;
            left: 15px;
            height: 40px;
            transform: rotate(-40deg);
          }

          .lightning-three {
            right: 18%;
            bottom: 45px;
            height: 100px;
            opacity: 0.1;
            transform: rotate(38deg);
          }

          /* RESPONSIVE */

          @media (max-width: 1050px) {
            .competition-grid {
              grid-template-columns: 1fr;
            }

            .bracket-panel {
              min-height: auto;
            }
          }

          @media (max-width: 800px) {
            .results-page {
              padding: 40px 14px 70px;
            }

            .division-selector {
              grid-template-columns: 1fr;
            }

            .division-button {
              min-height: 58px;
            }

            .bracket {
              overflow-x: auto;
              grid-template-columns: 210px 45px 210px 45px 150px;
              padding-right: 18px;
              padding-left: 18px;
            }

            .next-section {
              align-items: flex-start;
              flex-direction: column;
            }

            .next-section p {
              text-align: left;
            }
          }

          @media (max-width: 500px) {
            .header h1 {
              font-size: 38px;
            }

            .header p {
              font-size: 12px;
            }

            .division-status {
              display: none;
            }

            .panel-header {
              padding: 0 16px;
            }
          }
        `}</style>
      </main>
    </>
  );
}

function MatchCard({
  first,
  second,
  color,
  final = false,
}: {
  first: string;
  second: string;
  color: string;
  final?: boolean;
}) {
  return (
    <div
      className="match-card"
      style={
        final
          ? {
              borderColor: `${color}33`,
            }
          : undefined
      }
    >
      <div className="match-team">
        <span className="match-logo">?</span>
        <span>{first}</span>
        <strong className="score">—</strong>
      </div>

      <div className="match-team">
        <span className="match-logo">?</span>
        <span>{second}</span>
        <strong className="score">—</strong>
      </div>
    </div>
  );
}