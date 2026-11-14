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
import GiveBoostersModal, { type GiveProfile, type GiveTeam } from './GiveBoostersModal';
import styles from './tcgAdmin.module.css';

export default function BoostersAdmin({ authHeaders }: { authHeaders: () => Promise<Record<string, string>> }) {
  const [boosters, setBoosters] = useState<TcgBooster[]>([]);
  const [profiles, setProfiles] = useState<GiveProfile[]>([]);
  const [teams, setTeams] = useState<GiveTeam[]>([]);
  const [seasons, setSeasons] = useState<{ id: number; name: string; status: string }[]>([]);
  const [unopened, setUnopened] = useState<Record<number, number>>({});
  const [form, setForm] = useState<TcgBooster>(EMPTY_BOOSTER);
  const [editingId, setEditingId] = useState<number | null>(null);
  // null = pop-in fermée ; sinon booster présélectionné (0 = aucun).
  const [giving, setGiving] = useState<number | null>(null);
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
      setTeams(json.teams);
      setSeasons(json.seasons || []);
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
  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0];
  const seasonName = (id?: number | null) => seasons.find((s) => s.id === id)?.name ?? '';

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

  async function give(payload: { booster_id: number; quantity: number; profile_ids: string[]; all: boolean }) {
    const json = await call('/api/admin/tcg/boosters/give', 'POST', payload);
    setError('');
    setMessage(`${payload.quantity} booster(s) donné(s) à ${json.served} joueur(s).`);
    await load();
  }

  return (
    <>
      <div className={styles.editor}>
        <div className={`${ds.card} ${styles.form}`}>
          <div className={ds.cardTitle}>{editingId ? 'Modifier le booster' : 'Créer un booster'}</div>

          <label className={ds.field}>
            <span>Saison (le booster ne tire que des cartes de cette saison)</span>
            <select className={ds.input} value={form.season_id ?? activeSeason?.id ?? ''} onChange={(e) => set('season_id', Number(e.target.value))}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (en cours)' : ''}</option>)}
            </select>
          </label>

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
              <span>Cartes par booster</span>
              <input className={ds.input} type="number" min={1} max={100} value={form.cards_per_pack} onChange={(e) => set('cards_per_pack', Number(e.target.value))} />
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

      {error && <p className={ds.formError}>{error}</p>}
      {message && <p className={ds.formInfo}>{message}</p>}

      <div className={styles.listHead}>
        <div className={ds.sectionLabel}>Boosters · {boosters.length}</div>
        <button type="button" className={ds.btnPrimary} onClick={() => setGiving(0)} disabled={!boosters.some((b) => b.active)}>
          Distribuer des boosters
        </button>
      </div>
      {!boosters.length && <p className={ds.empty}>Aucun booster pour l’instant.</p>}
      <div className={styles.list}>
        {boosters.map((booster) => (
          <div key={booster.id} className={styles.item}>
            <img className={styles.boosterImg} src={boosterImage(booster, 300)} alt="" style={{ opacity: booster.active ? 1 : 0.45 }} />
            <div className={styles.itemMeta}>
              {booster.name} · {seasonName(booster.season_id)} · {BOOSTER_TYPE_LABELS[booster.card_type]} · {booster.cards_per_pack} cartes{!booster.active && ' · inactif'}
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
              {booster.active && (
                <button type="button" className={`${ds.btnPrimary} ${ds.btnSmall}`} onClick={() => setGiving(booster.id ?? 0)}>Donner</button>
              )}
              <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => remove(booster)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      {giving !== null && (
        <GiveBoostersModal
          boosters={boosters}
          profiles={profiles}
          teams={teams}
          initialBoosterId={giving || null}
          onClose={() => setGiving(null)}
          onGive={give}
        />
      )}
    </>
  );
}
