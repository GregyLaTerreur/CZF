'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import CardFilters, { ShowMore, useCardFilters } from '@/app/components/tcg/CardFilters';
import { DIVISIONS } from '@/app/components/home/divisions';
import { DDRAGON_FALLBACK } from '@/app/components/ds/lol';
import { isAllowedLogoUrl } from '@/lib/logo';
import {
  CARD_ROLES,
  CARD_TYPES,
  CARD_TYPE_LABELS,
  EMPTY_CARD,
  RARITY_LABELS,
  STAT_LABELS,
  TYPE_FIELDS,
  TYPE_RARITIES,
  type TcgCard,
} from '@/lib/tcg/cards';
import BoostersAdmin from './BoostersAdmin';
import styles from './tcgAdmin.module.css';

type Champion = { id: string; name: string };
type Season = { id: number; name: string; status: string };
type LinkPlayer = {
  id: number; riot_id: string; role: string | null; team_name: string | null;
  team_logo: string | null; division: string | null; champions: string[];
};

const fixed = (value: unknown, digits: number) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '');

const asCard = (card: TcgCard) => card;

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
    live_stats: undefined,
    team_name: card.team_name ?? '',
    team_logo: card.team_logo ?? '',
    stats: STAT_LABELS.map((label) => ({ label, value: card.stats.find((stat) => stat.label === label)?.value ?? '' })),
  };
}

export default function TcgAdminView() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'cartes' | 'boosters'>('cartes');
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [players, setPlayers] = useState<LinkPlayer[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [linking, setLinking] = useState(false);
  // Formulaire replié tant qu'on ne crée ou ne modifie pas une carte.
  const [formOpen, setFormOpen] = useState(false);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [form, setForm] = useState<TcgCard>(EMPTY_CARD);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const cardFilters = useCardFilters(cards, asCard, seasons);
  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0];

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tcg', { cache: 'no-store', headers: await authHeaders() });
      const json = await response.json();
      if (response.status === 401 || response.status === 403) return setIsAdmin(false);
      setIsAdmin(true);
      if (!json.success) throw new Error(json.message);
      setCards(json.cards);
      setSeasons(json.seasons || []);
    } catch (err) {
      setIsAdmin((current) => current ?? false);
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Joueurs à lier aux cartes (chargés une fois, quand l'accès admin est confirmé).
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const response = await fetch('/api/admin/tcg/players', { cache: 'no-store', headers: await authHeaders() });
      const json = await response.json();
      if (json.success) setPlayers(json.players);
    })().catch(() => {});
  }, [isAdmin]);

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

  // Changer de type ramène la rareté sur une valeur autorisée (joueur = commune, MVP = rare par défaut).
  function changeType(cardType: TcgCard['card_type']) {
    setForm((current) => ({
      ...current,
      card_type: cardType,
      rarity: TYPE_RARITIES[cardType].includes(current.rarity) ? current.rarity : TYPE_RARITIES[cardType][0],
    }));
  }

  // Lie la carte à un joueur et remplit pseudo, équipe, logo, rôle, division, champion et stats CZF.
  async function linkPlayer(player: LinkPlayer) {
    setLinking(true);
    setError('');
    setPlayerSearch('');

    let stats = form.stats;
    try {
      const json = await fetch(`/api/ext/joueurs?id_player=${player.id}`, { cache: 'no-store' }).then((res) => res.json());
      const line = json.joueurs?.[0];
      stats = STAT_LABELS.map((label) => ({ label, value: '' }));
      if (line?.games) {
        stats = [
          { label: 'KDA', value: fixed(line.kda, 1) },
          { label: 'KP%', value: fixed(line.killParticipation, 0) },
          { label: 'DPM', value: fixed(line.dpm, 0) },
          { label: 'VIS/M', value: fixed(line.visionPerMin, 1) },
          { label: 'WR%', value: fixed(line.winrate, 0) },
        ];
      } else {
        setMessage(`${player.riot_id} n’a pas encore de games CZF : stats à remplir à la main.`);
      }
    } catch {
      setError('Stats CZF indisponibles : le reste est rempli.');
    }

    setForm((current) => ({
      ...current,
      player_id: player.id,
      card_type: current.card_type === 'simple' ? 'joueur' : current.card_type,
      rarity: current.card_type === 'simple' ? 'commune' : current.rarity,
      name: player.riot_id.split('#')[0].slice(0, 40),
      team_name: player.team_name ?? '',
      team_logo: player.team_logo && isAllowedLogoUrl(player.team_logo) ? player.team_logo : '',
      role: player.role,
      division: (player.division as TcgCard['division']) ?? null,
      champion: player.champions[0] ?? current.champion,
      stats,
    }));
    setLinking(false);
  }

  const linkedPlayer = players.find((p) => p.id === form.player_id);
  const playerResults = playerSearch.trim().length < 2
    ? []
    : players.filter((p) => `${p.riot_id} ${p.team_name ?? ''}`.toLowerCase().includes(playerSearch.trim().toLowerCase())).slice(0, 8);

  function reset() {
    setForm(EMPTY_CARD);
    setEditingId(null);
    setError('');
    setFormOpen(false);
  }

  function openCreate() {
    setForm(EMPTY_CARD);
    setEditingId(null);
    setError('');
    setMessage('');
    setFormOpen(true);
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
    setFormOpen(true);
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

      {!formOpen && (
        <div className={styles.createBar}>
          <button type="button" className={ds.btnPrimary} onClick={openCreate}>Créer une carte</button>
          {message && <p className={ds.formInfo}>{message}</p>}
        </div>
      )}

      {formOpen && (
      <div className={styles.editor}>
        <div className={`${ds.card} ${styles.form}`}>
          <div className={ds.cardTitle}>{editingId ? 'Modifier la carte' : 'Créer une carte'}</div>
          <div className={ds.field}>
            <span>Lier un joueur (remplit tout depuis ses données et ses stats CZF)</span>
            {linkedPlayer ? (
              <div className={styles.linked}>
                <b>{linkedPlayer.riot_id}</b>
                {linkedPlayer.team_name && <span>{linkedPlayer.team_name}</span>}
                <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => linkPlayer(linkedPlayer)} disabled={linking}>
                  {linking ? 'Chargement…' : 'Recharger ses données'}
                </button>
                <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => set('player_id', null)}>Délier</button>
              </div>
            ) : (
              <div className={styles.playerSearch}>
                <input className={ds.input} value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Riot ID ou équipe (2 lettres min.)" />
                {playerResults.length > 0 && (
                  <div className={styles.playerResults}>
                    {playerResults.map((p) => (
                      <button key={p.id} type="button" className={styles.playerResult} onClick={() => linkPlayer(p)}>
                        <b>{p.riot_id}</b>
                        <span>{[p.team_name, p.role, p.division].filter(Boolean).join(' · ') || 'Sans équipe'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <label className={ds.field}>
            <span>Saison</span>
            <select className={ds.input} value={form.season_id ?? activeSeason?.id ?? ''} onChange={(e) => set('season_id', Number(e.target.value))}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (en cours)' : ''}</option>)}
            </select>
          </label>

          <div className={styles.row}>
            <label className={ds.field}>
              <span>Type</span>
              <select className={ds.input} value={form.card_type} onChange={(e) => changeType(e.target.value as TcgCard['card_type'])}>
                {CARD_TYPES.map((type) => <option key={type} value={type}>{CARD_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className={ds.field}>
              <span>Rareté</span>
              <select className={ds.input} value={form.rarity} onChange={(e) => set('rarity', e.target.value as TcgCard['rarity'])}>
                {TYPE_RARITIES[form.card_type].map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</option>)}
              </select>
            </label>
          </div>
          <p className={styles.hint}>
            {form.card_type === 'simple' && 'Carte simple : toutes raretés, seulement le nom et le personnage.'}
            {form.card_type === 'joueur' && 'Carte joueur : toujours Commune. Équipe, rôle, division et stats, sans note.'}
            {form.card_type === 'mvp' && 'Carte MVP : Rare ou Épique (Légendaire sur décision). Comme une carte joueur, avec la note.'}
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
              <span>
                {form.card_type === 'joueur' && form.player_id
                  ? 'Stats en direct : recalculées depuis ses games CZF à chaque affichage (ces valeurs ne servent que s’il n’a pas encore joué)'
                  : 'Stats figées (facultatif, cases vides masquées)'}
              </span>
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
            <button type="button" className={ds.btnOutline} onClick={reset}>Annuler</button>
          </div>
        </div>

        <div className={styles.preview}>
          <PlayerCard card={{ ...form, name: form.name || 'Pseudo' }} />
        </div>
      </div>
      )}

      <div className={ds.sectionLabel} style={{ marginTop: 48 }}>Cartes créées · {cards.length}</div>
      {!cards.length && <p className={ds.empty}>Aucune carte pour l’instant.</p>}
      {cards.length > 0 && <CardFilters {...cardFilters} total={cards.length} />}
      {cards.length > 0 && !cardFilters.filtered.length && <p className={ds.empty}>Aucune carte avec ces filtres.</p>}
      <div className={styles.list}>
        {cardFilters.visible.map((card) => (
          <div key={card.id} className={styles.item}>
            <PlayerCard card={card} />
            <div className={styles.itemMeta}>{CARD_TYPE_LABELS[card.card_type]} · {RARITY_LABELS[card.rarity]}{seasons.length > 1 ? ` · ${seasons.find((s) => s.id === card.season_id)?.name ?? ''}` : ''}</div>
            <div className={styles.itemActions}>
              <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => edit(card)}>Modifier</button>
              <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => remove(card)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
      <ShowMore hasMore={cardFilters.hasMore} showMore={cardFilters.showMore} shown={cardFilters.visible.length} total={cardFilters.filtered.length} />
      </>
      )}
    </div>
  );
}
