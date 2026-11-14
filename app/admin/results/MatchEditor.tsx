'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import styles from './matchManager.module.css';

type Team = { id: number; name: string; tag: string | null };

type StatLine = {
  statId: number;
  playerId: number;
  name: string;
  teamId: number;
  role: string;
  championId: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  visionScore: number;
};

type Sub = { teamId: number; role: string; championId: string; kills: number; deaths: number; assists: number };

type Game = {
  id: number;
  gameNumber: number;
  durationSeconds: number;
  winnerTeamId: number;
  players: StatLine[];
  substitutes: Sub[];
};

type EditableMatch = {
  id: number;
  stage: 'pool' | 'playoff';
  bestOf: number;
  playedAt: string;
  mvpPlayerId: number | null;
  team1: Team;
  team2: Team;
  games: Game[];
};

// Les champs numériques restent en texte pendant la saisie (champ vide autorisé).
type Draft = Omit<EditableMatch, 'games'> & {
  games: (Omit<Game, 'durationSeconds'> & { duration: string })[];
};

const STAT_FIELDS: { key: keyof StatLine; label: string }[] = [
  { key: 'kills', label: 'K' },
  { key: 'deaths', label: 'D' },
  { key: 'assists', label: 'A' },
  { key: 'cs', label: 'CS' },
  { key: 'gold', label: 'Gold' },
  { key: 'damage', label: 'Dégâts' },
  { key: 'visionScore', label: 'Vision' },
];

function toDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// « 32:15 » ou « 1935 » (secondes).
function parseDuration(value: string) {
  const match = value.trim().match(/^(\d+):([0-5]?\d)$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
}

// datetime-local attend l'heure locale sans fuseau.
function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Connecte-toi en admin pour modifier un match.');
  return { Authorization: `Bearer ${token}` };
}

// Édition à la main d'un BO enregistré (stats, vainqueurs des games, MVP, date).
export default function MatchEditor({
  matchId,
  onClose,
  onSaved,
}: {
  matchId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [champions, setChampions] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/admin/results/${matchId}`, {
          headers: await authHeaders(),
          cache: 'no-store',
        });
        const json = await res.json();

        if (!res.ok || !json.success) throw new Error(json.error || json.message || 'Chargement impossible.');
        if (cancelled) return;

        const match: EditableMatch = json.match;

        setChampions(json.champions || []);
        setDraft({
          ...match,
          playedAt: toLocalInput(match.playedAt),
          games: match.games.map(({ durationSeconds, ...game }) => ({
            ...game,
            duration: toDuration(durationSeconds),
          })),
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Chargement impossible.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  function updateGame(gameId: number, patch: Partial<Draft['games'][number]>) {
    setDraft((previous) =>
      previous && {
        ...previous,
        games: previous.games.map((game) => (game.id === gameId ? { ...game, ...patch } : game)),
      }
    );
  }

  function updateStat(gameId: number, statId: number, key: keyof StatLine, value: string) {
    const game = draft?.games.find((item) => item.id === gameId);
    if (!game) return;

    updateGame(gameId, {
      players: game.players.map((line) =>
        line.statId === statId ? { ...line, [key]: value } : line
      ),
    });
  }

  function updateSub(gameId: number, index: number, key: keyof Sub, value: string) {
    const game = draft?.games.find((item) => item.id === gameId);
    if (!game) return;

    updateGame(gameId, {
      substitutes: game.substitutes.map((sub, i) => (i === index ? { ...sub, [key]: value } : sub)),
    });
  }

  async function save() {
    if (!draft) return;

    setError('');

    const games = [];

    for (const game of draft.games) {
      const durationSeconds = parseDuration(game.duration);

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        setError(`Durée invalide pour la Game ${game.gameNumber} (format 32:15).`);
        return;
      }

      games.push({
        id: game.id,
        durationSeconds,
        winnerTeamId: game.winnerTeamId,
        players: game.players.map((line) => ({
          statId: line.statId,
          championId: line.championId,
          ...Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, Number(line[key])])),
        })),
        substitutes: game.substitutes.map((sub) => ({
          ...sub,
          kills: Number(sub.kills),
          deaths: Number(sub.deaths),
          assists: Number(sub.assists),
        })),
      });
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/admin/results/${matchId}`, {
        method: 'PATCH',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playedAt: draft.playedAt ? new Date(draft.playedAt).toISOString() : undefined,
          mvpPlayerId: draft.mvpPlayerId,
          games,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || json.message || 'Modification impossible.');

      onSaved(
        `BO modifié : ${draft.team1.tag || draft.team1.name} ${json.score.team1} - ${json.score.team2} ${
          draft.team2.tag || draft.team2.name
        }.`
      );
    } catch (err: any) {
      setError(err?.message || 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <div className={styles.editor}>
        <p className={error ? styles.message : styles.empty}>{error || 'Chargement du match…'}</p>
        {error && (
          <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    );
  }

  const teamName = (id: number) => {
    const team = id === draft.team1.id ? draft.team1 : draft.team2;
    return team.tag || team.name;
  };
  const wins1 = draft.games.filter((game) => game.winnerTeamId === draft.team1.id).length;
  const wins2 = draft.games.length - wins1;
  const mvpCandidates = new Map<number, string>();

  for (const game of draft.games) {
    for (const line of game.players) mvpCandidates.set(line.playerId, line.name);
  }

  return (
    <div className={styles.editor}>
      <datalist id="czf-edit-champions">
        {champions.map((champion) => (
          <option key={champion.id} value={champion.id}>
            {champion.name}
          </option>
        ))}
      </datalist>

      <div className={styles.editorHead}>
        <div className={ds.cardTitle}>
          Modifier · {draft.team1.name} <strong className={styles.editorScore}>{wins1} - {wins2}</strong> {draft.team2.name}
        </div>
        <span className={styles.meta}>
          {draft.stage === 'pool' ? 'Poule' : `Playoff BO${draft.bestOf}`} · ID {draft.id}
        </span>
      </div>

      <div className={styles.editorFields}>
        <label className={styles.editorLabel}>
          Date
          <input
            type="datetime-local"
            className={ds.input}
            value={draft.playedAt}
            onChange={(event) => setDraft({ ...draft, playedAt: event.target.value })}
          />
        </label>

        <label className={styles.editorLabel}>
          MVP du BO
          <select
            className={ds.input}
            value={draft.mvpPlayerId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, mvpPlayerId: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">Aucun</option>
            {[...mvpCandidates].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft.games.map((game) => (
        <div key={game.id} className={styles.editorGame}>
          <div className={styles.editorGameHead}>
            <strong>Game {game.gameNumber}</strong>

            <span className={ds.tabs}>
              {[draft.team1, draft.team2].map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={game.winnerTeamId === team.id ? ds.tabActive : ds.tab}
                  onClick={() => updateGame(game.id, { winnerTeamId: team.id })}
                >
                  Victoire {team.tag || team.name}
                </button>
              ))}
            </span>

            <label className={styles.editorInline}>
              Durée
              <input
                className={`${ds.input} ${styles.editorSmall}`}
                value={game.duration}
                placeholder="32:15"
                onChange={(event) => updateGame(game.id, { duration: event.target.value })}
              />
            </label>
          </div>

          <div className={styles.editorTableWrap}>
            <table className={styles.editorTable}>
              <thead>
                <tr>
                  <th>Équipe</th>
                  <th>Joueur</th>
                  <th>Rôle</th>
                  <th>Champion</th>
                  {STAT_FIELDS.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {game.players.map((line) => (
                  <tr key={line.statId}>
                    <td>{teamName(line.teamId)}</td>
                    <td>{line.name}</td>
                    <td>{line.role}</td>
                    <td>
                      <input
                        className={styles.cell}
                        list="czf-edit-champions"
                        value={line.championId}
                        onChange={(event) => updateStat(game.id, line.statId, 'championId', event.target.value)}
                      />
                    </td>
                    {STAT_FIELDS.map((field) => (
                      <td key={field.key}>
                        <input
                          className={`${styles.cell} ${styles.cellNumber}`}
                          inputMode="numeric"
                          value={String(line[field.key])}
                          onChange={(event) => updateStat(game.id, line.statId, field.key, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                {game.substitutes.map((sub, index) => (
                  <tr key={`sub-${index}`} className={styles.subRow}>
                    <td>{teamName(Number(sub.teamId))}</td>
                    <td>Sub (hors stats)</td>
                    <td>{sub.role}</td>
                    <td>
                      <input
                        className={styles.cell}
                        list="czf-edit-champions"
                        value={sub.championId}
                        onChange={(event) => updateSub(game.id, index, 'championId', event.target.value)}
                      />
                    </td>
                    {(['kills', 'deaths', 'assists'] as const).map((key) => (
                      <td key={key}>
                        <input
                          className={`${styles.cell} ${styles.cellNumber}`}
                          inputMode="numeric"
                          value={String(sub[key])}
                          onChange={(event) => updateSub(game.id, index, key, event.target.value)}
                        />
                      </td>
                    ))}
                    <td colSpan={4} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className={styles.hint}>
        Le score et le vainqueur du BO sont recalculés depuis les games. Pour changer d&apos;équipe, de joueur
        ou le nombre de games, supprime le BO et ressaisis-le.
      </p>

      {error && <p className={styles.message}>{error}</p>}

      <div className={styles.editorActions}>
        <button type="button" className={`${ds.btnPrimary} ${ds.btnSmall}`} disabled={saving} onClick={save}>
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
        <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} disabled={saving} onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
