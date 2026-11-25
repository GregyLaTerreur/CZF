'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import CardZoom from '@/app/components/tcg/CardZoom';
import PlayerCard from '@/app/components/tcg/PlayerCard';
import CardFilters, { ShowMore, useCardFilters } from '@/app/components/tcg/CardFilters';
import { DIVISIONS } from '@/app/components/home/divisions';
import { DDRAGON_FALLBACK } from '@/app/components/ds/lol';
import { isAllowedLogoUrl } from '@/lib/logo';
import {
  CARD_ROLES,
  CARD_TYPES,
  CARD_TYPE_LABELS,
  ART_DEFAULT,
  EMPTY_CARD,
  DEFAULT_NOTE,
  isRealSkin,
  RARITY_LABELS,
  RARITIES,
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
  // Choix du joueur par saison (sinon champion le plus maîtrisé = champions[0]).
  choices: Record<number, { champion: string; skin_num: number; is_default: boolean }>;
};
type Skin = { num: number; name: string; parentSkin?: number };

const fixed = (value: unknown, digits: number) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '');

const asCard = (card: TcgCard) => card;
// Même ordre que la collection : des plus rares aux plus communes, puis par numéro.
const byRarity = (a: TcgCard, b: TcgCard) =>
  RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || (a.number ?? 1e9) - (b.number ?? 1e9);

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
    number: undefined,
    season_total: undefined,
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
  // Saisons à numérotation figée (null : SQL tcg-8 pas encore passé).
  const [numbering, setNumbering] = useState<{ season_id: number; total: number; frozen_at: string }[] | null>([]);
  const [freezing, setFreezing] = useState(false);
  // Droit tcg.refiger_numeros : le bouton reste cliquable même une fois la saison figée.
  const [canRefreeze, setCanRefreeze] = useState(false);
  // Carte de la liste affichée en grand.
  const [zoom, setZoom] = useState<TcgCard | null>(null);
  // Saisons dont la collection est lancée (choix des joueurs verrouillés). null = SQL tcg-11 absent.
  const [launches, setLaunches] = useState<{ season_id: number; launched_at: string }[] | null>([]);
  const [launching, setLaunching] = useState(false);
  const [ddVersion, setDdVersion] = useState(DDRAGON_FALLBACK);
  const [skins, setSkins] = useState<Skin[]>([]);
  // Cadrages déjà réglés, par champion + skin + rareté (partagés entre les cartes).
  const [framings, setFramings] = useState<{ champion: string; skin_num: number; rarity: string; art_x: number; art_y: number; art_zoom: number }[]>([]);
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
  const sortedCards = useMemo(() => [...cards].sort(byRarity), [cards]);
  const cardFilters = useCardFilters(sortedCards, asCard, seasons);
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
      setNumbering(json.numbering ?? null);
      setCanRefreeze(json.canRefreeze === true);
      setLaunches(json.launches ?? null);
      setFramings(json.framings ?? []);
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
      setDdVersion(version);
      const json = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`).then((res) => res.json());
      const list = Object.values(json.data as Record<string, Champion>).map(({ id, name }) => ({ id, name }));
      setChampions(list.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    })().catch(() => setError('Impossible de charger la liste des champions.'));
  }, []);

  // Skins du champion choisi (Data Dragon, noms en français).
  useEffect(() => {
    let alive = true;
    setSkins([]);
    fetch(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/fr_FR/champion/${form.champion}.json`)
      .then((res) => res.json())
      .then((json) => {
        const list: Skin[] = (json?.data?.[form.champion]?.skins ?? []).filter(isRealSkin).map((sk: Skin) => ({ num: sk.num, name: sk.name === 'default' ? 'Skin de base' : sk.name }));
        if (alive) setSkins(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [form.champion, ddVersion]);

  // Même perso + skin + rareté qu'une carte déjà cadrée : on reprend son cadrage.
  const framingKey = `${form.champion}|${form.skin_num ?? 0}|${form.rarity}`;
  const lastFramingKey = useRef('');
  useEffect(() => {
    if (lastFramingKey.current === framingKey || form.art_url) return;
    lastFramingKey.current = framingKey;
    const known = framings.find((f) => `${f.champion}|${f.skin_num}|${f.rarity}` === framingKey);
    if (known) setForm((c) => ({ ...c, art_x: Number(known.art_x), art_y: Number(known.art_y), art_zoom: Number(known.art_zoom) }));
  }, [framingKey, framings, form.art_url]);
  const sharedFraming = !form.art_url && framings.some((f) => `${f.champion}|${f.skin_num}|${f.rarity}` === framingKey);

  const set = <K extends keyof TcgCard>(key: K, value: TcgCard[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fields = TYPE_FIELDS[form.card_type];

  // Changer de type ramène la rareté sur une valeur autorisée (joueur = commune, MVP = rare par défaut).
  function changeType(cardType: TcgCard['card_type']) {
    setForm((current) => ({
      ...current,
      card_type: cardType,
      rarity: TYPE_RARITIES[cardType].includes(current.rarity) ? current.rarity : TYPE_RARITIES[cardType][0],
      // Note MVP pré-remplie à 99 en attendant la vraie note.
      note: cardType === 'mvp' && current.note === null ? DEFAULT_NOTE : current.note,
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
      // Choix du joueur pour la saison de la carte, sinon son champion le plus maîtrisé (skin de base).
      champion: player.choices[current.season_id ?? activeSeason?.id ?? 0]?.champion ?? player.champions[0] ?? current.champion,
      skin_num: player.choices[current.season_id ?? activeSeason?.id ?? 0]?.skin_num ?? 0,
      stats,
    }));
    setLinking(false);
  }

  const linkedPlayer = players.find((p) => p.id === form.player_id);
  const linkedChoice = linkedPlayer
    ? linkedPlayer.choices[form.season_id ?? activeSeason?.id ?? 0] ?? (linkedPlayer.champions[0] ? { champion: linkedPlayer.champions[0], skin_num: 0, is_default: true } : null)
    : null;
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
      const shared = json.reframed > 0 ? ` Cadrage appliqué aussi à ${json.reframed} autre${json.reframed > 1 ? 's' : ''} carte${json.reframed > 1 ? 's' : ''} (même perso, skin et rareté).` : '';
      setMessage(`${editingId ? 'Carte modifiée.' : 'Carte créée.'}${shared}`);
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

  // Glisser l'illustration dans l'aperçu : déplacer le point gardé au centre (sens inverse du geste).
  const artDrag = useRef<{ x: number; y: number; artX: number; artY: number; w: number; h: number } | null>(null);

  function startArtDrag(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    artDrag.current = { x: event.clientX, y: event.clientY, artX: form.art_x ?? ART_DEFAULT.x, artY: form.art_y ?? ART_DEFAULT.y, w: box.width, h: box.height };
  }

  function moveArtDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = artDrag.current;
    if (!drag) return;
    const zoom = form.art_zoom ?? 1;
    const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
    setForm((current) => ({
      ...current,
      art_x: clamp(drag.artX - ((event.clientX - drag.x) / drag.w) * 150 / zoom),
      art_y: clamp(drag.artY - ((event.clientY - drag.y) / drag.h) * 150 / zoom),
    }));
  }

  function endArtDrag() {
    artDrag.current = null;
  }

  // Fige la numérotation d'une saison : une seule fois, le bouton reste ensuite bloqué.
  async function freeze(season: Season, count: number, force = false) {
    if (freezing) return;
    const ok = force
      ? window.confirm(
          `REFIGER les numéros de « ${season.name} » ?\n\n` +
            `Les numéros de toutes les cartes de la saison sont recalculés (communes, rares, épiques, légendaires) ` +
            `et le total devient ${count}. Des cartes peuvent changer de numéro.`
        )
      : window.confirm(
      `Figer les numéros de « ${season.name} » ?\n\n` +
        `Les ${count} cartes gardent leur numéro (1 à ${count}) et le total reste ${count}. ` +
        `Une carte ajoutée ensuite prendra le numéro suivant (${count + 1}/${count}).\n\n` +
        'Ce bouton ne pourra plus être utilisé : le débloquer se fait uniquement en base.'
    );
    if (!ok) return;
    setFreezing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/tcg/freeze', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ season_id: season.id, force }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setMessage(`Numéros figés : ${json.total} cartes.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setFreezing(false);
    }
  }

  // Lance la collection d'une saison : numéros figés + choix champion/skin verrouillés, une seule fois.
  async function launch(season: Season, count: number, frozen: boolean) {
    if (launching) return;
    const ok = window.confirm(
      `Lancer la collection « ${season.name} » ?\n\n` +
        (frozen ? 'Les numéros sont déjà figés : ils ne bougent pas.\n' : `Les ${count} cartes gardent leur numéro (1 à ${count}) et le total est figé.\n`) +
        'Les joueurs ne pourront plus changer de champion ni de skin pour cette saison. ' +
        'Ceux qui n’ont pas choisi gardent leur champion le plus maîtrisé, skin de base.\n\n' +
        'Ce bouton ne pourra plus être utilisé : le débloquer se fait uniquement en base.'
    );
    if (!ok) return;
    setLaunching(true);
    setError('');
    try {
      const response = await fetch('/api/admin/tcg/launch', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ season_id: season.id }) });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setMessage(`Collection « ${season.name} » lancée. ${json.defaults} joueur(s) sans choix ont reçu leur champion le plus maîtrisé.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setLaunching(false);
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
        <p className={ds.body}>Accès réservé aux admins bêta-testeurs (le TCG est en bêta).</p>
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
      </div>

      <p className={styles.betaNote}>
        <b>Bêta</b> Le TCG n’est visible que par les bêta-testeurs (profiles.is_betatest). Les cadres, boosters et icônes « _dev » sont provisoires, en attendant le rendu de la graphiste.
      </p>

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
              <select className={ds.input} value={form.champion} onChange={(e) => setForm((c) => ({ ...c, champion: e.target.value, skin_num: 0 }))}>
                {!champions.length && <option value={form.champion}>{form.champion}</option>}
                {champions.map((champ) => <option key={champ.id} value={champ.id}>{champ.name}</option>)}
              </select>
            </label>
            <label className={ds.field}>
              <span>Skin</span>
              <select className={ds.input} value={form.skin_num ?? 0} onChange={(e) => set('skin_num', Number(e.target.value))}>
                {!skins.some((sk) => sk.num === (form.skin_num ?? 0)) && <option value={form.skin_num ?? 0}>Skin n° {form.skin_num ?? 0}</option>}
                {skins.map((sk) => <option key={sk.num} value={sk.num}>{sk.name}</option>)}
              </select>
            </label>
          </div>
          {linkedChoice && (
            <p className={styles.hint}>
              {linkedChoice.is_default
                ? `${linkedPlayer?.riot_id} n’a pas choisi : champion le plus maîtrisé par défaut.`
                : `Choix de ${linkedPlayer?.riot_id} pour cette saison : ${champions.find((c) => c.id === linkedChoice.champion)?.name ?? linkedChoice.champion}, skin n° ${linkedChoice.skin_num}.`}
            </p>
          )}

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
          {/* Cadrage de l'illustration : glisser sur la carte pour la recentrer, curseur pour zoomer. */}
          <div className={styles.artEditor}>
            <PlayerCard card={{ ...form, name: form.name || 'Pseudo' }} />
            <div
              className={styles.artDrag}
              onPointerDown={startArtDrag}
              onPointerMove={moveArtDrag}
              onPointerUp={endArtDrag}
              onPointerCancel={endArtDrag}
              title="Glisser pour recentrer l’illustration"
            />
          </div>
          <div className={styles.artTools}>
            <label className={ds.field}>
              <span>Zoom · {(form.art_zoom ?? 1).toFixed(2)}x</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={form.art_zoom ?? 1}
                onChange={(e) => set('art_zoom', Number(e.target.value))}
              />
            </label>
            <p className={styles.hint}>Glisse l’illustration sur la carte pour la recentrer.</p>
            <p className={styles.hint}>
              {sharedFraming
                ? 'Cadrage déjà réglé pour ce perso, ce skin et cette rareté : il est repris, et le modifier recadre aussi les autres cartes identiques.'
                : 'Le cadrage enregistré servira à toutes les cartes de ce perso, ce skin et cette rareté.'}
            </p>
            <button
              type="button"
              className={`${ds.btnOutline} ${ds.btnSmall}`}
              onClick={() => setForm((current) => ({ ...current, art_x: ART_DEFAULT.x, art_y: ART_DEFAULT.y, art_zoom: ART_DEFAULT.zoom }))}
            >
              Recentrer
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Lancement : fige les numéros et verrouille les choix champion/skin des joueurs, une fois par saison. */}
      <div className={ds.sectionLabel} style={{ marginTop: 48 }}>Lancement des collections</div>
      {numbering === null || launches === null ? (
        <p className={styles.hint}>Base pas à jour : lancer czf-import/tcg-8-numero-fige.sql puis tcg-11-choix-skin-lancement.sql.</p>
      ) : (
        <div className={styles.numbering}>
          {seasons.filter((season) => cards.some((card) => card.season_id === season.id)).map((season) => {
            const count = cards.filter((card) => card.season_id === season.id).length;
            const frozen = numbering.find((n) => n.season_id === season.id);
            const launched = launches.find((l) => l.season_id === season.id);
            return (
              <div key={season.id} className={styles.numberingRow}>
                <div>
                  <b>{season.name}</b>
                  <span>
                    {launched
                      ? `Lancée le ${new Date(launched.launched_at).toLocaleDateString('fr-FR')} · choix des joueurs verrouillés`
                      : 'Pas lancée · les joueurs peuvent encore changer de champion et de skin'}
                  </span>
                  <span>
                    {frozen
                      ? `Numéros figés le ${new Date(frozen.frozen_at).toLocaleDateString('fr-FR')} · total ${frozen.total} · ${count} cartes aujourd’hui`
                      : `${count} cartes · numéros encore calculés (figés au lancement)`}
                  </span>
                </div>
                <div className={styles.numberingActions}>
                  {frozen && canRefreeze && (
                    <button type="button" className={ds.btnOutline} disabled={freezing} onClick={() => freeze(season, count, true)}>
                      Refiger les numéros
                    </button>
                  )}
                  <button type="button" className={launched ? ds.btnOutline : ds.btnPrimary} disabled={Boolean(launched) || launching} onClick={() => launch(season, count, Boolean(frozen))}>
                    {launched ? 'Collection lancée' : `Lancer la collection ${season.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoom && <CardZoom card={zoom} onClose={() => setZoom(null)} />}

      <div className={ds.sectionLabel} style={{ marginTop: 48 }}>Cartes créées · {cards.length}</div>
      {!cards.length && <p className={ds.empty}>Aucune carte pour l’instant.</p>}
      {cards.length > 0 && <CardFilters {...cardFilters} total={cards.length} />}
      {cards.length > 0 && !cardFilters.filtered.length && <p className={ds.empty}>Aucune carte avec ces filtres.</p>}
      <div className={styles.list}>
        {cardFilters.visible.map((card) => (
          <div key={card.id} className={styles.item}>
            <button type="button" className={styles.zoomBtn} onClick={() => setZoom(card)} aria-label={`Voir ${card.name} en grand`}>
              <PlayerCard card={card} />
            </button>
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
