'use client';

import { useMemo, useState } from 'react';
import ds from '@/app/components/ds/ds.module.css';
import type { TcgBooster } from '@/lib/tcg/boosters';
import styles from './tcgAdmin.module.css';

export type GiveProfile = { id: string; discord_name: string | null; riot_id: string | null };
export type GiveTeam = { id: number; name: string; division: string | null; validated: boolean; profile_ids: string[] };

type Props = {
  boosters: TcgBooster[];
  profiles: GiveProfile[];
  teams: GiveTeam[];
  initialBoosterId: number | null;
  onClose: () => void;
  onGive: (payload: { booster_id: number; quantity: number; profile_ids: string[]; all: boolean }) => Promise<void>;
};

const label = (p: GiveProfile) => p.discord_name || p.riot_id || p.id.slice(0, 8);

// Pop-in de distribution : x boosters à une sélection de joueurs (cochés, par équipe, ou tout le monde), en un envoi.
export default function GiveBoostersModal({ boosters, profiles, teams, initialBoosterId, onClose, onGive }: Props) {
  const active = boosters.filter((b) => b.active);
  const [boosterId, setBoosterId] = useState<number | ''>(initialBoosterId ?? active[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [everyone, setEveryone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((p) => `${p.discord_name || ''} ${p.riot_id || ''}`.toLowerCase().includes(query));
  }, [profiles, search]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addMany = (ids: string[]) => setSelected((current) => new Set([...current, ...ids]));

  function addTeam(value: string) {
    setTeamId('');
    const team = teams.find((t) => String(t.id) === value);
    if (team) addMany(team.profile_ids);
  }

  const count = everyone ? profiles.length : selected.size;
  const booster = active.find((b) => b.id === boosterId);

  async function submit() {
    if (!boosterId || !count || sending) return;
    if (everyone && !window.confirm(`Donner ${quantity} « ${booster?.name} » à tous les profils (${profiles.length}) ?`)) return;

    setSending(true);
    setError('');
    try {
      await onGive({ booster_id: Number(boosterId), quantity, profile_ids: everyone ? [] : [...selected], all: everyone });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${ds.card} ${styles.modal}`}>
        <div className={styles.modalHead}>
          <div className={ds.cardTitle}>Distribuer des boosters</div>
          <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={onClose}>Fermer</button>
        </div>

        <div className={styles.row}>
          <label className={ds.field}>
            <span>Booster</span>
            <select className={ds.input} value={boosterId} onChange={(e) => setBoosterId(e.target.value ? Number(e.target.value) : '')}>
              {!active.length && <option value="">Aucun booster actif</option>}
              {active.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className={ds.field}>
            <span>Boosters par joueur</span>
            <input className={ds.input} type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
          </label>
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Tout le monde ({profiles.length} profils)
        </label>

        {!everyone && (
          <>
            <div className={styles.row}>
              <label className={ds.field}>
                <span>Ajouter toute une équipe</span>
                <select className={ds.input} value={teamId} onChange={(e) => addTeam(e.target.value)}>
                  <option value="">Choisir une équipe…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.profile_ids.length}){t.division ? ` · ${t.division}` : ''}{t.validated ? '' : ' · non validée'}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ds.field}>
                <span>Chercher un joueur</span>
                <input className={ds.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pseudo Discord ou Riot ID" />
              </label>
            </div>

            <div className={styles.pickerTools}>
              <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => addMany(results.map((p) => p.id))}>
                Tout cocher ({results.length})
              </button>
              <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => setSelected(new Set())} disabled={!selected.size}>
                Vider la sélection
              </button>
            </div>

            <div className={styles.picker}>
              {results.map((p) => (
                <label key={p.id} className={`${styles.pick} ${selected.has(p.id) ? styles.pickOn : ''}`}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span>{label(p)}</span>
                  {p.riot_id && p.discord_name && <small>{p.riot_id}</small>}
                </label>
              ))}
              {!results.length && <p className={ds.empty}>Aucun joueur trouvé.</p>}
            </div>

            {selected.size > 0 && (
              <div className={styles.chips}>
                {[...selected].slice(0, 40).map((id) => (
                  <button key={id} type="button" className={styles.chip} onClick={() => toggle(id)} title="Retirer">
                    {byId.get(id) ? label(byId.get(id)!) : id.slice(0, 8)}
                  </button>
                ))}
                {selected.size > 40 && <span className={styles.itemMeta}>+ {selected.size - 40} autres</span>}
              </div>
            )}
          </>
        )}

        {error && <p className={ds.formError}>{error}</p>}

        <div className={ds.formActions}>
          <button type="button" className={ds.btnPrimary} onClick={submit} disabled={sending || !boosterId || !count}>
            {sending ? 'Envoi…' : `Donner ${quantity} booster${quantity > 1 ? 's' : ''} à ${count} joueur${count > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
