
'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../components/Nav';

type Team = {
  id: number;
  name: string;
  tag?: string | null;
  logo: string | null;
};

type PlanningMatch = {
  id: number;
  division: string;
  stage: string;
  bestOf: number;
  roundNumber: number | null;
  scheduledAt: string;
  team1: Team;
  team2: Team;
};

type DivisionFilter = 'Toutes' | 'Yordle' | 'Ixtal' | 'Targon';

const FILTERS: DivisionFilter[] = [
  'Toutes',
  'Yordle',
  'Ixtal',
  'Targon',
];

function dateKey(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateTitle(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function dateDay(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
  }).format(new Date(value));
}

function dateMonth(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    month: 'short',
  })
    .format(new Date(value))
    .replace('.', '')
    .toUpperCase();
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function TeamView({ team }: { team: Team }) {
  return (
    <div className="planningTeam">
      <div className="planningLogo">
        {team.logo ? (
          <img
            src={team.logo}
            alt={team.name}
            style={{
              display: 'block',
              width: 54,
              height: 54,
              maxWidth: 54,
              maxHeight: 54,
              objectFit: 'contain',
            }}
          />
        ) : (
          <span>
            {team.tag || team.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <strong>{team.name}</strong>
    </div>
  );
}

export default function PlanningPage() {
  const [matches, setMatches] = useState<PlanningMatch[]>([]);
  const [season, setSeason] = useState<string | null>(null);
  const [filter, setFilter] =
    useState<DivisionFilter>('Toutes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load(showLoading = false) {
      if (showLoading) setLoading(true);

      try {
        const response = await fetch('/api/planning', {
          cache: 'no-store',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || 'Impossible de charger le planning.'
          );
        }

        if (!mounted) return;

        setMatches(
          Array.isArray(result.matches) ? result.matches : []
        );
        setSeason(result.season || null);
        setError('');
      } catch (err) {
        if (!mounted) return;

        setError(
          err instanceof Error
            ? err.message
            : 'Erreur de chargement.'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load(true);

    // On consulte uniquement notre API CZF,
    // pas directement l'API Riot.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(false);
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    return matches
      .filter(
        (match) =>
          filter === 'Toutes' || match.division === filter
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
      );
  }, [matches, filter]);

  const groups = useMemo(() => {
    const grouped = new Map<string, PlanningMatch[]>();

    for (const match of filtered) {
      const key = dateKey(match.scheduledAt);

      if (!grouped.has(key)) grouped.set(key, []);

      grouped.get(key)!.push(match);
    }

    return [...grouped.entries()].map(([key, items]) => ({
      key,
      title: dateTitle(items[0].scheduledAt),
      matches: items,
    }));
  }, [filtered]);

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span />
          <h2>Planning CZF</h2>
        </div>

        <section className="planningPage">
          <div className="planningIntro">
            <div>
              <p className="planningEyebrow">
                {season || 'CLASH DES ZÉROS DE LA FAILLE'}
              </p>
              <h3>Matchs programmés</h3>
              <p className="planningDescription">
                Retrouvez ici uniquement les rencontres dont
                la date a été confirmée par un capitaine.
                Les reports sont mis à jour automatiquement.
              </p>
            </div>

            <span className="planningCount">
              {filtered.length} MATCH
              {filtered.length > 1 ? 'S' : ''}
            </span>
          </div>

          <div className="planningFilters">
            {FILTERS.map((division) => (
              <button
                key={division}
                type="button"
                className={
                  filter === division
                    ? 'planningFilter planningFilterActive'
                    : 'planningFilter'
                }
                onClick={() => setFilter(division)}
              >
                {division === 'Toutes'
                  ? 'Toutes les divisions'
                  : division}
              </button>
            ))}
          </div>

          {error && (
            <div className="planningError">{error}</div>
          )}

          {loading ? (
            <div className="planningEmpty">
              Chargement du planning...
            </div>
          ) : groups.length === 0 ? (
            <div className="planningEmpty">
              <strong>Aucun match programmé pour le moment.</strong>
              <p>
                Dès qu'un capitaine enregistre une date dans
                « Mon équipe », la rencontre apparaît ici.
              </p>
            </div>
          ) : (
            <div className="planningGroups">
              {groups.map((group) => (
                <section
                  className="planningDayGroup"
                  key={group.key}
                >
                  <h4 className="planningDayHeading">
                    {group.title}
                  </h4>

                  <div className="planningGrid">
                    {group.matches.map((match) => (
                      <article
                        className="planningCard"
                        key={match.id}
                      >
                        <div className="planningCardHeader">
                          <span>
                            {match.stage === 'pool'
                              ? 'PHASE DE POULES'
                              : 'PLAYOFFS'}
                            {' · '}
                            BO{match.bestOf}
                          </span>

                          <span className="planningStatus">
                            PROGRAMMÉ
                          </span>
                        </div>

                        <div className="planningDateRow">
                          <div className="planningDateBox">
                            <strong>
                              {dateDay(match.scheduledAt)}
                            </strong>
                            <span>
                              {dateMonth(match.scheduledAt)}
                            </span>
                          </div>

                          <div className="planningTimeInfo">
                            <strong>
                              {dateTime(match.scheduledAt)}
                            </strong>
                            <span>Heure de Paris</span>
                          </div>

                          <span className="planningDivision">
                            {match.division}
                          </span>
                        </div>

                        <div className="planningVersus">
                          <TeamView team={match.team1} />
                          <strong className="planningVs">
                            VS
                          </strong>
                          <TeamView team={match.team2} />
                        </div>

                        <div className="planningCardFooter">
                          <span>
                            CZF · {match.division}
                          </span>

                          <span>
                            BO{match.bestOf}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <style jsx global>{`
          .planningPage {
            margin-top: 20px;
            padding: 25px;
            border: 1px solid rgba(9, 42, 63, 0.22);
            border-radius: 14px;
            background: #fff3df;
            color: #092a3f;
          }

          .planningIntro {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 18px;
            margin-bottom: 22px;
          }

          .planningEyebrow {
            margin: 0 0 6px;
            color: #aa673c;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .planningIntro h3 {
            margin: 0;
            font-size: 27px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .planningDescription {
            max-width: 720px;
            margin: 10px 0 0;
            color: #637482;
            font-size: 13px;
            line-height: 1.6;
          }

          .planningCount {
            padding: 10px 13px;
            border-radius: 8px;
            background: rgba(9, 42, 63, 0.08);
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .planningFilters {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
            margin-bottom: 27px;
          }

          .planningFilter {
            border: 1px solid rgba(9, 42, 63, 0.19);
            border-radius: 8px;
            background: #fffbf3;
            color: #092a3f;
            padding: 11px 15px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 900;
          }

          .planningFilterActive {
            background: #092a3f;
            color: #fff4e1;
          }

          .planningDayGroup {
            margin-bottom: 28px;
          }

          .planningDayHeading {
            margin: 0 0 13px;
            font-size: 16px;
            font-weight: 900;
            text-transform: capitalize;
            color: #092a3f;
          }

          .planningGrid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .planningCard {
            min-width: 0;
            padding: 17px;
            border: 1px solid rgba(9, 42, 63, 0.17);
            border-radius: 11px;
            background: #fffbf3;
            overflow: hidden;
          }

          .planningCardHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            color: #657481;
            font-size: 10px;
            font-weight: 900;
          }

          .planningStatus {
            padding: 7px 10px;
            border-radius: 6px;
            background: #e4eaf5;
            color: #355e99;
          }

          .planningDateRow {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 18px;
          }

          .planningDateBox {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 0 0 61px;
            height: 64px;
            border-radius: 9px;
            background: #f3e1be;
          }

          .planningDateBox strong {
            font-size: 24px;
            line-height: 1.1;
          }

          .planningDateBox span {
            font-size: 10px;
            font-weight: 900;
          }

          .planningTimeInfo {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
          }

          .planningTimeInfo strong {
            font-size: 23px;
            color: #092a3f;
          }

          .planningTimeInfo span {
            font-size: 11px;
            color: #71818c;
          }

          .planningDivision {
            margin-left: auto;
            padding: 7px 10px;
            border-radius: 6px;
            background: #f1e8db;
            font-size: 11px;
            font-weight: 900;
          }

          .planningVersus {
            display: grid !important;
            grid-template-columns:
              minmax(0, 1fr)
              52px
              minmax(0, 1fr) !important;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            padding: 20px 0;
          }

          .planningTeam {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 9px;
            min-width: 0;
            text-align: center;
          }

          .planningLogo {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 56px !important;
            height: 56px !important;
            min-width: 56px !important;
            max-width: 56px !important;
            min-height: 56px !important;
            max-height: 56px !important;
            overflow: hidden;
            background: #f8edd9;
            border: 1px solid rgba(9, 42, 63, 0.12);
            border-radius: 9px;
          }

          .planningLogo img {
            width: 54px !important;
            height: 54px !important;
            max-width: 54px !important;
            max-height: 54px !important;
            object-fit: contain !important;
          }

          .planningTeam strong {
            max-width: 100%;
            font-size: 13px;
            line-height: 1.3;
            overflow-wrap: anywhere;
          }

          .planningVs {
            font-size: 22px;
            text-align: center;
          }

          .planningCardFooter {
            display: flex;
            justify-content: space-between;
            padding-top: 12px;
            border-top: 1px solid rgba(9, 42, 63, 0.1);
            color: #71818c;
            font-size: 11px;
            font-weight: 900;
          }

          .planningEmpty {
            padding: 45px 20px;
            border: 1px dashed rgba(9, 42, 63, 0.22);
            border-radius: 10px;
            text-align: center;
            color: #657481;
          }

          .planningEmpty p {
            margin-bottom: 0;
            font-size: 12px;
          }

          .planningError {
            margin-bottom: 15px;
            padding: 12px;
            border-radius: 8px;
            background: #f7ded8;
            color: #a73535;
            font-weight: 800;
          }

          @media (max-width: 900px) {
            .planningGrid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 480px) {
            .planningPage {
              padding: 15px;
            }

            .planningIntro h3 {
              font-size: 22px;
            }

            .planningVersus {
              grid-template-columns:
                minmax(0, 1fr)
                40px
                minmax(0, 1fr) !important;
              gap: 6px;
            }

            .planningVs {
              font-size: 18px;
            }

            .planningTeam strong {
              font-size: 11px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
