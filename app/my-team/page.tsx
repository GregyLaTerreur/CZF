
'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

type FixtureTeam = {
  id: number;
  name: string;
  logo: string | null;
  score: number | null;
};

type Fixture = {
  id: number;
  division: string;
  stage: string;
  roundNumber: number | null;
  bestOf: number;
  scheduledAt: string | null;
  status: string;
  matchId: number | null;
  team1: FixtureTeam;
  team2: FixtureTeam;
};

type Season = {
  id: number;
  name: string;
  status: string;
};

type GameSlot = {
  id: number;
  fixtureId: number;
  gameNumber: number;
  status: string;
  hasCode?: boolean;
  hasRiotMatch?: boolean;
  needsReview?: boolean;
};

type MvpCandidate = {
  id: number;
  name: string;
  teamId: number;
};

type MvpFixture = {
  fixtureId: number;
  matchId: number;
  bestOf: number;
  team1: { id: number; name: string };
  team2: { id: number; name: string };
  candidates: MvpCandidate[];
  officialMvpId: number | null;
  proposal: {
    playerId: number;
    status: string;
    finalPlayerId: number | null;
  } | null;
  canPropose: boolean;
};

const GAME_STATUSES: Record<string, string> = {
  pending: 'EN ATTENTE',
  code_ready: 'CODE PRÊT',
  in_progress: 'EN COURS',
  processing: 'ANALYSE',
  pending_review: 'À VÉRIFIER',
  completed: 'TERMINÉE',
  cancelled: 'ANNULÉE',
};

function formatDate(value: string | null) {
  if (!value) return 'À définir';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'À définir';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toLocalInput(value: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

/* =========================================================
   LOGOS DES ÉQUIPES
========================================================= */

function TeamBadge({ team }: { team: FixtureTeam }) {
  return (
    <div className="czfMatchTeam">
      <div className="czfMatchLogo">
        {team.logo ? (
          <img
            src={team.logo}
            alt={team.name}
            style={{
              display: 'block',
              width: 58,
              height: 58,
              minWidth: 58,
              minHeight: 58,
              maxWidth: 58,
              maxHeight: 58,
              objectFit: 'contain',
              margin: 0,
              padding: 0,
            }}
          />
        ) : (
          <span>
            {team.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <strong className="czfMatchTeamName">
        {team.name}
      </strong>
    </div>
  );
}

/* =========================================================
   NOUVEAU : MVP DU BO
========================================================= */

function MvpSection({
  mvp,
  loading,
  canManage,
  onChanged,
}: {
  mvp: MvpFixture | null;
  loading: boolean;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [choice, setChoice] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!mvp) {
      setChoice(0);
      return;
    }

    setChoice(
      mvp.proposal?.playerId ||
      mvp.candidates[0]?.id ||
      0
    );
  }, [mvp]);

  if (loading) {
    return (
      <div className="czfMvpArea">
        <div className="czfMvpTitle">
          MVP DU BO
        </div>
        <p className="czfMvpHelp">
          Chargement du MVP...
        </p>
      </div>
    );
  }

  if (!mvp) {
    return (
      <div className="czfMvpArea">
        <div className="czfMvpTitle">
          MVP DU BO
        </div>
        <p className="czfMvpHelp">
          Informations MVP indisponibles pour
          cette rencontre.
        </p>
      </div>
    );
  }

  const official = mvp.candidates.find(
    (candidate) =>
      candidate.id === mvp.officialMvpId
  );

  const proposed = mvp.candidates.find(
    (candidate) =>
      candidate.id === mvp.proposal?.playerId
  );

  const hasOfficialMvp =
    mvp.officialMvpId !== null;

  const pendingApproval =
    mvp.proposal?.status === 'pending';

  const canSubmit =
    canManage &&
    mvp.canPropose &&
    !hasOfficialMvp &&
    !mvp.proposal &&
    mvp.candidates.length > 0;

  async function submitMvp() {
    if (!canSubmit || !choice || saving) return;

    const candidate = mvp!.candidates.find(
      (player) => player.id === choice
    );

    if (!candidate) {
      setError('Sélectionne un joueur valide.');
      return;
    }

    const confirmed = window.confirm(
      `Confirmer ${candidate.name} comme MVP élu pendant le cast ?\n\n` +
      `Cette proposition sera envoyée aux admins CZF.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'Session expirée. Reconnecte-toi.'
        );
      }

      const res = await fetch('/api/mvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fixtureId: mvp!.fixtureId,
          playerId: choice,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
          'Impossible de soumettre le MVP.'
        );
      }

      setMessage(
        'MVP envoyé aux admins avec succès.'
      );

      await onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la proposition.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="czfMvpArea">
      <div className="czfMvpHeader">
        <span className="czfMvpTitle">
          MVP DU BO
        </span>

        <span
          className={
            hasOfficialMvp
              ? 'czfMvpStatus czfMvpApproved'
              : pendingApproval
                ? 'czfMvpStatus czfMvpPending'
                : 'czfMvpStatus'
          }
        >
          {hasOfficialMvp
            ? 'VALIDÉ'
            : pendingApproval
              ? 'EN ATTENTE ADMIN'
              : 'À RENSEIGNER'}
        </span>
      </div>

      {hasOfficialMvp ? (
        <div className="czfMvpOfficial">
          <span>🏆 MVP OFFICIEL</span>

          <strong>
            {official?.name || 'MVP attribué'}
          </strong>

          {official && (
            <p>
              {official.teamId === mvp.team1.id
                ? mvp.team1.name
                : mvp.team2.name}
            </p>
          )}
        </div>
      ) : pendingApproval ? (
        <div className="czfMvpProposed">
          <span>
            MVP proposé après le cast
          </span>

          <strong>
            {proposed?.name || 'Joueur proposé'}
          </strong>

          <p>
            Les admins CZF doivent encore
            valider ou corriger ce choix.
          </p>
        </div>
      ) : canSubmit ? (
        <div className="czfMvpForm">
          <p className="czfMvpHelp">
            Le MVP a été élu pendant le cast ?
            Un seul des deux capitaines doit
            renseigner le joueur ici.
          </p>

          <label
            htmlFor={`mvp-choice-${mvp.fixtureId}`}
          >
            Joueur élu MVP
          </label>

          <select
            id={`mvp-choice-${mvp.fixtureId}`}
            value={choice}
            disabled={saving}
            onChange={(event) =>
              setChoice(Number(event.target.value))
            }
          >
            {mvp.candidates.map((candidate) => {
              const teamName =
                candidate.teamId === mvp.team1.id
                  ? mvp.team1.name
                  : mvp.team2.name;

              return (
                <option
                  key={candidate.id}
                  value={candidate.id}
                >
                  {candidate.name} — {teamName}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="czfMvpSubmit"
            onClick={() => void submitMvp()}
            disabled={saving || !choice}
          >
            {saving
              ? 'Envoi en cours...'
              : 'Soumettre le MVP aux admins'}
          </button>
        </div>
      ) : (
        <p className="czfMvpHelp">
          {mvp.candidates.length === 0
            ? 'Les statistiques officielles des joueurs ne sont pas encore disponibles.'
            : 'En attente de la proposition d’un capitaine.'}
        </p>
      )}

      {error && (
        <p className="czfScheduleError">
          {error}
        </p>
      )}

      {message && (
        <p className="czfScheduleSuccess">
          {message}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   CARTE D'UNE RENCONTRE
========================================================= */

function FixtureCard({
  fixture,
  canManage,
  slots,
  gamesLoading,
  mvp,
  mvpLoading,
  onSaved,
  onPrepare,
  onMvpChanged,
}: {
  fixture: Fixture;
  canManage: boolean;
  slots: GameSlot[];
  gamesLoading: boolean;
  mvp: MvpFixture | null;
  mvpLoading: boolean;
  onSaved: () => Promise<void>;
  onPrepare: (fixtureId: number) => Promise<void>;
  onMvpChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  const [dateInput, setDateInput] = useState(
    toLocalInput(fixture.scheduledAt)
  );

  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const finished = fixture.status === 'completed';
  const cancelled = fixture.status === 'cancelled';

  const statusLabels: Record<string, string> = {
    pending: 'À ORGANISER',
    scheduled: 'PROGRAMMÉ',
    in_progress: 'EN COURS',
    completed: 'TERMINÉ',
    cancelled: 'ANNULÉ',
  };

  const editable =
    canManage &&
    fixture.matchId === null &&
    ['pending', 'scheduled'].includes(
      fixture.status
    );

  const canPrepare =
    editable &&
    !gamesLoading &&
    slots.length === 0;

  const score = finished
    ? `${fixture.team1.score ?? 0} - ${fixture.team2.score ?? 0}`
    : 'VS';

  function openEditor() {
    setDateInput(
      toLocalInput(fixture.scheduledAt)
    );

    setError('');
    setSuccess('');
    setEditing(true);
  }

  async function saveDate(removeDate = false) {
    setError('');
    setSuccess('');

    let isoDate: string | null = null;

    if (!removeDate) {
      if (!dateInput) {
        setError(
          'Choisis une date et une heure.'
        );
        return;
      }

      const parsed = new Date(dateInput);

      if (Number.isNaN(parsed.getTime())) {
        setError('Date invalide.');
        return;
      }

      if (parsed.getTime() < Date.now()) {
        setError(
          'Choisis une date dans le futur.'
        );
        return;
      }

      isoDate = parsed.toISOString();
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'Session expirée. Reconnecte-toi.'
        );
      }

      const res = await fetch(
        '/api/my-fixtures/schedule',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fixtureId: fixture.id,
            scheduledAt: isoDate,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
          'Impossible de modifier la date.'
        );
      }

      await onSaved();

      setEditing(false);
      setSuccess(
        json.message || 'Date enregistrée.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function prepareGames() {
    setPreparing(true);
    setError('');
    setSuccess('');

    try {
      await onPrepare(fixture.id);

      setSuccess(
        'Les games sont prêtes dans CZF.'
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de préparer les games.'
      );
    } finally {
      setPreparing(false);
    }
  }

  return (
    <article className="czfMatchCard">
      <div className="czfMatchHeader">
        <span>
          {fixture.stage === 'pool'
            ? 'PHASE DE POULES'
            : 'PLAYOFFS'}
          {' · '}
          BO{fixture.bestOf}
        </span>

        <span
          className={
            finished
              ? 'czfMatchStatus czfMatchFinished'
              : fixture.status === 'scheduled'
                ? 'czfMatchStatus czfMatchScheduled'
                : 'czfMatchStatus'
          }
        >
          {statusLabels[fixture.status] ??
            fixture.status}
        </span>
      </div>

      <div className="czfMatchVersus">
        <TeamBadge team={fixture.team1} />

        <div className="czfMatchScore">
          {score}
        </div>

        <TeamBadge team={fixture.team2} />
      </div>

      <div className="czfMatchFooter">
        <span>
          {finished
            ? 'Résultat enregistré'
            : `Date : ${formatDate(
                fixture.scheduledAt
              )}`}
        </span>

        <strong>{fixture.division}</strong>
      </div>

      {/* PROGRAMMATION EXISTANTE */}

      {editable && !editing && (
        <button
          type="button"
          className="czfScheduleButton"
          onClick={openEditor}
        >
          {fixture.scheduledAt
            ? 'Modifier / reporter la date'
            : 'Programmer la rencontre'}
        </button>
      )}

      {editing && (
        <div className="czfScheduleEditor">
          <h4>
            {fixture.scheduledAt
              ? 'Modifier la programmation'
              : 'Programmer le BO'}
          </h4>

          <p>
            Mettez-vous d'accord sur Discord.
            Un seul capitaine doit renseigner
            la date.
          </p>

          <label
            htmlFor={`fixture-date-${fixture.id}`}
          >
            Date et heure du match
          </label>

          <input
            id={`fixture-date-${fixture.id}`}
            type="datetime-local"
            value={dateInput}
            onChange={(event) =>
              setDateInput(event.target.value)
            }
            disabled={saving}
          />

          <div className="czfScheduleActions">
            <button
              type="button"
              className="czfScheduleSave"
              onClick={() => void saveDate()}
              disabled={saving}
            >
              {saving
                ? 'Enregistrement...'
                : 'Enregistrer'}
            </button>

            {fixture.scheduledAt && (
              <button
                type="button"
                className="czfScheduleRemove"
                onClick={() =>
                  void saveDate(true)
                }
                disabled={saving}
              >
                Remettre à définir
              </button>
            )}

            <button
              type="button"
              className="czfScheduleCancel"
              onClick={() => {
                setEditing(false);
                setError('');
              }}
              disabled={saving}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* PRÉPARATION DES GAMES EXISTANTE */}

      {!cancelled && !finished && (
        <div className="czfGamesArea">
          <div className="czfGamesTitle">
            <span>
              GAMES DU BO{fixture.bestOf}
            </span>

            <span>
              {slots.length > 0
                ? `${slots.length} PRÉPARÉES`
                : 'NON PRÉPARÉES'}
            </span>
          </div>

          {gamesLoading ? (
            <p className="czfGamesHint">
              Chargement des games...
            </p>
          ) : (
            <div className="czfGamesList">
              {Array.from(
                { length: fixture.bestOf },
                (_, index) => {
                  const number = index + 1;

                  const slot = slots.find(
                    (item) =>
                      item.gameNumber === number
                  );

                  return (
                    <div
                      key={number}
                      className="czfGameLine"
                    >
                      <div className="czfGameNumber">
                        G{number}
                      </div>

                      <div className="czfGameText">
                        <strong>
                          Game {number}
                        </strong>

                        <span>
                          {slot
                            ? GAME_STATUSES[
                                slot.status
                              ] ?? slot.status
                            : 'À préparer'}
                        </span>
                      </div>

                      <div className="czfGameIndicator">
                        {slot ? '✓' : '—'}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {canPrepare && (
            <button
              type="button"
              className="czfPrepareButton"
              onClick={() =>
                void prepareGames()
              }
              disabled={preparing}
            >
              {preparing
                ? 'Préparation...'
                : 'Préparer les games'}
            </button>
          )}

          {slots.length > 0 && (
            <p className="czfGamesHint">
              Emplacements enregistrés dans CZF.
              Les Tournament Codes Riot seront
              disponibles après activation de l'API.
            </p>
          )}

          {!canManage &&
            !gamesLoading &&
            slots.length === 0 && (
              <p className="czfGamesHint">
                En attente de préparation
                par un capitaine.
              </p>
            )}
        </div>
      )}

      {/* NOUVEAU : MVP SUR LES BO TERMINÉS */}

      {finished && (
        <MvpSection
          mvp={mvp}
          loading={mvpLoading}
          canManage={canManage}
          onChanged={onMvpChanged}
        />
      )}

      {error && (
        <p className="czfScheduleError">
          {error}
        </p>
      )}

      {success && (
        <p className="czfScheduleSuccess">
          {success}
        </p>
      )}
    </article>
  );
}

/* =========================================================
   PAGE MON ÉQUIPE
========================================================= */

export default function MyTeamPage() {
  const [user, setUser] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);

  const [members, setMembers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [fixturesLoading, setFixturesLoading] =
    useState(false);
  const [gamesLoading, setGamesLoading] =
    useState(false);
  const [mvpLoading, setMvpLoading] =
    useState(false);

  const [fixturesError, setFixturesError] =
    useState('');
  const [mvpError, setMvpError] =
    useState('');

  const [fixtures, setFixtures] =
    useState<Fixture[]>([]);
  const [gameSlots, setGameSlots] =
    useState<GameSlot[]>([]);
  const [mvpFixtures, setMvpFixtures] =
    useState<MvpFixture[]>([]);

  const [season, setSeason] =
    useState<Season | null>(null);

  const [showCompleted, setShowCompleted] =
    useState(false);

  useEffect(() => {
    void loadMyTeam();
  }, []);

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Connexion nécessaire.');
    }

    return session.access_token;
  }

  async function loadMyTeam() {
    setLoading(true);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (!currentUser) {
        setPlayer(null);
        setTeam(null);
        setMembers([]);
        setFixtures([]);
        setGameSlots([]);
        setMvpFixtures([]);
        setSeason(null);
        return;
      }

      const {
        data: allPlayers,
        error: playersError,
      } = await supabase
        .from('players')
        .select('*');

      if (playersError) throw playersError;

      setPlayers(allPlayers || []);

      const linkedPlayer = allPlayers?.find(
        (p: any) =>
          p.profile_id === currentUser.id
      );

      setPlayer(linkedPlayer || null);

      if (!linkedPlayer) {
        setTeam(null);
        setMembers([]);
        setFixtures([]);
        setGameSlots([]);
        setMvpFixtures([]);
        setSeason(null);
        return;
      }

      const {
        data: allMembers,
        error: membersError,
      } = await supabase
        .from('team_members')
        .select('*');

      if (membersError) throw membersError;

      const normalizedRiotId = String(
        linkedPlayer.riot_id || ''
      ).trim().toLowerCase();

      const myMemberLine =
        allMembers?.find((m: any) => {
          if (
            m.player_id !== null &&
            m.player_id !== undefined
          ) {
            return (
              Number(m.player_id) ===
              Number(linkedPlayer.id)
            );
          }

          return (
            String(m.riot_id || '')
              .trim()
              .toLowerCase() ===
            normalizedRiotId
          );
        });

      const {
        data: allTeams,
        error: teamsError,
      } = await supabase
        .from('teams')
        .select('*');

      if (teamsError) throw teamsError;

      const captainTeam = allTeams?.find(
        (t: any) =>
          Number(t.captain_player_id) ===
          Number(linkedPlayer.id)
      );

      const memberTeam = allTeams?.find(
        (t: any) =>
          Number(t.id) ===
          Number(myMemberLine?.team_id)
      );

      const foundTeam =
        captainTeam || memberTeam || null;

      setTeam(foundTeam);

      if (foundTeam) {
        setMembers(
          allMembers?.filter(
            (m: any) =>
              Number(m.team_id) ===
              Number(foundTeam.id)
          ) || []
        );

        await Promise.all([
          loadFixtures(),
          loadGames(),
          loadMvp(),
        ]);
      } else {
        setMembers([]);
        setFixtures([]);
        setGameSlots([]);
        setMvpFixtures([]);
        setSeason(null);
      }
    } catch (error) {
      console.error('[MY TEAM]', error);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     RENCONTRES
  ======================================================= */

  async function loadFixtures() {
    setFixturesLoading(true);
    setFixturesError('');

    try {
      const token = await getToken();

      const res = await fetch(
        '/api/my-fixtures',
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
          'Impossible de charger les rencontres.'
        );
      }

      setFixtures(json.fixtures || []);
      setSeason(json.season || null);
    } catch (error: any) {
      setFixturesError(
        error?.message ||
        'Erreur des rencontres.'
      );

      setFixtures([]);
    } finally {
      setFixturesLoading(false);
    }
  }

  /* =======================================================
     GAMES
  ======================================================= */

  async function loadGames() {
    setGamesLoading(true);

    try {
      const token = await getToken();

      const res = await fetch(
        '/api/my-fixtures/games',
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
          'Impossible de charger les games.'
        );
      }

      setGameSlots(json.slots || []);
    } catch (error) {
      console.error('[MY GAMES]', error);
      setGameSlots([]);
    } finally {
      setGamesLoading(false);
    }
  }

  async function prepareGames(
    fixtureId: number
  ) {
    const token = await getToken();

    const res = await fetch(
      '/api/my-fixtures/games',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${token}`,
        },
        body: JSON.stringify({
          fixtureId,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(
        json.error ||
        'Impossible de préparer les games.'
      );
    }

    await loadGames();
  }

  /* =======================================================
     NOUVEAU : CHARGEMENT MVP
  ======================================================= */

  async function loadMvp() {
    setMvpLoading(true);
    setMvpError('');

    try {
      const token = await getToken();

      const res = await fetch('/api/mvp', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
          'Impossible de charger les MVP.'
        );
      }

      setMvpFixtures(
        Array.isArray(json.fixtures)
          ? json.fixtures
          : []
      );
    } catch (error) {
      console.error('[MY TEAM MVP]', error);

      setMvpError(
        error instanceof Error
          ? error.message
          : 'Erreur MVP.'
      );

      setMvpFixtures([]);
    } finally {
      setMvpLoading(false);
    }
  }

  /* =======================================================
     ROSTER EXISTANT
  ======================================================= */

  function getPlayerFromMember(member: any) {
    if (!member) return null;

    if (
      member.player_id !== null &&
      member.player_id !== undefined
    ) {
      const found = players.find(
        (p) =>
          Number(p.id) ===
          Number(member.player_id)
      );

      if (found) return found;
    }

    const normalizedRiotId = String(
      member.riot_id || ''
    ).trim().toLowerCase();

    return (
      players.find(
        (p) =>
          String(p.riot_id || '')
            .trim()
            .toLowerCase() ===
          normalizedRiotId
      ) || null
    );
  }

  function getRolePlayer(role: string) {
    const member = members.find(
      (m) => m.role === role
    );

    if (!member) return '-';

    const foundPlayer =
      getPlayerFromMember(member);

    return (
      foundPlayer?.riot_id ||
      member.riot_id ||
      '-'
    );
  }

  async function leaveTeam() {
    if (!team || !player) return;

    if (
      Number(team.captain_player_id) ===
      Number(player.id)
    ) {
      alert(
        "Le capitaine ne peut pas quitter son équipe pour l'instant."
      );
      return;
    }

    try {
      const res = await fetch(
        '/api/team-members',
        {
          method: 'DELETE',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            team_id: team.id,
            riot_id: player.riot_id,
          }),
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        alert("Tu as quitté l'équipe");
        await loadMyTeam();
      } else {
        alert(
          "Erreur lors du départ de l'équipe."
        );
      }
    } catch {
      alert(
        "Impossible de quitter l'équipe."
      );
    }
  }

  /* =======================================================
     TRI DES RENCONTRES
  ======================================================= */

  const isCaptain =
    !!team &&
    !!player &&
    Number(team.captain_player_id) ===
      Number(player.id);

  const pendingFixtures = fixtures
    .filter(
      (fixture) =>
        fixture.status !== 'completed' &&
        fixture.status !== 'cancelled'
    )
    .sort((a, b) => {
      if (
        a.scheduledAt &&
        b.scheduledAt
      ) {
        return (
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
        );
      }

      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;

      return a.id - b.id;
    });

  const completedFixtures = fixtures
    .filter(
      (fixture) =>
        fixture.status === 'completed'
    )
    .sort((a, b) => b.id - a.id);

  function renderCard(fixture: Fixture) {
    const canManage =
      isCaptain &&
      (
        Number(team.id) ===
          Number(fixture.team1.id) ||
        Number(team.id) ===
          Number(fixture.team2.id)
      );

    const mvp =
      mvpFixtures.find(
        (item) =>
          Number(item.fixtureId) ===
          Number(fixture.id)
      ) || null;

    return (
      <FixtureCard
        key={fixture.id}
        fixture={fixture}
        slots={gameSlots.filter(
          (slot) =>
            Number(slot.fixtureId) ===
            Number(fixture.id)
        )}
        gamesLoading={gamesLoading}
        mvp={mvp}
        mvpLoading={mvpLoading}
        canManage={canManage}
        onSaved={loadFixtures}
        onPrepare={prepareGames}
        onMvpChanged={loadMvp}
      />
    );
  }

  /* =======================================================
     AFFICHAGE
  ======================================================= */

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span />
          <h2>Mon équipe</h2>
        </div>

        {loading ? (
          <div className="card">
            <p>
              Chargement de ton équipe...
            </p>
          </div>
        ) : (
          <>
            {!user && (
              <div className="card">
                <h3>Non connecté</h3>

                <p>
                  Connecte-toi avec Discord.
                </p>

                <a
                  href="/login"
                  className="rulebookButton"
                >
                  Connexion Discord
                </a>
              </div>
            )}

            {user && !player && (
              <div className="card">
                <h3>
                  Aucun profil joueur
                </h3>

                <p>
                  Crée d'abord ton profil
                  joueur CZF.
                </p>

                <a
                  href="/players"
                  className="rulebookButton"
                >
                  Créer mon profil joueur
                </a>
              </div>
            )}

            {user && player && !team && (
              <div className="card">
                <h3>Aucune équipe</h3>

                <p>
                  Tu n'es dans aucune équipe
                  pour le moment.
                </p>

                <a
                  href="/teams"
                  className="rulebookButton"
                >
                  Voir les équipes
                </a>
              </div>
            )}

            {user && player && team && (
              <>
                {/* ÉQUIPE EXISTANTE */}

                <div className="card">
                  <h3>{team.name}</h3>

                  {team.logo_url && (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="teamLogoBig"
                    />
                  )}

                  <p>
                    <strong>
                      Capitaine :
                    </strong>{' '}
                    {team.captain_riot_id || '-'}
                  </p>

                  <p>
                    <strong>
                      Division :
                    </strong>{' '}
                    {team.division || '-'}
                  </p>

                  <p>
                    <strong>
                      Description :
                    </strong>{' '}
                    {team.description || '-'}
                  </p>

                  {team.multigg_url && (
                    <p>
                      <a
                        href={team.multigg_url}
                        target="_blank"
                        rel="noreferrer"
                        className="multiggLink"
                      >
                        Cliquez pour ouvrir
                        la page MultiGG →
                      </a>
                    </p>
                  )}

                  <h4>Roster</h4>

                  {ROLES.map((role) => (
                    <p key={role}>
                      {role} :{' '}
                      {getRolePlayer(role)}
                    </p>
                  ))}

                  <button
                    className="joinTeamBtn"
                    onClick={leaveTeam}
                  >
                    Quitter l'équipe
                  </button>
                </div>

                {/* RENCONTRES EXISTANTES */}

                <section className="czfFixturesSection">
                  <div className="czfFixturesHeading">
                    <div>
                      <p className="czfFixturesEyebrow">
                        {season?.name || 'CZF'}
                      </p>

                      <h3>
                        Mes rencontres
                      </h3>
                    </div>

                    <span className="czfFixturesCounter">
                      {pendingFixtures.length}
                      {' '}À JOUER
                    </span>
                  </div>

                  {fixturesError && (
                    <div className="czfFixturesError">
                      {fixturesError}
                    </div>
                  )}

                  {fixturesLoading ? (
                    <div className="czfFixturesEmpty">
                      Chargement des rencontres...
                    </div>
                  ) : (
                    <>
                      {pendingFixtures.length === 0 ? (
                        <div className="czfFixturesEmpty">
                          Aucune rencontre à organiser.
                        </div>
                      ) : (
                        <div className="czfFixturesGrid">
                          {pendingFixtures.map(
                            renderCard
                          )}
                        </div>
                      )}

                      {completedFixtures.length > 0 && (
                        <div className="czfCompletedSection">
                          <button
                            type="button"
                            className="czfCompletedToggle"
                            onClick={() =>
                              setShowCompleted(
                                (value) => !value
                              )
                            }
                          >
                            <span>
                              Matchs terminés (
                              {completedFixtures.length})
                            </span>

                            <span>
                              {showCompleted
                                ? '−'
                                : '+'}
                            </span>
                          </button>

                          {showCompleted && (
                            <>
                              {mvpError && (
                                <div className="czfFixturesError">
                                  Impossible de charger
                                  les informations MVP :
                                  {' '}
                                  {mvpError}
                                </div>
                              )}

                              <div className="czfFixturesGrid">
                                {completedFixtures.map(
                                  renderCard
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {/* STYLES DE LA PAGE */}

        <style jsx global>{`
          .czfFixturesSection {
            margin-top: 24px;
            padding: 24px;
            border: 1px solid rgba(9, 42, 63, 0.25);
            border-radius: 14px;
            background: #fff3df;
            color: #092a3f;
          }

          .czfFixturesHeading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
          }

          .czfFixturesEyebrow {
            margin: 0 0 5px;
            color: #aa673c;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .czfFixturesHeading h3 {
            margin: 0;
            font-size: 26px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .czfFixturesCounter {
            padding: 9px 12px;
            border-radius: 8px;
            background: rgba(9, 42, 63, 0.08);
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .czfFixturesGrid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .czfMatchCard {
            box-sizing: border-box;
            min-width: 0;
            padding: 16px;
            overflow: hidden;
            border: 1px solid rgba(9, 42, 63, 0.18);
            border-radius: 11px;
            background: #fffbf3;
          }

          .czfMatchHeader,
          .czfMatchFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            font-size: 10px;
            font-weight: 900;
            color: #64717c;
          }

          .czfMatchStatus {
            padding: 6px 9px;
            border-radius: 6px;
            background: #f3e5c9;
            color: #95601d;
          }

          .czfMatchScheduled {
            background: #e6edf8;
            color: #365f99;
          }

          .czfMatchFinished {
            background: #e5f2e6;
            color: #287a46;
          }

          .czfMatchVersus {
            display: grid !important;
            grid-template-columns:
              minmax(0, 1fr)
              76px
              minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 12px;
            min-width: 0;
            padding: 24px 0;
          }

          .czfMatchTeam {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 9px;
            min-width: 0;
            text-align: center;
          }

          .czfMatchLogo {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box;
            width: 60px !important;
            height: 60px !important;
            min-width: 60px !important;
            min-height: 60px !important;
            max-width: 60px !important;
            max-height: 60px !important;
            flex: 0 0 60px;
            overflow: hidden;
            border: 1px solid rgba(9, 42, 63, 0.1);
            border-radius: 9px;
            background: #f8edd9;
          }

          .czfMatchLogo img {
            display: block !important;
            width: 58px !important;
            height: 58px !important;
            max-width: 58px !important;
            max-height: 58px !important;
            object-fit: contain !important;
          }

          .czfMatchLogo span {
            font-size: 14px;
            font-weight: 900;
          }

          .czfMatchTeamName {
            display: block;
            max-width: 100%;
            overflow-wrap: anywhere;
            line-height: 1.3;
            font-size: 13px;
            font-weight: 900;
            color: #092a3f;
          }

          .czfMatchScore {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #092a3f;
            font-size: 23px;
            font-weight: 900;
            text-align: center;
            white-space: nowrap;
          }

          .czfMatchFooter {
            padding-top: 12px;
            border-top: 1px solid rgba(9, 42, 63, 0.1);
          }

          /* PROGRAMMATION DES DATES */

          .czfScheduleButton {
            display: block;
            width: 100%;
            margin-top: 15px;
            padding: 12px 14px;
            border: 1px solid #092a3f;
            border-radius: 8px;
            background: #092a3f;
            color: #fff6e5;
            cursor: pointer;
            font-size: 12px;
            font-weight: 900;
          }

          .czfScheduleButton:hover {
            background: #164762;
          }

          .czfScheduleEditor {
            margin-top: 15px;
            padding: 16px;
            border: 1px solid rgba(9, 42, 63, 0.18);
            border-radius: 9px;
            background: #f6ecdb;
          }

          .czfScheduleEditor h4 {
            margin: 0 0 7px;
            color: #092a3f;
            font-size: 14px;
            font-weight: 900;
          }

          .czfScheduleEditor p {
            margin: 0 0 14px;
            color: #64717c;
            font-size: 11px;
            line-height: 1.5;
          }

          .czfScheduleEditor label {
            display: block;
            margin-bottom: 7px;
            color: #092a3f;
            font-size: 12px;
            font-weight: 900;
          }

          .czfScheduleEditor input {
            display: block;
            box-sizing: border-box;
            width: 100%;
            min-height: 43px;
            padding: 9px 12px;
            border: 1px solid rgba(9, 42, 63, 0.3);
            border-radius: 7px;
            background: #fffdfa;
            color: #092a3f;
            font-size: 14px;
          }

          .czfScheduleActions {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
            margin-top: 14px;
          }

          .czfScheduleActions button {
            min-height: 39px;
            padding: 9px 12px;
            border: 1px solid rgba(9, 42, 63, 0.2);
            border-radius: 7px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 900;
          }

          .czfScheduleSave {
            background: #092a3f;
            color: #ffffff;
          }

          .czfScheduleRemove {
            background: #f0dcc8;
            color: #9b4234;
          }

          .czfScheduleCancel {
            background: transparent;
            color: #092a3f;
          }

          .czfScheduleActions button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          /* GAMES */

          .czfGamesArea {
            margin-top: 16px;
            padding-top: 15px;
            border-top: 1px dashed rgba(9, 42, 63, 0.2);
          }

          .czfGamesTitle {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 11px;
            color: #657381;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.5px;
          }

          .czfGamesList {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .czfGameLine {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 1px solid rgba(9, 42, 63, 0.1);
            border-radius: 8px;
            background: #f5eddc;
          }

          .czfGameNumber {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 36px;
            height: 36px;
            border-radius: 7px;
            background: #092a3f;
            color: #fff6e5;
            font-size: 12px;
            font-weight: 900;
          }

          .czfGameText {
            display: flex;
            flex: 1;
            min-width: 0;
            flex-direction: column;
            gap: 3px;
          }

          .czfGameText strong {
            font-size: 12px;
            color: #092a3f;
          }

          .czfGameText span {
            font-size: 10px;
            font-weight: 800;
            color: #7a8792;
          }

          .czfGameIndicator {
            color: #267b49;
            font-size: 17px;
            font-weight: 900;
          }

          .czfPrepareButton {
            display: block;
            width: 100%;
            margin-top: 12px;
            padding: 11px 12px;
            border: 1px solid #af7746;
            border-radius: 7px;
            background: #f0dfc6;
            color: #683e21;
            cursor: pointer;
            font-size: 12px;
            font-weight: 900;
          }

          .czfPrepareButton:hover {
            background: #e9cfa9;
          }

          .czfPrepareButton:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .czfGamesHint {
            margin: 10px 0 0;
            color: #74808a;
            font-size: 10px;
            line-height: 1.5;
          }

          /* NOUVEAU : MVP */

          .czfMvpArea {
            margin-top: 16px;
            padding: 16px;
            border: 1px solid rgba(9, 42, 63, 0.14);
            border-radius: 9px;
            background: #f6edda;
          }

          .czfMvpHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 9px;
            margin-bottom: 12px;
          }

          .czfMvpTitle {
            display: block;
            color: #092a3f;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.6px;
          }

          .czfMvpStatus {
            padding: 6px 8px;
            border-radius: 6px;
            background: #e9dfce;
            color: #826d4c;
            font-size: 10px;
            font-weight: 900;
          }

          .czfMvpPending {
            background: #f4dfb9;
            color: #92601c;
          }

          .czfMvpApproved {
            background: #e1efe2;
            color: #277248;
          }

          .czfMvpHelp {
            margin: 0 0 12px;
            color: #657381;
            font-size: 11px;
            line-height: 1.6;
          }

          .czfMvpForm label {
            display: block;
            margin-bottom: 8px;
            color: #092a3f;
            font-size: 12px;
            font-weight: 900;
          }

          .czfMvpForm select {
            box-sizing: border-box;
            display: block;
            width: 100%;
            min-height: 43px;
            padding: 10px 12px;
            border: 1px solid rgba(9, 42, 63, 0.3);
            border-radius: 8px;
            background: #fffdfa;
            color: #092a3f;
            font-size: 12px;
          }

          .czfMvpSubmit {
            display: block;
            width: 100%;
            margin-top: 12px;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #092a3f;
            color: #fff3df;
            cursor: pointer;
            font-size: 12px;
            font-weight: 900;
          }

          .czfMvpSubmit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .czfMvpOfficial,
          .czfMvpProposed {
            padding: 13px;
            border-radius: 8px;
            background: #eee1c9;
          }

          .czfMvpOfficial {
            background: #e3f0df;
          }

          .czfMvpOfficial span,
          .czfMvpProposed span {
            display: block;
            margin-bottom: 7px;
            color: #687681;
            font-size: 10px;
            font-weight: 900;
          }

          .czfMvpOfficial strong,
          .czfMvpProposed strong {
            display: block;
            color: #092a3f;
            font-size: 15px;
            font-weight: 900;
            overflow-wrap: anywhere;
          }

          .czfMvpOfficial p,
          .czfMvpProposed p {
            margin: 6px 0 0;
            color: #657381;
            font-size: 11px;
            line-height: 1.5;
          }

          /* MESSAGES */

          .czfScheduleError {
            margin: 10px 0 0;
            color: #a73535;
            font-size: 11px;
            font-weight: 800;
          }

          .czfScheduleSuccess {
            margin: 10px 0 0;
            color: #287a46;
            font-size: 11px;
            font-weight: 900;
          }

          .czfFixturesEmpty {
            padding: 30px;
            text-align: center;
            color: #64717c;
          }

          .czfFixturesError {
            margin-bottom: 16px;
            padding: 13px;
            border-radius: 8px;
            background: #f7dfd8;
            color: #9b3535;
          }

          .czfCompletedSection {
            margin-top: 22px;
          }

          .czfCompletedToggle {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 14px;
            padding: 14px 16px;
            border: 1px solid rgba(9, 42, 63, 0.15);
            border-radius: 8px;
            background: #f1e8da;
            color: #092a3f;
            cursor: pointer;
            font-size: 13px;
            font-weight: 900;
          }

          @media (max-width: 900px) {
            .czfFixturesGrid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 480px) {
            .czfFixturesSection {
              padding: 14px;
            }

            .czfFixturesHeading {
              align-items: flex-start;
              flex-direction: column;
            }

            .czfMatchVersus {
              grid-template-columns:
                minmax(0, 1fr)
                48px
                minmax(0, 1fr) !important;
              gap: 6px;
            }

            .czfMatchScore {
              font-size: 18px;
            }

            .czfMatchCard {
              padding: 12px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
