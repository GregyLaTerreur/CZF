'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import Loader from '@/app/components/ds/Loader';
import DivisionIcon from '@/app/components/ds/DivisionIcon';
import styles from './notes.module.css';

type Rating = {
  player_id: number;
  riot_id: string | null;
  team: string | null;
  division: string | null;
  role: string | null;
  note: number;
  ipi: number | null;
  score_kda: number | null;
  score_gpm: number | null;
  score_dpm: number | null;
  score_cs: number | null;
  score_kp: number | null;
  score_vision: number | null;
  computed_at: string | null;
};
type Skipped = { player_id: number; riot_id: string | null; reason: string | null };

const DIVISIONS = ['Targon', 'Ixtal', 'Yordle'];
const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const SCORES: [keyof Rating, string][] = [
  ['score_kda', 'KDA'], ['score_gpm', 'GPM'], ['score_dpm', 'DPM'], ['score_cs', 'CS'], ['score_kp', 'KP'], ['score_vision', 'Vision'],
];
const PAGE = 50;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Reconnecte-toi avec Discord.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const fmt = (value: number | null, digits = 1) => (value === null ? '—' : value.toFixed(digits).replace('.', ','));
const pseudo = (riotId: string | null) => (riotId ? riotId.split('#')[0] : 'Joueur');

// Admin > Notes : notes actuelles (czf_player_rating), statistiques, et recalcul par l'algo IPI.
export default function NotesView() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [season, setSeason] = useState<{ id: number; name: string } | null>(null);
  const [launched, setLaunched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [division, setDivision] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/ratings/current', { cache: 'no-store', headers: await authHeaders() });
      if (response.status === 401 || response.status === 403) return setAllowed(false);
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setAllowed(true);
      setRatings(json.ratings);
      setSeason(json.season);
      setLaunched(json.launched);
    } catch (err) {
      setAllowed((current) => current ?? false);
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function recompute(target: string | null) {
    if (busy) return;
    const scope = target ? `les joueurs de ${target}` : 'tous les joueurs';
    if (!window.confirm(`Recalculer la note de ${scope} avec l’algo IPI ?\n\nLes notes affichées sur les cartes changeront tout de suite.`)) return;
    setBusy(target ?? 'tous');
    setError('');
    setMessage('');
    setSkipped([]);
    try {
      const response = await fetch('/api/admin/ratings', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ season_id: season?.id, division: target }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setMessage(`${json.updated} note${json.updated > 1 ? 's' : ''} mise${json.updated > 1 ? 's' : ''} à jour${target ? ` en ${target}` : ''}.${json.skipped.length ? ` ${json.skipped.length} joueur${json.skipped.length > 1 ? 's' : ''} non noté${json.skipped.length > 1 ? 's' : ''} (gardent leur note actuelle).` : ''}`);
      setSkipped(json.skipped);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setBusy(null);
    }
  }

  // Seules les notes calculées par l'algo (ipi rempli) comptent dans les statistiques.
  const computed = useMemo(() => ratings.filter((r) => r.ipi !== null), [ratings]);
  const lastUpdate = useMemo(() => computed.reduce<string | null>((max, r) => (r.computed_at && (!max || r.computed_at > max) ? r.computed_at : max), null), [computed]);
  const notes = computed.map((r) => r.note).sort((a, b) => a - b);
  const median = notes.length ? (notes.length % 2 ? notes[(notes.length - 1) / 2] : (notes[notes.length / 2 - 1] + notes[notes.length / 2]) / 2) : null;
  const byGroup = (key: 'division' | 'role', values: string[]) =>
    values.map((value) => {
      const group = computed.filter((r) => r[key] === value).map((r) => r.note);
      return { value, count: group.length, average: avg(group) };
    });
  const bins = Array.from({ length: 10 }, (_, i) => {
    const from = i * 10;
    const to = i === 9 ? 100 : from + 9;
    return { label: `${from}–${to}`, count: notes.filter((n) => n >= from && n <= to).length };
  });
  const maxBin = Math.max(1, ...bins.map((b) => b.count));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ratings
      .filter((r) => (!division || r.division === division) && (!role || r.role === role))
      .filter((r) => !q || `${r.riot_id ?? ''} ${r.team ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.note - a.note || (b.ipi ?? -1) - (a.ipi ?? -1));
  }, [ratings, division, role, search]);

  if (allowed === null) return <Loader label="Chargement des notes" block />;
  if (!allowed) {
    return (
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Administration</div>
        <h1 className={ds.h1}>Notes</h1>
        <p className={ds.body}>Réservé aux admins.</p>
      </div>
    );
  }

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={styles.top}>
        <div>
          <div className={ds.sectionLabel}>Administration · {season?.name}</div>
          <h1 className={ds.h1}>Notes des joueurs</h1>
          <p className={styles.sub}>
            Algo IPI : chaque stat notée sur 100 selon le barème de la division et du rôle, moyenne pondérée par rôle.
            Joueurs notés s’ils ont joué au moins 45 % des parties de leur équipe. Recalcul automatique chaque nuit.
          </p>
        </div>
      </div>

      {error && <p className={ds.formError}>{error}</p>}
      {message && <p className={ds.formInfo}>{message}</p>}

      {/* Recalcul */}
      <section className={`${ds.card} ${styles.actions}`}>
        <div className={ds.cardTitle}>Recalculer</div>
        {launched ? (
          <p className={styles.sub}>La collection de cette saison est lancée : les notes sont figées.</p>
        ) : (
          <div className={styles.actionRow}>
            <button type="button" className={ds.btnPrimary} disabled={busy !== null} onClick={() => recompute(null)}>
              {busy === 'tous' ? 'Calcul…' : 'Tout le monde'}
            </button>
            {DIVISIONS.map((d) => (
              <button key={d} type="button" className={`${ds.btnOutline} ${styles.divBtn}`} disabled={busy !== null} onClick={() => recompute(d)}>
                <DivisionIcon division={d} />
                {busy === d ? 'Calcul…' : d}
              </button>
            ))}
          </div>
        )}
        {skipped.length > 0 && (
          <details className={styles.skipped}>
            <summary>Voir les {skipped.length} joueurs non notés</summary>
            <ul>
              {skipped.map((s) => (
                <li key={s.player_id}>
                  <b>{pseudo(s.riot_id)}</b> · {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Chiffres clés */}
      <div className={styles.tiles}>
        <div className={styles.tile}><span>Joueurs notés par l’algo</span><strong>{computed.length}</strong><small>sur {ratings.length} avec une note</small></div>
        <div className={styles.tile}><span>Note moyenne</span><strong>{fmt(avg(notes))}</strong><small>sur 100</small></div>
        <div className={styles.tile}><span>Note médiane</span><strong>{fmt(median)}</strong><small>la moitié au-dessus</small></div>
        <div className={styles.tile}><span>Dernier calcul</span><strong className={styles.tileDate}>{lastUpdate ? new Date(lastUpdate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais'}</strong><small>{computed.length ? 'par l’algo' : 'notes par défaut (99)'}</small></div>
      </div>

      {computed.length > 0 && (
        <div className={styles.charts}>
          {/* Moyennes par division et par rôle : barres horizontales sur 100. */}
          <section className={`${ds.card} ${styles.chart}`}>
            <div className={ds.cardTitle}>Moyenne par division</div>
            {byGroup('division', DIVISIONS).map((g) => (
              <div key={g.value} className={styles.barRow} title={`${g.value} : ${fmt(g.average)} de moyenne sur ${g.count} joueurs`}>
                <span className={styles.barLabel}><DivisionIcon division={g.value} />{g.value}</span>
                <span className={styles.barTrack}><span className={styles.bar} style={{ width: `${g.average ?? 0}%` }} /></span>
                <b>{fmt(g.average)}</b>
                <small>{g.count} j.</small>
              </div>
            ))}
            <div className={ds.cardTitle} style={{ marginTop: 18 }}>Moyenne par rôle</div>
            {byGroup('role', ROLES).map((g) => (
              <div key={g.value} className={styles.barRow} title={`${g.value} : ${fmt(g.average)} de moyenne sur ${g.count} joueurs`}>
                <span className={styles.barLabel}>{g.value}</span>
                <span className={styles.barTrack}><span className={styles.bar} style={{ width: `${g.average ?? 0}%` }} /></span>
                <b>{fmt(g.average)}</b>
                <small>{g.count} j.</small>
              </div>
            ))}
          </section>

          {/* Répartition des notes par tranches de 10. */}
          <section className={`${ds.card} ${styles.chart}`}>
            <div className={ds.cardTitle}>Répartition des notes</div>
            <div className={styles.histogram} role="img" aria-label={bins.map((b) => `${b.label} : ${b.count}`).join(', ')}>
              {bins.map((b) => (
                <div key={b.label} className={styles.hCol} title={`Notes ${b.label} : ${b.count} joueur${b.count > 1 ? 's' : ''}`}>
                  <span className={styles.hCount}>{b.count || ''}</span>
                  <span className={styles.hBar} style={{ height: `${(b.count / maxBin) * 100}%` }} />
                  <span className={styles.hLabel}>{b.label.split('–')[0]}</span>
                </div>
              ))}
            </div>
            <p className={styles.axis}>Note sur 100 · nombre de joueurs par tranche de 10</p>
          </section>
        </div>
      )}

      {/* Toutes les notes */}
      <section className={styles.tableBlock}>
        <div className={styles.filters}>
          <div className={ds.tabs}>
            <button type="button" className={division === null ? ds.tabActive : ds.tab} onClick={() => setDivision(null)}>Toutes</button>
            {DIVISIONS.map((d) => (
              <button key={d} type="button" className={division === d ? ds.tabActive : ds.tab} onClick={() => setDivision(division === d ? null : d)}>
                <DivisionIcon division={d} />{d}
              </button>
            ))}
          </div>
          <div className={ds.tabs}>
            <button type="button" className={role === null ? ds.tabActive : ds.tab} onClick={() => setRole(null)}>Tous les rôles</button>
            {ROLES.map((r) => (
              <button key={r} type="button" className={role === r ? ds.tabActive : ds.tab} onClick={() => setRole(role === r ? null : r)}>{r}</button>
            ))}
          </div>
          <input className={`${ds.input} ${styles.search}`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Joueur ou équipe" />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th><th>Joueur</th><th>Équipe</th><th>Rôle</th><th className={styles.num}>Note</th><th className={styles.num}>IPI</th>
                {SCORES.map(([, label]) => <th key={label} className={styles.num}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((r, i) => (
                <tr key={r.player_id}>
                  <td className={styles.rank}>{i + 1}</td>
                  <td><b>{pseudo(r.riot_id)}</b></td>
                  <td className={styles.teamCell}>{r.division && <DivisionIcon division={r.division} />}{r.team ?? '—'}</td>
                  <td>{r.role ?? '—'}</td>
                  <td className={styles.num}><span className={styles.notePill}>{r.note}</span></td>
                  <td className={styles.num}>{fmt(r.ipi)}</td>
                  {SCORES.map(([key, label]) => <td key={label} className={styles.num}>{r[key] === null ? '—' : Math.round(Number(r[key]))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className={ds.empty}>Aucun joueur avec ces filtres.</p>}
        </div>
        {filtered.length > limit && (
          <button type="button" className={ds.btnOutline} onClick={() => setLimit((l) => l + PAGE)}>Voir plus ({filtered.length - limit})</button>
        )}
        <p className={styles.axis}>Note = note affichée sur les cartes. Colonnes KDA à Vision : note de chaque stat sur 100 (« — » si la stat ne compte pas pour le rôle ou si l’algo n’a pas encore tourné).</p>
      </section>
    </div>
  );
}
