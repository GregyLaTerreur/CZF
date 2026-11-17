'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import styles from './droits.module.css';

type Permission = { name: string; description: string };
type Grant = { profile_id: string; permission: string; granted_at: string; note: string | null };
type Profile = { id: string; discord_name: string | null; is_admin: boolean; riot_id: string | null };

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Reconnecte-toi avec Discord.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

const label = (p?: Profile) => (p ? p.discord_name || p.riot_id || p.id.slice(0, 8) : 'Profil supprimé');

// Droits d'admin nommés : qui a quel droit, en donner, en retirer. Superadmins seulement.
export default function DroitsView() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/grants', { cache: 'no-store', headers: await authHeaders() });
      if (response.status === 401 || response.status === 403) return setAllowed(false);
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setAllowed(true);
      setPermissions(json.permissions);
      setGrants(json.grants);
      setProfiles(json.profiles);
    } catch (err) {
      setAllowed((current) => current ?? false);
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(method: 'POST' | 'DELETE', profileId: string, permission: string) {
    if (busy) return;
    const who = label(profiles.find((p) => p.id === profileId));
    if (method === 'DELETE' && !window.confirm(`Retirer le droit « ${permission} » à ${who} ?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/grants', { method, headers: await authHeaders(), body: JSON.stringify({ profile_id: profileId, permission }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setMessage(method === 'POST' ? `Droit « ${permission} » donné à ${who}.` : `Droit « ${permission} » retiré à ${who}.`);
      setPicked((current) => ({ ...current, [permission]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return <div className={`${ds.container} ${styles.wrap}`}><p className={ds.empty}>Chargement…</p></div>;

  if (!allowed) {
    return (
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Administration</div>
        <h1 className={ds.h1}>Droits</h1>
        <p className={ds.body}>Réservé aux superadmins.</p>
      </div>
    );
  }

  const byId = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={styles.top}>
        <div>
          <div className={ds.sectionLabel}>Administration · Superadmin</div>
          <h1 className={ds.h1}>Droits</h1>
        </div>
        <Link href="/admin" className={`${ds.btnOutline} ${ds.btnSmall}`}>Retour admin</Link>
      </div>

      {error && <p className={ds.formError}>{error}</p>}
      {message && <p className={ds.formInfo}>{message}</p>}

      <div className={styles.list}>
        {permissions.map((perm) => {
          const holders = grants.filter((g) => g.permission === perm.name);
          const holderIds = new Set(holders.map((g) => g.profile_id));
          return (
            <div key={perm.name} className={`${ds.card} ${styles.perm}`}>
              <div>
                <div className={ds.cardTitle}>{perm.description}</div>
                <div className={styles.permName}>{perm.name}</div>
              </div>

              {holders.length ? (
                <div className={styles.holders}>
                  {holders.map((g) => (
                    <span key={g.profile_id} className={styles.holder}>
                      {label(byId.get(g.profile_id))}
                      <small>depuis le {new Date(g.granted_at).toLocaleDateString('fr-FR')}</small>
                      <button type="button" className={styles.remove} disabled={busy} onClick={() => change('DELETE', g.profile_id, perm.name)}>
                        Retirer
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>Personne n’a ce droit.</p>
              )}

              <div className={styles.add}>
                <label className={ds.field}>
                  <span>Donner ce droit à</span>
                  <select className={ds.input} value={picked[perm.name] ?? ''} onChange={(e) => setPicked((c) => ({ ...c, [perm.name]: e.target.value }))}>
                    <option value="">Choisir un profil…</option>
                    {profiles.filter((p) => !holderIds.has(p.id)).map((p) => (
                      <option key={p.id} value={p.id}>
                        {label(p)}{p.riot_id && p.discord_name ? ` · ${p.riot_id}` : ''}{p.is_admin ? ' · admin' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className={ds.btnPrimary} disabled={busy || !picked[perm.name]} onClick={() => change('POST', picked[perm.name], perm.name)}>
                  Donner
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
