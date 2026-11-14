'use client';

import { useCallback, useEffect, useState } from 'react';
import ds from '@/app/components/ds/ds.module.css';
import { RARITIES, RARITY_LABELS } from '@/lib/tcg/cards';
import {
  BOOSTER_TYPES,
  BOOSTER_TYPE_LABELS,
  EMPTY_BOOSTER,
  boosterImage,
  rateKey,
  ratesTotal,
  type TcgBooster,
} from '@/lib/tcg/boosters';
import styles from './tcgAdmin.module.css';

type Profile = { id: string; discord_name: string | null };

export default function BoostersAdmin({ authHeaders }: { authHeaders: () => Promise<Record<string, string>> }) {
  const [boosters, setBoosters] = useState<TcgBooster[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unopened, setUnopened] = useState<Record<number, number>>({});
  const [form, setForm] = useState<TcgBooster>(EMPTY_BOOSTER);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [give, setGive] = useState({ booster_id: '', quantity: 1, profile_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tcg/boosters', { cache: 'no-store', headers: await authHeaders() });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setBoosters(json.boosters);
      setProfiles(json.profiles);
      setUnopened(json.unopened);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof TcgBooster>(key: K, value: TcgBooster[K]) => setForm((current) => ({ ...current, [key]: value }));
  const total = ratesTotal(form);

  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: await authHeaders(), body: body ? JSON.stringify(body) : undefined });
    const json = await response.json();
    if (!json.success) throw new Error(json.message);
    return json;
  }

  async function run(action: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await action());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await call(editingId ? `/api/admin/tcg/boosters/${editingId}` : '/api/admin/tcg/boosters', editingId ? 'PATCH' : 'POST', form);
      const done = editingId ? 'Booster modifié.' : 'Booster créé.';
      setForm(EMPTY_BOOSTER);
      setEditingId(null);
      return done;
    });

  const remove = (booster: TcgBooster) => {
    if (!booster.id || !window.confirm(`Supprimer le booster « ${booster.name} » ? Les exemplaires non ouverts disparaissent, les cartes déjà tirées restent.`)) return;
    void run(async () => {
      await call(`/api/admin/tcg/boosters/${booster.id}`, 'DELETE');
      return 'Booster supprimé.';
    });
  };

  const distribute = () => {
    const target = give.profile_id ? profiles.find((p) => p.id === give.profile_id)?.discord_name || 'ce profil' : `tous les profils (${profiles.length})`;
    if (!give.profile_id && !window.confirm(`Donner ${give.quantity} booster(s) à ${target} ?`)) return;
    void run(async () => {
      const json = await call('/api/admin/tcg/boosters/give', 'POST', { ...give, profile_id: give.profile_id || null });
      return `${give.quantity} booster(s) donné(s) à ${json.served} profil(s).`;
    });
  };

  return (
    <>
      <div className={styles.editor}>
        <div className={`${ds.card} ${styles.form}`}>
          <div className={ds.cardTitle}>{editingId ? 'Modifier le booster' : 'Créer un booster'}</div>

          <div className={styles.row}>
            <label className={ds.field}>
              <span>Nom</span>
              <input className={ds.input} value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="Booster Saison 1" />
            </label>
            <label className={ds.field}>
              <span>Cartes contenues</span>
              <select className={ds.input} value={form.card_type} onChange={(e) => set('card_type', e.target.value as TcgBooster['card_type'])}>
                {BOOSTER_TYPES.map((type) => <option key={type} value={type}>{BOOSTER_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={ds.field}>
              <span>Cartes par booster (1 à 10)</span>
              <input className={ds.input} type="number" min={1} max={10} value={form.cards_per_pack} onChange={(e) => set('cards_per_pack', Number(e.target.value))} />
            </label>
            <label className={ds.field}>
              <span>Illustration (facultatif, URL Cloudinary)</span>
              <input className={ds.input} value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value || null)} placeholder="Vide = sachet CZF par défaut" />
            </label>
          </div>

          <div className={ds.field}>
            <span>Chances de tirage par carte (%) · total {total} %</span>
            <div className={styles.rates}>
              {RARITIES.map((rarity) => (
                <label key={rarity} className={ds.field}>
                  <span>{RARITY_LABELS[rarity]}</span>
                  <input
                    className={ds.input}
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form[rateKey(rarity)]}
                    onChange={(e) => set(rateKey(rarity), Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
            {Math.abs(total - 100) > 0.001 && <p className={ds.formError}>Le total doit faire 100 %.</p>}
          </div>

          <label className={styles.check}>
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            Actif (peut être distribué)
          </label>

          <div className={ds.formActions}>
            <button type="button" className={ds.btnPrimary} onClick={save} disabled={busy}>
              {editingId ? 'Enregistrer' : 'Créer le booster'}
            </button>
            {editingId && (
              <button type="button" className={ds.btnOutline} onClick={() => { setForm(EMPTY_BOOSTER); setEditingId(null); }}>
                Annuler
              </button>
            )}
          </div>
        </div>

        <div className={styles.preview}>
          <img className={styles.boosterImg} src={boosterImage(form)} alt="" />
        </div>
      </div>

      <div className={`${ds.card} ${styles.form}`} style={{ marginTop: 32 }}>
        <div className={ds.cardTitle}>Distribuer des boosters</div>
        <div className={styles.giveRow}>
          <label className={ds.field}>
            <span>Booster</span>
            <select className={ds.input} value={give.booster_id} onChange={(e) => setGive({ ...give, booster_id: e.target.value })}>
              <option value="">Choisir…</option>
              {boosters.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className={ds.field}>
            <span>Quantité</span>
            <input className={ds.input} type="number" min={1} max={100} value={give.quantity} onChange={(e) => setGive({ ...give, quantity: Number(e.target.value) })} />
          </label>
          <label className={ds.field}>
            <span>À qui</span>
            <select className={ds.input} value={give.profile_id} onChange={(e) => setGive({ ...give, profile_id: e.target.value })}>
              <option value="">Tous les profils ({profiles.length})</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.discord_name || p.id}</option>)}
            </select>
          </label>
          <button type="button" className={ds.btnPrimary} onClick={distribute} disabled={busy || !give.booster_id}>
            Donner
          </button>
        </div>
      </div>

      {error && <p className={ds.formError}>{error}</p>}
      {message && <p className={ds.formInfo}>{message}</p>}

      <div className={ds.sectionLabel} style={{ marginTop: 48 }}>Boosters · {boosters.length}</div>
      {!boosters.length && <p className={ds.empty}>Aucun booster pour l’instant.</p>}
      <div className={styles.list}>
        {boosters.map((booster) => (
          <div key={booster.id} className={styles.item}>
            <img className={styles.boosterImg} src={boosterImage(booster, 300)} alt="" style={{ opacity: booster.active ? 1 : 0.45 }} />
            <div className={styles.itemMeta}>
              {booster.name} · {BOOSTER_TYPE_LABELS[booster.card_type]} · {booster.cards_per_pack} cartes{!booster.active && ' · inactif'}
            </div>
            <div className={styles.itemMeta}>
              {RARITIES.map((rarity) => `${RARITY_LABELS[rarity]} ${Number(booster[rateKey(rarity)])} %`).join(' · ')}
            </div>
            <div className={styles.itemMeta}>Non ouverts chez les joueurs : {unopened[booster.id ?? 0] || 0}</div>
            <div className={styles.itemActions}>
              <button
                type="button"
                className={`${ds.btnOutline} ${ds.btnSmall}`}
                onClick={() => { setForm({ ...booster, rate_commune: Number(booster.rate_commune), rate_rare: Number(booster.rate_rare), rate_epique: Number(booster.rate_epique), rate_legendaire: Number(booster.rate_legendaire) }); setEditingId(booster.id ?? null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                Modifier
              </button>
              <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => remove(booster)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
