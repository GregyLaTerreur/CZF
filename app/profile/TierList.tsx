'use client';

// Tier list des champions faite par le joueur, façon TierMaker :
// rangées S à D, champions glissés depuis la liste (ou clic sur le champion puis sur la rangée).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import CloseIcon from '@/app/components/icons/CloseIcon';
import { TIER_COLORS, TIER_KEYS, emptyTierList, type TierKey, type TierListData } from '@/lib/tierList';
import styles from './tier-list.module.css';

type Champion = { id: string; name: string };

// Liste des champions Data Dragon, chargée une fois par visite (seulement pour l'édition).
const championRequests = new Map<string, Promise<Champion[]>>();

function loadChampions(version: string): Promise<Champion[]> {
  if (!championRequests.has(version)) {
    championRequests.set(
      version,
      fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`)
        .then((res) => res.json())
        .then((json) =>
          Object.values(json.data as Record<string, Champion>)
            .map(({ id, name }) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        )
        .catch((error) => {
          championRequests.delete(version);
          throw error;
        })
    );
  }

  return championRequests.get(version)!;
}

function championImage(version: string, id: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}

// Position d'un champion : une rangée, ou la liste des champions non classés.
type Zone = TierKey | 'pool';

export default function TierList({
  playerId,
  isOwn,
  ddragonVersion,
}: {
  playerId: number;
  isOwn: boolean;
  ddragonVersion: string;
}) {
  // undefined : en chargement ; null : pas de tier list.
  const [saved, setSaved] = useState<TierListData | null | undefined>(undefined);
  const [draft, setDraft] = useState<TierListData | null>(null);
  const [champions, setChampions] = useState<Champion[] | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    fetch(`/api/tier-list?playerId=${playerId}`)
      .then((res) => res.json())
      .then((json) => active && setSaved(json.success ? json.tierList?.tiers ?? null : null))
      .catch(() => active && setSaved(null));

    return () => {
      active = false;
    };
  }, [playerId]);

  const editing = draft !== null;

  useEffect(() => {
    if (!editing || champions) return;

    loadChampions(ddragonVersion)
      .then(setChampions)
      .catch(() => setMessage('Impossible de charger la liste des champions.'));
  }, [editing, champions, ddragonVersion]);

  const names = useMemo(() => new Map((champions ?? []).map((c) => [c.id, c.name])), [champions]);

  const placed = useMemo(() => new Set(draft ? TIER_KEYS.flatMap((key) => draft[key]) : []), [draft]);

  const pool = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (champions ?? []).filter(
      (champion) =>
        !placed.has(champion.id) &&
        (!query || champion.name.toLowerCase().includes(query) || champion.id.toLowerCase().includes(query))
    );
  }, [champions, placed, search]);

  function startEditing() {
    setDraft(saved ? structuredClone(saved) : emptyTierList());
    setMessage('');
  }

  function cancel() {
    setDraft(null);
    setSelected(null);
    setSearch('');
    setMessage('');
  }

  // Déplace un champion vers une rangée (avant `beforeId` si donné) ou le renvoie dans la liste.
  function move(championId: string, zone: Zone, beforeId?: string) {
    setDraft((current) => {
      if (!current) return current;

      const next = {} as TierListData;
      for (const key of TIER_KEYS) next[key] = current[key].filter((id) => id !== championId);

      if (zone !== 'pool') {
        const row = next[zone];
        const index = beforeId ? row.indexOf(beforeId) : -1;
        if (index === -1) row.push(championId);
        else row.splice(index, 0, championId);
      }

      return next;
    });
    setSelected(null);
  }

  async function save() {
    if (!draft) return;

    setSaving(true);
    setMessage('');

    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/tier-list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ tiers: draft }),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Erreur lors de l’enregistrement.');

      setSaved(json.tierList?.tiers ?? null);
      cancel();
    } catch (error: any) {
      setMessage(error?.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Glisser-déposer ---------- */

  const dragProps = (championId: string) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData('text/plain', championId);
      event.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => setDragOver(null),
  });

  const dropProps = (zone: Zone) => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      if (dragOver !== zone) setDragOver(zone);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(null);
      const championId = event.dataTransfer.getData('text/plain');
      if (championId) move(championId, zone);
    },
    // Sans glisser (mobile) : champion choisi puis clic sur la zone.
    onClick: () => selected && move(selected, zone),
  });

  /* ---------- Rendu ---------- */

  // Échap ferme la pop-in ; la page derrière ne défile plus.
  useEffect(() => {
    if (!editing) return;

    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !saving && cancel();
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [editing, saving]);

  function board(tiers: TierListData, editable: boolean) {
    return (
      <div className={styles.board}>
        {TIER_KEYS.map((key) => (
          <div key={key} className={styles.row}>
            <div className={styles.label} style={{ background: TIER_COLORS[key] }}>
              {key}
            </div>

            <div
              className={`${styles.zone} ${editable && dragOver === key ? styles.zoneOver : ''} ${
                editable && selected ? styles.zoneTarget : ''
              }`}
              {...(editable ? dropProps(key) : {})}
            >
              {tiers[key].map((id) => (
                <img
                  key={id}
                  src={championImage(ddragonVersion, id)}
                  alt={names.get(id) ?? id}
                  title={names.get(id) ?? id}
                  loading="lazy"
                  className={`${styles.champion} ${editable && selected === id ? styles.championSelected : ''}`}
                  {...(editable
                    ? {
                        ...dragProps(id),
                        // Déposé sur un champion : se place juste avant lui.
                        onDrop: (event: React.DragEvent) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDragOver(null);
                          const championId = event.dataTransfer.getData('text/plain');
                          if (championId && championId !== id) move(championId, key, id);
                        },
                        onClick: (event: React.MouseEvent) => {
                          event.stopPropagation();
                          if (selected && selected !== id) move(selected, key, id);
                          else setSelected(selected === id ? null : id);
                        },
                      }
                    : {})}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (saved === undefined) return <p className={styles.state}>Chargement…</p>;

  return (
    <div className={styles.wrap}>
      {saved ? board(saved, false) : !isOwn && <p className={styles.state}>Pas encore de tier list.</p>}

      {isOwn && (
        <div className={styles.actions}>
          <button type="button" className={saved ? ds.btnOutline : ds.btnPrimary} onClick={startEditing}>
            {saved ? 'Modifier ma tier list' : 'Faire ma tier list'}
          </button>
        </div>
      )}

      {draft && (
        <div className={styles.overlay} onClick={() => !saving && cancel()}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Ma tier list"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Ma tier list</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={cancel}
                disabled={saving}
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.modalBody}>
              {board(draft, true)}

              <p className={styles.hint}>
                Glisse les champions dans les rangées, ou clique sur un champion puis sur une rangée.
                Remets-le dans la liste pour le retirer.
              </p>

              <input
                className={styles.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un champion"
                autoFocus
              />

              <div
                className={`${styles.pool} ${dragOver === 'pool' ? styles.zoneOver : ''}`}
                {...dropProps('pool')}
              >
                {!champions && <p className={styles.state}>Chargement des champions…</p>}

                {pool.map((champion) => (
                  <img
                    key={champion.id}
                    src={championImage(ddragonVersion, champion.id)}
                    alt={champion.name}
                    title={champion.name}
                    loading="lazy"
                    className={`${styles.champion} ${selected === champion.id ? styles.championSelected : ''}`}
                    {...dragProps(champion.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(selected === champion.id ? null : champion.id);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className={styles.modalFoot}>
              {message && <p className={styles.error}>{message}</p>}

              <div className={styles.actions}>
                <button type="button" className={ds.btnPrimary} onClick={save} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className={ds.btnOutline} onClick={cancel} disabled={saving}>
                  Annuler
                </button>
                <button
                  type="button"
                  className={ds.btnOutline}
                  onClick={() => setDraft(emptyTierList())}
                  disabled={saving}
                >
                  Tout vider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
