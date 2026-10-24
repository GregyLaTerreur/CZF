'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import CheckIcon from '@/app/components/icons/CheckIcon';
import { DIVISION_COLORS, DIVISIONS, type DivisionName } from '@/app/components/home/divisions';
import styles from './my-team.module.css';

export type FixtureTeam = {
  id: number;
  name: string;
  logo: string | null;
  score: number | null;
};

export type Fixture = {
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

export type GameSlot = {
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

export type MvpFixture = {
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

const FIXTURE_STATUSES: Record<string, string> = {
  pending: 'À organiser',
  scheduled: 'Programmé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const GAME_STATUSES: Record<string, string> = {
  pending: 'En attente',
  code_ready: 'Code prêt',
  in_progress: 'En cours',
  processing: 'Analyse',
  pending_review: 'À vérifier',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

function formatDate(value: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return 'Date à définir';

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Valeur attendue par <input type="datetime-local">, en heure locale.
function toLocalInput(value: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

async function getToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('Session expirée. Reconnecte-toi.');

  return session.access_token;
}

function TeamSide({ team }: { team: FixtureTeam }) {
  return (
    <div className={styles.side}>
      {team.logo ? (
        <img src={team.logo} alt="" className={styles.sideLogo} />
      ) : (
        <span className={styles.sideLogoEmpty}>{team.name.slice(0, 2).toUpperCase()}</span>
      )}
      <strong className={styles.sideName}>{team.name}</strong>
    </div>
  );
}

/* =========================================================
   MVP DU BO
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
  const [choice, setChoice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setChoice(mvp?.proposal?.playerId || mvp?.candidates[0]?.id || 0);
  }, [mvp]);

  if (loading || !mvp) {
    return (
      <div className={styles.part}>
        <div className={styles.partHead}>
          <span>MVP du BO</span>
        </div>
        <p className={styles.hint}>
          {loading ? 'Chargement du MVP…' : 'Informations MVP indisponibles pour cette rencontre.'}
        </p>
      </div>
    );
  }

  const teamName = (teamId: number) => (teamId === mvp.team1.id ? mvp.team1.name : mvp.team2.name);
  const official = mvp.candidates.find((c) => c.id === mvp.officialMvpId);
  const proposed = mvp.candidates.find((c) => c.id === mvp.proposal?.playerId);
  const hasOfficial = mvp.officialMvpId !== null;
  const pending = mvp.proposal?.status === 'pending';

  const canSubmit =
    canManage && mvp.canPropose && !hasOfficial && !mvp.proposal && mvp.candidates.length > 0;

  async function submitMvp() {
    const candidate = mvp!.candidates.find((player) => player.id === choice);

    if (!candidate) return setError('Sélectionne un joueur valide.');

    const confirmed = window.confirm(
      `Confirmer ${candidate.name} comme MVP élu pendant le cast ?\n\nCette proposition sera envoyée aux admins CZF.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/mvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ fixtureId: mvp!.fixtureId, playerId: choice }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Impossible de soumettre le MVP.');

      setMessage('MVP envoyé aux admins.');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la proposition.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.part}>
      <div className={styles.partHead}>
        <span>MVP du BO</span>
        <span className={hasOfficial ? styles.tagDone : pending ? styles.tagWaiting : styles.tag}>
          {hasOfficial ? 'Validé' : pending ? 'En attente admin' : 'À renseigner'}
        </span>
      </div>

      {hasOfficial ? (
        <div className={styles.mvp}>
          <strong>{official?.name || 'MVP attribué'}</strong>
          {official && <span>{teamName(official.teamId)}</span>}
        </div>
      ) : pending ? (
        <div className={styles.mvp}>
          <strong>{proposed?.name || 'Joueur proposé'}</strong>
          <span>Proposé après le cast, en attente de validation par les admins.</span>
        </div>
      ) : canSubmit ? (
        <div className={styles.partForm}>
          <p className={styles.hint}>
            Le MVP a été élu pendant le cast ? Un seul des deux capitaines le renseigne ici.
          </p>

          <label className={ds.field}>
            <span>Joueur élu MVP</span>
            <select
              className={ds.input}
              value={choice}
              disabled={saving}
              onChange={(event) => setChoice(Number(event.target.value))}
            >
              {mvp.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {teamName(candidate.teamId)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`${ds.btnPrimary} ${ds.btnSmall}`}
            onClick={() => void submitMvp()}
            disabled={saving || !choice}
          >
            {saving ? 'Envoi…' : 'Soumettre aux admins'}
          </button>
        </div>
      ) : (
        <p className={styles.hint}>
          {mvp.candidates.length === 0
            ? 'Les statistiques officielles des joueurs ne sont pas encore disponibles.'
            : 'En attente de la proposition d’un capitaine.'}
        </p>
      )}

      {error && <p className={ds.formError}>{error}</p>}
      {message && <p className={ds.formInfo}>{message}</p>}
    </div>
  );
}

/* =========================================================
   CARTE D'UNE RENCONTRE
========================================================= */

export default function FixtureCard({
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
  const [dateInput, setDateInput] = useState(toLocalInput(fixture.scheduledAt));
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const finished = fixture.status === 'completed';
  const cancelled = fixture.status === 'cancelled';
  const editable =
    canManage && fixture.matchId === null && ['pending', 'scheduled'].includes(fixture.status);
  const canPrepare = editable && !gamesLoading && slots.length === 0;
  const division = DIVISIONS.includes(fixture.division as DivisionName)
    ? (fixture.division as DivisionName)
    : null;

  function openEditor() {
    setDateInput(toLocalInput(fixture.scheduledAt));
    setError('');
    setSuccess('');
    setEditing(true);
  }

  async function saveDate(removeDate = false) {
    setError('');
    setSuccess('');

    let isoDate: string | null = null;

    if (!removeDate) {
      const parsed = new Date(dateInput);

      if (!dateInput) return setError('Choisis une date et une heure.');
      if (Number.isNaN(parsed.getTime())) return setError('Date invalide.');
      if (parsed.getTime() < Date.now()) return setError('Choisis une date dans le futur.');

      isoDate = parsed.toISOString();
    }

    setSaving(true);

    try {
      const res = await fetch('/api/my-fixtures/schedule', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ fixtureId: fixture.id, scheduledAt: isoDate }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Impossible de modifier la date.');

      await onSaved();
      setEditing(false);
      setSuccess(json.message || 'Date enregistrée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
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
      setSuccess('Les games sont prêtes dans CZF.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de préparer les games.');
    } finally {
      setPreparing(false);
    }
  }

  const statusClass = finished
    ? styles.tagDone
    : fixture.status === 'scheduled'
      ? styles.tagScheduled
      : styles.tag;

  return (
    <article className={`${ds.card} ${styles.fixture}`}>
      <div className={styles.fixtureHead}>
        <span>
          {fixture.stage === 'pool' ? 'Phase de poules' : 'Playoffs'} · BO{fixture.bestOf}
        </span>
        <span className={statusClass}>{FIXTURE_STATUSES[fixture.status] ?? fixture.status}</span>
      </div>

      <div className={styles.versus}>
        <TeamSide team={fixture.team1} />
        <div className={styles.score}>
          {finished ? `${fixture.team1.score ?? 0} - ${fixture.team2.score ?? 0}` : 'VS'}
        </div>
        <TeamSide team={fixture.team2} />
      </div>

      <div className={styles.fixtureMeta}>
        <span>{finished ? 'Résultat enregistré' : formatDate(fixture.scheduledAt)}</span>
        {division && (
          <span>
            <span className={ds.teamDot} style={{ background: DIVISION_COLORS[division] }} />
            {division}
          </span>
        )}
      </div>

      {/* PROGRAMMATION */}
      {editable && !editing && (
        <div className={styles.part}>
          <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={openEditor}>
            {fixture.scheduledAt ? 'Modifier ou reporter la date' : 'Programmer la rencontre'}
          </button>
        </div>
      )}

      {editing && (
        <div className={`${styles.part} ${styles.partForm}`}>
          <p className={styles.hint}>
            Mettez-vous d’accord sur Discord : un seul capitaine renseigne la date.
          </p>

          <label className={ds.field}>
            <span>Date et heure du match</span>
            <input
              className={ds.input}
              type="datetime-local"
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              disabled={saving}
            />
          </label>

          <div className={styles.partActions}>
            <button
              type="button"
              className={`${ds.btnPrimary} ${ds.btnSmall}`}
              onClick={() => void saveDate()}
              disabled={saving}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            {fixture.scheduledAt && (
              <button
                type="button"
                className={`${ds.btnDanger} ${ds.btnSmall}`}
                onClick={() => void saveDate(true)}
                disabled={saving}
              >
                Remettre à définir
              </button>
            )}

            <button
              type="button"
              className={`${ds.btnOutline} ${ds.btnSmall}`}
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

      {/* GAMES DU BO */}
      {!cancelled && !finished && (
        <div className={styles.part}>
          <div className={styles.partHead}>
            <span>Games du BO{fixture.bestOf}</span>
            <span className={slots.length > 0 ? styles.tagDone : styles.tag}>
              {slots.length > 0 ? `${slots.length} préparée${slots.length > 1 ? 's' : ''}` : 'Non préparées'}
            </span>
          </div>

          {gamesLoading ? (
            <p className={styles.hint}>Chargement des games…</p>
          ) : (
            <div className={styles.games}>
              {Array.from({ length: fixture.bestOf }, (_, index) => {
                const number = index + 1;
                const slot = slots.find((item) => item.gameNumber === number);

                return (
                  <div key={number} className={styles.game}>
                    <span className={styles.gameNumber}>G{number}</span>
                    <span className={styles.gameStatus}>
                      {slot ? GAME_STATUSES[slot.status] ?? slot.status : 'À préparer'}
                    </span>
                    {slot && <CheckIcon className={styles.gameCheck} />}
                  </div>
                );
              })}
            </div>
          )}

          {canPrepare && (
            <button
              type="button"
              className={`${ds.btnPrimary} ${ds.btnSmall}`}
              onClick={() => void prepareGames()}
              disabled={preparing}
            >
              {preparing ? 'Préparation…' : 'Préparer les games'}
            </button>
          )}

          {slots.length > 0 && (
            <p className={styles.hint}>
              Emplacements enregistrés. Les codes de tournoi Riot seront disponibles après
              activation de l’API.
            </p>
          )}

          {!canManage && !gamesLoading && slots.length === 0 && (
            <p className={styles.hint}>En attente de préparation par un capitaine.</p>
          )}
        </div>
      )}

      {finished && (
        <MvpSection mvp={mvp} loading={mvpLoading} canManage={canManage} onChanged={onMvpChanged} />
      )}

      {(error || success) && (
        <div className={styles.part}>
          {error && <p className={ds.formError}>{error}</p>}
          {success && <p className={ds.formInfo}>{success}</p>}
        </div>
      )}
    </article>
  );
}
