'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import { DIVISIONS } from '@/app/components/home/divisions';
import { DDRAGON_FALLBACK } from '@/app/components/ds/lol';
import {
  CARD_ROLES,
  CARD_TYPES,
  CARD_TYPE_LABELS,
  EMPTY_CARD,
  RARITIES,
  RARITY_LABELS,
  STAT_LABELS,
  TYPE_FIELDS,
  type TcgCard,
} from '@/lib/tcg/cards';
import BoostersAdmin from './BoostersAdmin';
import styles from './tcgAdmin.module.css';

type Champion = { id: string; name: string };

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Reconnecte-toi avec Discord.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

// Formulaire toujours rempli : les stats vides gardent leurs 5 cases.
function toForm(card: TcgCard): TcgCard {
  return {
    ...EMPTY_CARD,
    ...card,
    team_name: card.team_name ?? '',
    team_logo: card.team_logo ?? '',
    stats: STAT_LABELS.map((label) => ({ label, value: card.stats.find((stat) => stat.label === label)?.value ?? '' })),
  };
}

export default function TcgAdminView() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'cartes' | 'boosters'>('cartes');
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [form, setForm] = useState<TcgCard>(EMPTY_CARD);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tcg', { cache: 'no-store', headers: await authHeaders() });
      const json = await response.json();
      if (response.status === 401 || response.status === 403) return setIsAdmin(false);
      setIsAdmin(true);
      if (!json.success) throw new Error(json.message);
      setCards(json.cards);
    } catch (err) {
      setIsAdmin((current) => current ?? false);
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Liste des champions depuis Data Dragon (noms en français).
  useEffect(() => {
    (async () => {
      const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((res) => res.json()).catch(() => []);
      const version = versions[0] || DDRAGON_FALLBACK;
      const json = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`).then((res) => res.json());
      const list = Object.values(json.data as Record<string, Champion>).map(({ id, name }) => ({ id, name }));
      setChampions(list.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    })().catch(() => setError('Impossible de charger la liste des champions.'));
  }, []);

  const set = <K extends keyof TcgCard>(key: K, value: TcgCard[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fields = TYPE_FIELDS[form.card_type];

  function reset() {
    setForm(EMPTY_CARD);
    setEditingId(null);
    setError('');
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(editingId ? `/api/admin/tcg/${editingId}` : '/api/admin/tcg', {
        method: editingId ? 'PATCH' : 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setMessage(editingId ? 'Carte modifiée.' : 'Carte créée.');
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(card: TcgCard) {
    if (!card.id || !window.confirm(`Supprimer la carte de ${card.name} ? Elle disparaît aussi des collections des joueurs.`)) return;

    try {
      const response = await fetch(`/api/admin/tcg/${card.id}`, { method: 'DELETE', headers: await authHeaders() });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      if (editingId === card.id) reset();
      setMessage('Carte supprimée.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    }
  }

  function edit(card: TcgCard) {
    setForm(toForm(card));
    setEditingId(card.id ?? null);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (isAdmin === null) return <div className={`${ds.container} ${styles.wrap}`}><p className={ds.empty}>Chargement…</p></div>;

  if (!isAdmin) {
    return (
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Administration</div>
        <h1 className={ds.h1}>Gérer le TCG</h1>
        <p className={ds.body}>Accès réservé aux admins.</p>
      </div>
    );
  }

  return (
    <div className={`${ds.container} ${styles.wrap}`}>
      <div className={styles.top}>
        <div>
          <div className={ds.sectionLabel}>Administration · TCG</div>
          <h1 className={ds.h1}>Gérer le TCG</h1>
        </div>
        <Link href="/admin" className={`${ds.btnOutline} ${ds.btnSmall}`}>Retour admin</Link>
      </div>

      <div className={`${ds.tabs} ${styles.tabs}`}>
        <button type="button" className={tab === 'cartes' ? ds.tabActive : ds.tab} onClick={() => setTab('cartes')}>Cartes · {cards.length}</button>
        <button type="button" className={tab === 'boosters' ? ds.tabActive : ds.tab} onClick={() => setTab('boosters')}>Boosters</button>
      </div>

      {tab === 'boosters' ? <BoostersAdmin authHeaders={authHeaders} /> : (
      <>

      <div className={styles.editor}>
        <div className={`${ds.card} ${styles.form}`}>
          <div className={ds.cardTitle}>{editingId ? 'Modifier la carte' : 'Créer une carte'}</div>
          <div className={styles.row}>
            <label className={ds.field}>
              <span>Type</span>
              <select className={ds.input} value={form.card_type} onChange={(e) => set('card_type', e.target.value as TcgCard['card_type'])}>
                {CARD_TYPES.map((type) => <option key={type} value={type}>{CARD_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className={ds.field}>
              <span>Rareté</span>
              <select className={ds.input} value={form.rarity} onChange={(e) => set('rarity', e.target.value as TcgCard['rarity'])}>
                {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</option>)}
              </select>
            </label>
          </div>
          <p className={styles.hint}>
            {form.card_type === 'simple' && 'Carte simple : seulement le nom et le personnage.'}
            {form.card_type === 'joueur' && 'Carte joueur : équipe, rôle, division et stats, sans note.'}
            {form.card_type === 'mvp' && 'Carte MVP : comme une carte joueur, avec la note.'}
          </p>

          <div className={styles.row}>
            <label className={ds.field}>
              <span>Pseudo</span>
              <input className={ds.input} value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="Mousstiiic" />
            </label>
            <label className={ds.field}>
              <span>Personnage</span>
              <select className={ds.input} value={form.champion} onChange={(e) => set('champion', e.target.value)}>
                {!champions.length && <option value={form.champion}>{form.champion}</option>}
                {champions.map((champ) => <option key={champ.id} value={champ.id}>{champ.name}</option>)}
              </select>
            </label>
          </div>

          <label className={ds.field}>
            <span>Illustration perso (facultatif, URL Cloudinary)</span>
            <input className={ds.input} value={form.art_url ?? ''} onChange={(e) => set('art_url', e.target.value || null)} placeholder="Vide = artwork Riot du personnage" />
          </label>

          {fields.team && (
            <>
              <div className={styles.row}>
                <label className={ds.field}>
                  <span>Équipe</span>
                  <input className={ds.input} value={form.team_name ?? ''} maxLength={40} onChange={(e) => set('team_name', e.target.value)} />
                </label>
                <label className={ds.field}>
                  <span>Logo de l’équipe (URL)</span>
                  <input className={ds.input} value={form.team_logo ?? ''} onChange={(e) => set('team_logo', e.target.value)} placeholder="https://i.imgur.com/…" />
                </label>
              </div>

              <div className={styles.row}>
                <label className={ds.field}>
                  <span>Rôle</span>
                  <select className={ds.input} value={form.role ?? ''} onChange={(e) => set('role', e.target.value || null)}>
                    <option value="">Aucun</option>
                    {CARD_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className={ds.field}>
                  <span>Division</span>
                  <select className={ds.input} value={form.division ?? ''} onChange={(e) => set('division', (e.target.value || null) as TcgCard['division'])}>
                    <option value="">Aucune</option>
                    {DIVISIONS.map((division) => <option key={division} value={division}>{division}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          {fields.note && (
            <label className={ds.field}>
              <span>Note MVP (0 à 99)</span>
              <input
                className={ds.input}
                type="number"
                min={0}
                max={99}
                value={form.note ?? ''}
                onChange={(e) => set('note', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>
          )}

          {fields.stats && (
            <div className={ds.field}>
              <span>Stats (facultatif, cases vides masquées)</span>
              <div className={styles.stats}>
                {form.stats.map((stat, index) => (
                  <label key={stat.label} className={ds.field}>
                    <span>{stat.label}</span>
                    <input
                      className={ds.input}
                      value={stat.value}
                      maxLength={8}
                      onChange={(e) => set('stats', form.stats.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className={ds.formError}>{error}</p>}
          {message && <p className={ds.formInfo}>{message}</p>}

          <div className={ds.formActions}>
            <button type="button" className={ds.btnPrimary} onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la carte'}
            </button>
            {editingId && <button type="button" className={ds.btnOutline} onClick={reset}>Annuler</button>}
          </div>
        </div>

        <div className={styles.preview}>
          <PlayerCard card={{ ...form, name: form.name || 'Pseudo' }} />
        </div>
      </div>

      <div className={ds.sectionLabel} style={{ marginTop: 48 }}>Cartes créées · {cards.length}</div>
      {!cards.length && <p className={ds.empty}>Aucune carte pour l’instant.</p>}
      <div className={styles.list}>
        {cards.map((card) => (
          <div key={card.id} className={styles.item}>
            <PlayerCard card={card} />
            <div className={styles.itemMeta}>{CARD_TYPE_LABELS[card.card_type]} · {RARITY_LABELS[card.rarity]}</div>
            <div className={styles.itemActions}>
              <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => edit(card)}>Modifier</button>
              <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => remove(card)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
