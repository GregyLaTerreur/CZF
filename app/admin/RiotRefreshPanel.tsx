'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import {
  DIVISIONS,
  DIVISION_COLORS,
  type DivisionName,
} from '@/app/components/home/divisions';
import styles from './admin.module.css';

type FailedPlayer = {
  player_id: number;
  riot_id: string;
  error?: string;
  attempts?: number;
};

export default function RiotRefreshPanel() {
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [renamed, setRenamed] = useState(0);

  const [failedPlayers, setFailedPlayers] =
    useState<FailedPlayer[]>([]);

  const [message, setMessage] = useState('');

  const [open, setOpen] = useState(false);

  // Périmètre de la dernière actualisation (null : tous les joueurs).
  const [scope, setScope] =
    useState<DivisionName | null | undefined>(undefined);

  const busy = running || retrying;

  const BATCH_SIZE = 10;

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || null;
  }

  async function callBatch(body: any) {
    const token = await getToken();

    if (!token) {
      throw new Error(
        'Session admin introuvable.'
      );
    }

    const res = await fetch(
      '/api/admin/refresh-riot',
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (
      !res.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
          'Erreur actualisation Riot.'
      );
    }

    return data;
  }

  async function refreshAll(
    division: DivisionName | null
  ) {
    if (running || retrying) return;

    setRunning(true);
    setScope(division);

    setMessage(
      'Préparation de l’actualisation...'
    );

    setTotal(0);
    setProcessed(0);
    setUpdated(0);
    setRenamed(0);
    setFailedPlayers([]);

    let offset = 0;

    let totalPlayers = 0;
    let totalUpdated = 0;
    let totalRenamed = 0;

    let allFailed:
      FailedPlayer[] = [];

    try {
      while (true) {
        setMessage(
          `Actualisation des joueurs ${offset + 1} à ${offset + BATCH_SIZE}...`
        );

        const data =
          await callBatch({
            offset,
            limit:
              BATCH_SIZE,
            division,
          });

        totalPlayers =
          data.total || 0;

        setTotal(
          totalPlayers
        );

        const batchCount =
          data.batch_count ||
          0;

        totalUpdated +=
          data.updated || 0;

        totalRenamed +=
          data.renamed || 0;

        if (
          Array.isArray(
            data.failed_players
          )
        ) {
          allFailed = [
            ...allFailed,
            ...data.failed_players,
          ];
        }

        offset +=
          batchCount;

        setProcessed(
          Math.min(
            offset,
            totalPlayers
          )
        );

        setUpdated(
          totalUpdated
        );

        setRenamed(
          totalRenamed
        );

        setFailedPlayers(
          allFailed
        );

        if (
          batchCount === 0 ||
          offset >= totalPlayers
        ) {
          break;
        }
      }

      if (
        allFailed.length ===
        0
      ) {
        setMessage(
          `${totalPlayers}/${totalPlayers} joueurs actualisés.`
        );
      } else {
        setMessage(
          `Terminé : ${
            totalPlayers -
            allFailed.length
          }/${totalPlayers} réussis — ${allFailed.length} échec(s).`
        );
      }
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur pendant l’actualisation.'
      );
    }

    setRunning(false);
  }

  async function retryFailed() {
    if (
      retrying ||
      failedPlayers.length ===
        0
    ) {
      return;
    }

    setRetrying(true);

    const ids =
      failedPlayers.map(
        (player) =>
          player.player_id
      );

    const remaining:
      FailedPlayer[] = [];

    let retryUpdated = 0;
    let retryRenamed = 0;

    try {
      for (
        let i = 0;
        i < ids.length;
        i += BATCH_SIZE
      ) {
        const chunk =
          ids.slice(
            i,
            i + BATCH_SIZE
          );

        setMessage(
          `Nouvelle tentative : ${Math.min(
            i + chunk.length,
            ids.length
          )}/${ids.length}`
        );

        const data =
          await callBatch({
            player_ids:
              chunk,
          });

        retryUpdated +=
          data.updated || 0;

        retryRenamed +=
          data.renamed || 0;

        if (
          Array.isArray(
            data.failed_players
          )
        ) {
          remaining.push(
            ...data.failed_players
          );
        }
      }

      setUpdated(
        (current) =>
          current +
          retryUpdated
      );

      setRenamed(
        (current) =>
          current +
          retryRenamed
      );

      setFailedPlayers(
        remaining
      );

      if (
        remaining.length ===
        0
      ) {
        setMessage(
          'Tous les échecs ont finalement été actualisés.'
        );
      } else {
        setMessage(
          `${remaining.length} joueur(s) échouent encore.`
        );
      }
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur pendant la nouvelle tentative.'
      );
    }

    setRetrying(false);
  }

  const progress =
    total > 0
      ? Math.round(
          (processed /
            total) *
            100
        )
      : 0;

  const scopeLabel =
    scope === undefined
      ? ''
      : scope === null
        ? 'Tous les joueurs'
        : `Joueurs ${scope}`;

  return (
    <div className="card riotAdminCard">

      <h3>
        Actualisation Riot
      </h3>

      <p>
        Met à jour les ranks,
        LP, winrates, points CZF
        et les Riot ID ayant
        changé.
      </p>

      <div className="riotAdminActions">
        <button
          className="joinTeamBtn"
          onClick={() => setOpen(true)}
        >
          {busy
            ? `Actualisation en cours… ${processed}/${total}`
            : 'Actualiser Riot'}
        </button>
      </div>

      {!open && message && (
        <p className="riotAdminMessage">
          {scopeLabel && `${scopeLabel} — `}
          {message}
        </p>
      )}

      {open && (
        <RefreshModal onClose={() => setOpen(false)}>

          <div className={styles.modalTitle}>
            Actualiser Riot
          </div>

          <p className={`${styles.modalText} ${ds.muted}`}>
            Choisis les joueurs à
            relancer. Seules les
            équipes validées
            comptent pour une
            division.
          </p>

          <div className={styles.scopeGrid}>
            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                className={`joinTeamBtn ${styles.scopeBtn}`}
                onClick={() =>
                  refreshAll(division)
                }
                disabled={busy}
              >
                <span
                  className={styles.dot}
                  style={{
                    background:
                      DIVISION_COLORS[division],
                  }}
                />
                {running && scope === division
                  ? 'En cours…'
                  : `Joueurs ${division}`}
              </button>
            ))}

            <button
              type="button"
              className={`joinTeamBtn ${styles.scopeBtn}`}
              onClick={() =>
                refreshAll(null)
              }
              disabled={busy}
            >
              {running && scope === null
                ? 'En cours…'
                : 'Tous les joueurs'}
            </button>
          </div>

          {(running ||
            processed > 0) && (
            <div className="riotProgress">

              <div className="riotProgressTop">
                <strong>
                  {scopeLabel} :{' '}
                  {processed} / {total}
                </strong>

                <span>
                  {progress}%
                </span>
              </div>

              <div className="riotProgressBar">
                <div
                  className="riotProgressFill"
                  style={{
                    width:
                      `${progress}%`,
                  }}
                />
              </div>

            </div>
          )}

          {(running ||
            processed > 0) && (
            <div className={`riotAdminStats ${styles.stats}`}>
              <div>
                <span>Traités</span>
                <strong>{processed}</strong>
              </div>

              <div>
                <span>Réussis</span>
                <strong>{updated}</strong>
              </div>

              <div>
                <span>Pseudos modifiés</span>
                <strong>{renamed}</strong>
              </div>

              <div>
                <span>Échecs</span>
                <strong>{failedPlayers.length}</strong>
              </div>
            </div>
          )}

          {message && (
            <p className="riotAdminMessage">
              {message}
            </p>
          )}

          {failedPlayers.length > 0 && (
            <div className="riotFailedPlayers">

              <button
                type="button"
                className="joinTeamBtn"
                onClick={retryFailed}
                disabled={busy}
              >
                {retrying
                  ? 'Nouvelle tentative...'
                  : `Réessayer les ${failedPlayers.length} échecs`}
              </button>

              <h4>
                Joueurs en échec
              </h4>

              {failedPlayers.map(
                (player) => (
                  <div
                    key={player.player_id}
                    className="riotFailedRow"
                  >
                    <strong>
                      {player.riot_id ||
                        `Joueur ${player.player_id}`}
                    </strong>

                    <span>
                      {player.error ||
                        'Erreur Riot'}
                    </span>
                  </div>
                )
              )}

            </div>
          )}

        </RefreshModal>
      )}

    </div>
  );
}

// Pop-in : Échap ou clic à côté ferme (l'actualisation continue),
// la page derrière ne défile plus.
function RefreshModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) =>
      event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${ds.onDark}`}
        role="dialog"
        aria-modal="true"
        aria-label="Actualiser Riot"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
