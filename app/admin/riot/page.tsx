
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { supabase } from '@/lib/supabase';

type Team = {
  id: number;
  name: string;
  logo: string | null;
};

type RiotGame = {
  number: number;
  status: string;
  hasRiotMatch: boolean;
  importStatus: string | null;
  importAttempts: number;
  importError: string | null;
  rosterStatus: string | null;
  rosterDetails: unknown;
  validationError: string | null;
};

type Fixture = {
  id: number;
  division: string;
  stage: string;
  bestOf: number;
  roundNumber: number | null;
  status: string;
  scheduledAt: string | null;
  team1: Team;
  team2: Team;
  games: RiotGame[];
};

type Preview = {
  completed: boolean;
  team1Score: number;
  team2Score: number;
  winnerTeamId: number | null;
  gamesPlayed: number;
  nextGameNumber: number | null;
};

type StateFilter = 'all' | 'review' | 'errors';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Reconnecte-toi avec Discord.');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

function TeamLabel({ team }: { team: Team }) {
  return (
    <div className="riotAdminTeam">
      {team.logo ? (
        <img src={team.logo} alt="" />
      ) : (
        <div className="riotAdminPlaceholder">
          {team.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <strong>{team.name}</strong>
    </div>
  );
}

function isGameIssue(game: RiotGame) {
  return Boolean(
    game.importError ||
    game.validationError ||
    game.rosterStatus === 'pending_review'
  );
}

function isReadyGame(game: RiotGame) {
  return (
    game.status === 'pending_review' &&
    game.rosterStatus === 'verified' &&
    ['fetched', 'pending_review'].includes(
      game.importStatus || ''
    ) &&
    game.hasRiotMatch
  );
}

export default function RiotAdminPage() {
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [season, setSeason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<StateFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [previews, setPreviews] = useState<
    Record<number, Preview>
  >({});

  const [brackets, setBrackets] = useState<
    Record<number, string>
  >({});

  const [rounds, setRounds] = useState<
    Record<number, string>
  >({});

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const headers = await authHeaders();

      const response = await fetch(
        '/api/admin/riot-review',
        { cache: 'no-store', headers }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error || 'Impossible de charger les BO Riot.'
        );
      }

      setFixtures(json.fixtures || []);
      setSeason(json.season || null);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur de chargement.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runPublication(
    fixture: Fixture,
    publish: boolean
  ) {
    if (busyId !== null) return;

    if (publish) {
      const preview = previews[fixture.id];

      if (!preview?.completed) {
        setError('Prévisualise un BO complet avant publication.');
        return;
      }

      const confirmed = window.confirm(
        `PUBLIER DÉFINITIVEMENT CE BO ?\n\n` +
          `${fixture.team1.name} ${preview.team1Score} - ` +
          `${preview.team2Score} ${fixture.team2.name}\n\n` +
          `Les statistiques seront visibles dans /results.`
      );

      if (!confirmed) return;
    }

    setBusyId(fixture.id);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();

      const body = {
        fixtureId: fixture.id,
        publish,
        ...(publish ? { confirm: 'PUBLIER_CZF' } : {}),
        ...(fixture.stage === 'playoff'
          ? {
              bracket: brackets[fixture.id] || '',
              round: rounds[fixture.id] || '',
            }
          : {}),
      };

      const response = await fetch(
        '/api/admin/riot-publish',
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error || 'Traitement du BO impossible.'
        );
      }

      if (publish) {
        setMessage(
          `BO publié avec succès ! Match CZF #${json.matchId}.`
        );

        setPreviews((current) => {
          const updated = { ...current };
          delete updated[fixture.id];
          return updated;
        });

        await load();
      } else {
        setPreviews((current) => ({
          ...current,
          [fixture.id]: json.bo,
        }));

        setMessage(
          json.bo.completed
            ? 'Prévisualisation terminée. Vérifie le score.'
            : 'BO incomplet : la publication reste bloquée.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur de traitement.'
      );
    } finally {
      setBusyId(null);
    }
  }

  const reviewCount = fixtures.filter((f) =>
    f.games.some(
      (g) =>
        g.status === 'pending_review' ||
        g.rosterStatus === 'pending_review'
    )
  ).length;

  const errorCount = fixtures.filter((f) =>
    f.games.some(isGameIssue)
  ).length;

  const visibleFixtures = fixtures.filter((fixture) => {
    if (filter === 'review') {
      return fixture.games.some(
        (g) => g.status === 'pending_review'
      );
    }

    if (filter === 'errors') {
      return fixture.games.some(isGameIssue);
    }

    return true;
  });

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span />
          <h2>Admin — Résultats Riot</h2>
        </div>

        <div className="riotAdminPage">
          <div className="riotAdminTop">
            <div>
              <p className="riotAdminEyebrow">
                {season || 'CZF'}
              </p>
              <h3>Suivi des BO automatiques</h3>
              <p className="riotAdminMuted">
                Vérification des imports, rosters et résultats.
                Publication après validation admin.
              </p>
            </div>

            <div className="riotAdminActions">
              <Link href="/admin" className="riotAdminButton">
                Retour admin
              </Link>

              <button
                type="button"
                className="riotAdminButton"
                onClick={() => void load()}
                disabled={loading}
              >
                Actualiser
              </button>
            </div>
          </div>

          <div className="riotAdminSummary">
            <div>
              <strong>{fixtures.length}</strong>
              <span>BO suivis</span>
            </div>
            <div>
              <strong>{reviewCount}</strong>
              <span>À vérifier</span>
            </div>
            <div>
              <strong>{errorCount}</strong>
              <span>Avec anomalie</span>
            </div>
          </div>

          <div className="riotAdminFilters">
            {(
              [
                ['all', 'Tous les BO'],
                ['review', 'En vérification'],
                ['errors', 'Anomalies'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={
                  filter === value
                    ? 'riotAdminFilter active'
                    : 'riotAdminFilter'
                }
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="riotAdminAlert error">
              {error}
            </div>
          )}

          {message && (
            <div className="riotAdminAlert success">
              {message}
            </div>
          )}

          {loading ? (
            <div className="riotAdminEmpty">
              Chargement des rencontres Riot...
            </div>
          ) : visibleFixtures.length === 0 ? (
            <div className="riotAdminEmpty">
              <strong>Aucun BO à afficher.</strong>
              <p>
                Les rencontres apparaîtront ici dès
                qu'un emplacement de game Riot sera préparé.
              </p>
            </div>
          ) : (
            <div className="riotAdminList">
              {visibleFixtures.map((fixture) => {
                const preview = previews[fixture.id];

                const allGamesReady =
                  fixture.games.length > 0 &&
                  fixture.games.every(isReadyGame);

                return (
                  <article
                    key={fixture.id}
                    className="riotAdminCard"
                  >
                    <div className="riotAdminCardHeader">
                      <strong>
                        {fixture.division} · BO{fixture.bestOf}
                      </strong>

                      <span>
                        Rencontre #{fixture.id} ·{' '}
                        {fixture.stage === 'pool'
                          ? 'Poules'
                          : 'Playoffs'}
                      </span>
                    </div>

                    <div className="riotAdminVersus">
                      <TeamLabel team={fixture.team1} />
                      <span className="riotAdminVs">VS</span>
                      <TeamLabel team={fixture.team2} />
                    </div>

                    <div className="riotAdminGames">
                      {fixture.games.map((game) => (
                        <div
                          className="riotAdminGame"
                          key={game.number}
                        >
                          <div className="riotAdminGameHeading">
                            <strong>Game {game.number}</strong>
                            <span>
                              {isReadyGame(game)
                                ? 'Roster vérifié'
                                : game.status}
                            </span>
                          </div>

                          <div className="riotAdminMuted">
                            Import :{' '}
                            {game.importStatus || 'En attente'}
                            {' · '}
                            Roster :{' '}
                            {game.rosterStatus || 'En attente'}
                          </div>

                          {game.importError && (
                            <p className="riotAdminProblem">
                              Riot : {game.importError}
                            </p>
                          )}

                          {game.validationError && (
                            <p className="riotAdminProblem">
                              Validation : {game.validationError}
                            </p>
                          )}

                          {game.rosterStatus ===
                            'pending_review' && (
                            <div className="riotAdminProblem">
                              Roster nécessitant une vérification.
                              <details>
                                <summary>Voir les détails</summary>
                                <pre>
                                  {JSON.stringify(
                                    game.rosterDetails,
                                    null,
                                    2
                                  )}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {fixture.stage === 'playoff' && (
                      <div className="riotAdminFields">
                        <label>
                          Bracket
                          <select
                            value={brackets[fixture.id] || ''}
                            onChange={(event) =>
                              setBrackets((current) => ({
                                ...current,
                                [fixture.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">
                              Sélectionner
                            </option>
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
                            value={rounds[fixture.id] || ''}
                            onChange={(event) =>
                              setRounds((current) => ({
                                ...current,
                                [fixture.id]: event.target.value,
                              }))
                            }
                            placeholder="Ex : Demi-finale"
                          />
                        </label>
                      </div>
                    )}

                    <div className="riotAdminCardActions">
                      <button
                        type="button"
                        className="riotAdminButton"
                        disabled={busyId !== null}
                        onClick={() =>
                          void runPublication(fixture, false)
                        }
                      >
                        {busyId === fixture.id
                          ? 'Vérification...'
                          : 'Prévisualiser le BO'}
                      </button>
                    </div>

                    {preview && (
                      <div className="riotAdminPreview">
                        <div className="riotAdminMuted">
                          PRÉVISUALISATION
                        </div>

                        <div className="riotAdminScore">
                          {fixture.team1.name}{' '}
                          <strong>
                            {preview.team1Score} -{' '}
                            {preview.team2Score}
                          </strong>{' '}
                          {fixture.team2.name}
                        </div>

                        <p className="riotAdminMuted">
                          {preview.completed
                            ? 'BO terminé : publication possible.'
                            : `BO incomplet — prochaine game : ${
                                preview.nextGameNumber || '-'
                              }`}
                        </p>

                        <button
                          type="button"
                          className="riotAdminPublish"
                          disabled={
                            !preview.completed ||
                            !allGamesReady ||
                            busyId !== null
                          }
                          onClick={() =>
                            void runPublication(fixture, true)
                          }
                        >
                          {busyId === fixture.id
                            ? 'Publication...'
                            : 'Confirmer et publier le BO'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <p className="riotAdminMuted">
            Aucune donnée n'est publiée automatiquement
            depuis cette page. Les imports JSON manuels
            restent disponibles dans l'administration.
          </p>
        </div>

        <style jsx global>{`
          .riotAdminPage {
            margin-top: 20px;
            padding: 22px;
            border-radius: 13px;
            background: #fff3df;
            color: #0b2740;
            border: 1px solid rgba(11, 39, 64, .15);
          }

          .riotAdminTop,
          .riotAdminCardHeader,
          .riotAdminGameHeading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          }

          .riotAdminTop h3 {
            font-size: 23px;
            margin: 5px 0;
          }

          .riotAdminEyebrow {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            color: #a96941;
          }

          .riotAdminMuted {
            font-size: 12px;
            color: #667783;
            line-height: 1.6;
          }

          .riotAdminActions,
          .riotAdminCardActions,
          .riotAdminFilters {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .riotAdminButton,
          .riotAdminFilter,
          .riotAdminPublish {
            cursor: pointer;
            border: 1px solid #0b2740;
            border-radius: 8px;
            padding: 11px 14px;
            background: #0b2740;
            color: #fff3df;
            font-family: inherit;
            font-size: 12px;
            font-weight: 900;
            text-decoration: none;
          }

          .riotAdminFilter {
            background: transparent;
            color: #0b2740;
          }

          .riotAdminFilter.active {
            background: #0b2740;
            color: #fff3df;
          }

          .riotAdminButton:disabled,
          .riotAdminPublish:disabled {
            opacity: .45;
            cursor: not-allowed;
          }

          .riotAdminSummary {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin: 22px 0;
          }

          .riotAdminSummary > div {
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-width: 120px;
            padding: 14px 18px;
            border-radius: 9px;
            background: #fffaf0;
            border: 1px solid rgba(11,39,64,.13);
          }

          .riotAdminSummary strong {
            font-size: 25px;
          }

          .riotAdminSummary span {
            font-size: 11px;
            font-weight: 800;
          }

          .riotAdminFilters {
            margin-bottom: 20px;
          }

          .riotAdminList {
            display: grid;
            gap: 16px;
          }

          .riotAdminCard {
            background: #fffaf0;
            border: 1px solid rgba(11,39,64,.16);
            border-radius: 11px;
            padding: 18px;
            min-width: 0;
          }

          .riotAdminCardHeader {
            font-size: 11px;
            color: #526575;
          }

          .riotAdminVersus {
            display: grid;
            grid-template-columns: minmax(0,1fr) 40px minmax(0,1fr);
            align-items: center;
            gap: 10px;
            margin: 20px 0;
          }

          .riotAdminTeam {
            display: flex;
            align-items: center;
            flex-direction: column;
            gap: 8px;
            text-align: center;
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .riotAdminTeam img,
          .riotAdminPlaceholder {
            width: 55px;
            height: 55px;
            object-fit: contain;
          }

          .riotAdminPlaceholder {
            display: grid;
            place-items: center;
            background: #ede1cf;
            border-radius: 8px;
          }

          .riotAdminVs {
            font-size: 21px;
            font-weight: 900;
            text-align: center;
          }

          .riotAdminGames {
            display: grid;
            gap: 9px;
          }

          .riotAdminGame {
            padding: 13px;
            background: #f3e8d7;
            border-radius: 8px;
          }

          .riotAdminGameHeading {
            font-size: 12px;
            margin-bottom: 5px;
          }

          .riotAdminProblem {
            color: #a22c2c;
            font-size: 12px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }

          .riotAdminProblem pre {
            max-height: 250px;
            overflow: auto;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font-size: 11px;
          }

          .riotAdminFields {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin: 16px 0;
          }

          .riotAdminFields label {
            display: flex;
            flex-direction: column;
            gap: 7px;
            font-size: 12px;
            font-weight: 800;
            flex: 1;
            min-width: 180px;
          }

          .riotAdminFields input,
          .riotAdminFields select {
            padding: 10px;
            border: 1px solid #0b2740;
            border-radius: 7px;
            background: #fff;
            color: #0b2740;
          }

          .riotAdminCardActions {
            margin-top: 18px;
          }

          .riotAdminPreview {
            margin-top: 16px;
            border-top: 1px solid rgba(11,39,64,.18);
            padding-top: 15px;
          }

          .riotAdminScore {
            margin: 14px 0;
            font-size: 17px;
            font-weight: 700;
          }

          .riotAdminScore strong {
            font-size: 25px;
            white-space: nowrap;
          }

          .riotAdminPublish {
            background: #386d50;
            border-color: #386d50;
            margin-top: 7px;
          }

          .riotAdminAlert,
          .riotAdminEmpty {
            padding: 18px;
            border-radius: 8px;
            margin-bottom: 15px;
          }

          .riotAdminAlert.error {
            background: #fae2df;
            color: #9d2525;
          }

          .riotAdminAlert.success {
            background: #e1f1e4;
            color: #286542;
          }

          .riotAdminEmpty {
            border: 1px dashed rgba(11,39,64,.22);
            text-align: center;
            color: #647786;
          }

          @media (max-width: 600px) {
            .riotAdminPage {
              padding: 14px;
            }
            .riotAdminVersus {
              grid-template-columns: minmax(0,1fr) 30px minmax(0,1fr);
            }
            .riotAdminTeam strong {
              font-size: 12px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
