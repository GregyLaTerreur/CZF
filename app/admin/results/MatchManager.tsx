'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DIVISIONS, type DivisionName } from '@/app/components/home/divisions';
import styles from './matchManager.module.css';

type Side = { id: number; shortName: string; name: string; score: number } | null;

type Match = {
  id: number;
  stage: 'pool' | 'playoff';
  playedAt: string;
  team1: Side;
  team2: Side;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
}

// Liste des BO d'une division avec suppression (match, games, stats).
export default function MatchManager() {
  const [division, setDivision] = useState<DivisionName>('Yordle');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async (target: DivisionName) => {
    setMatches(null);

    try {
      const res = await fetch(`/api/historique?division=${target}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Chargement impossible.');

      setMatches(json.matches);
    } catch (error: any) {
      setMatches([]);
      setMessage(error?.message || 'Chargement impossible.');
    }
  }, []);

  useEffect(() => {
    setConfirmId(null);
    load(division);
  }, [division, load]);

  async function remove(match: Match) {
    setDeletingId(match.id);
    setMessage('');

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error('Connecte-toi en admin pour supprimer un match.');

      const res = await fetch(`/api/admin/results/${match.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Suppression impossible.');

      setMatches((previous) => (previous || []).filter((item) => item.id !== match.id));
      setMessage(
        `BO supprimé : ${label(match.team1)} - ${label(match.team2)} (${json.deleted.games} game${
          json.deleted.games > 1 ? 's' : ''
        } et leurs stats).`
      );
    } catch (error: any) {
      setMessage(error?.message || 'Suppression impossible.');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <section className={`card ${styles.panel}`}>
      <div className={styles.head}>
        <h3>Matchs enregistrés</h3>

        <div className={styles.tabs}>
          {DIVISIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={division === item ? styles.tabActive : styles.tab}
              onClick={() => setDivision(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        Supprimer un BO efface aussi ses games et toutes les stats des joueurs de ce BO. La
        rencontre du planning, si elle existe, repasse à jouer.
      </p>

      {message && <p className={styles.message}>{message}</p>}

      {matches === null && <p className={styles.empty}>Chargement…</p>}
      {matches?.length === 0 && <p className={styles.empty}>Aucun match enregistré dans cette division.</p>}

      {matches && matches.length > 0 && (
        <ul className={styles.list}>
          {matches.map((match) => (
            <li key={match.id} className={styles.row}>
              <span className={styles.meta}>
                {match.stage === 'pool' ? 'Poule' : 'Playoff'} · {formatDate(match.playedAt)}
              </span>

              <span className={styles.teams}>
                {label(match.team1)}
                <strong>
                  {match.team1?.score ?? '-'} - {match.team2?.score ?? '-'}
                </strong>
                {label(match.team2)}
              </span>

              {confirmId === match.id ? (
                <span className={styles.actions}>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={deletingId === match.id}
                    onClick={() => remove(match)}
                  >
                    {deletingId === match.id ? 'Suppression…' : 'Confirmer'}
                  </button>
                  <button type="button" className={styles.cancel} onClick={() => setConfirmId(null)}>
                    Annuler
                  </button>
                </span>
              ) : (
                <span className={styles.actions}>
                  <button type="button" className={styles.delete} onClick={() => setConfirmId(match.id)}>
                    Supprimer
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Une équipe plus validée n'est plus renvoyée par l'historique.
function label(side: Side) {
  return side?.shortName ?? 'Équipe retirée';
}
