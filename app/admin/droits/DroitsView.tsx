'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import Switch from '@/app/components/ds/Switch';
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

// Droits d'admin nommés : on choisit un profil, puis on active / désactive chaque droit. Superadmins seulement.
export default function DroitsView() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

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

  // Profils qui ont au moins un droit, pour les retrouver vite.
  const withGrants = useMemo(() => new Set(grants.map((g) => g.profile_id)), [grants]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((p) => !q || `${p.discord_name ?? ''} ${p.riot_id ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => Number(withGrants.has(b.id)) - Number(withGrants.has(a.id)) || label(a).localeCompare(label(b), 'fr'))
      .slice(0, 12);
  }, [profiles, search, withGrants]);

  const selected = profiles.find((p) => p.id === profileId);
  const owned = new Map(grants.filter((g) => g.profile_id === profileId).map((g) => [g.permission, g]));

  async function toggle(permission: string, on: boolean) {
    if (!profileId || saving) return;
    setSaving(permission);
    setError('');
    try {
      const response = await fetch('/api/admin/grants', {
        method: on ? 'POST' : 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ profile_id: profileId, permission }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setSaving(null);
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

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={styles.top}>
        <div>
          <div className={ds.sectionLabel}>Administration · Superadmin</div>
          <h1 className={ds.h1}>Droits</h1>
        </div>
      </div>

      {error && <p className={ds.formError}>{error}</p>}

      <div className={styles.layout}>
        {/* 1. Choisir un profil */}
        <div className={`${ds.card} ${styles.picker}`}>
          <label className={ds.field}>
            <span>Profil</span>
            <input className={ds.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pseudo Discord ou Riot ID" />
          </label>
          <div className={styles.results}>
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === profileId ? styles.resultOn : styles.result}
                onClick={() => setProfileId(p.id)}
              >
                <b>{label(p)}</b>
                <span>
                  {[p.riot_id && p.discord_name ? p.riot_id : null, p.is_admin ? 'admin' : null, withGrants.has(p.id) ? 'a des droits' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            ))}
            {!results.length && <p className={styles.empty}>Aucun profil trouvé.</p>}
          </div>
        </div>

        {/* 2. Ses droits, à activer / désactiver */}
        <div className={`${ds.card} ${styles.table}`}>
          {!selected ? (
            <p className={styles.empty}>Choisis un profil pour voir et modifier ses droits.</p>
          ) : (
            <>
              <div className={styles.tableHead}>
                <div className={ds.cardTitle}>{label(selected)}</div>
                {!selected.is_admin && <span className={styles.warn}>Pas admin : ses droits ne serviront qu’une fois admin.</span>}
              </div>
              {permissions.map((perm) => {
                const grant = owned.get(perm.name);
                return (
                  <div key={perm.name} className={styles.row}>
                    <div>
                      <b>{perm.description}</b>
                      <span>
                        {perm.name}
                        {grant ? ` · depuis le ${new Date(grant.granted_at).toLocaleDateString('fr-FR')}` : ''}
                      </span>
                    </div>
                    <Switch
                      label={grant ? 'Oui' : 'Non'}
                      checked={Boolean(grant)}
                      disabled={saving !== null}
                      onChange={(on) => toggle(perm.name, on)}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
