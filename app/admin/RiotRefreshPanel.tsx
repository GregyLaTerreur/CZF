'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

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

  const BATCH_SIZE = 20;

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
      '/api/admin/riot-sync-batch',
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

  async function refreshAll() {
    if (running) return;

    setRunning(true);

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
          onClick={refreshAll}
          disabled={
            running ||
            retrying
          }
        >
          {running
            ? 'Actualisation en cours...'
            : 'Mettre à jour tous les joueurs'}
        </button>

        {failedPlayers.length >
          0 && (
          <button
            className="joinTeamBtn"
            onClick={
              retryFailed
            }
            disabled={
              running ||
              retrying
            }
          >
            {retrying
              ? 'Nouvelle tentative...'
              : `Réessayer les ${failedPlayers.length} échecs`}
          </button>
        )}

      </div>


      {(running ||
        processed > 0) && (
        <div className="riotProgress">

          <div className="riotProgressTop">

            <strong>
              {processed} /{' '}
              {total}
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


      <div className="riotAdminStats">

        <div>
          <span>
            Traités
          </span>

          <strong>
            {processed}
          </strong>
        </div>

        <div>
          <span>
            Réussis
          </span>

          <strong>
            {updated}
          </strong>
        </div>

        <div>
          <span>
            Pseudos modifiés
          </span>

          <strong>
            {renamed}
          </strong>
        </div>

        <div>
          <span>
            Échecs
          </span>

          <strong>
            {
              failedPlayers.length
            }
          </strong>
        </div>

      </div>


      {message && (
        <p className="riotAdminMessage">
          {message}
        </p>
      )}


      {failedPlayers.length >
        0 && (
        <div className="riotFailedPlayers">

          <h4>
            Joueurs en échec
          </h4>

          {failedPlayers.map(
            (player) => (
              <div
                key={
                  player.player_id
                }
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

    </div>
  );
}