// Cartes TCG : types, raretés, positions des éléments sur le gabarit 1500x2100, images, validation.
// Pas de 'use client' ici : utilisable côté serveur comme côté client.

import { cdnImage } from '@/lib/assets';
import { isAllowedLogoUrl } from '@/lib/logo';
import { DIVISIONS, type DivisionName } from '@/app/components/home/divisions';

export type Rarity = 'commune' | 'rare' | 'epique' | 'legendaire';
export type CardType = 'joueur' | 'mvp' | 'simple' | 'staff';

export const RARITIES: Rarity[] = ['commune', 'rare', 'epique', 'legendaire'];
export const CARD_TYPES: CardType[] = ['joueur', 'mvp', 'simple', 'staff'];
export const CARD_ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export const RARITY_LABELS: Record<Rarity, string> = {
  commune: 'Commune',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  joueur: 'Joueur',
  mvp: 'MVP',
  simple: 'Simple',
  staff: 'Staff',
};

// Ce que chaque type affiche : simple = juste le nom et le personnage, la note n'existe qu'en MVP.
export const TYPE_FIELDS: Record<CardType, { team: boolean; note: boolean; stats: boolean }> = {
  joueur: { team: true, note: false, stats: true },
  mvp: { team: true, note: true, stats: true },
  simple: { team: false, note: false, stats: false },
  staff: { team: false, note: false, stats: false },
};

// Raretés autorisées par type : une carte joueur est toujours commune, une MVP rare ou épique
// (légendaire sur décision de l'admin), une simple peut tout être.
export const TYPE_RARITIES: Record<CardType, Rarity[]> = {
  joueur: ['commune'],
  mvp: ['rare', 'epique', 'legendaire'],
  simple: ['commune', 'rare', 'epique', 'legendaire'],
  staff: ['rare'], // membres du staff CZF (SQL czf-import/tcg-13)
};

export const STAT_LABELS = ['KDA', 'KP%', 'DPM', 'VIS/M', 'WR%'];

export type CardStat = { label: string; value: string };

// Une ligne de czf_tcg_cards.
export type TcgCard = {
  id?: number;
  season_id?: number | null;
  player_id?: number | null; // joueur lié (données pré-remplies depuis players + stats CZF)
  card_type: CardType;
  rarity: Rarity;
  name: string;
  champion: string; // id Data Dragon, ex. "LeeSin"
  art_url: string | null; // illustration perso (Cloudinary), sinon artwork Riot
  // Cadrage réglé dans l'admin : point gardé au centre (en %, comme object-position) et zoom (1 à 3).
  art_x?: number;
  art_y?: number;
  art_zoom?: number;
  skin_num?: number; // skin Data Dragon (0 = skin de base)
  team_name: string | null;
  team_logo: string | null;
  role: string | null;
  division: DivisionName | null;
  note: number | null;
  stats: CardStat[];
  live_stats?: boolean; // stats recalculées à l'affichage (carte Joueur liée), pas celles enregistrées
  number?: number; // numéro dans la saison, calculé à l'affichage (withNumbers)
  season_total?: number;
};

// Cadres et icônes provisoires : suffixe _dev = utilisés seulement en dev, à remplacer par ceux de la graphiste.
const ASSET_SUFFIX = '_dev';

export const CARD_SIZE = { w: 1500, h: 2100 };
export const CARD_RADIUS = 52;
export const CARD_BORDER = 26;

type Logos = { y: number; left: number; right: number; size: number };

export type RarityLayout = {
  art: number; // hauteur de l'artwork : plus la carte est rare, plus il descend
  tag: number | null; // nom d'équipe en petit (absent en légendaire)
  name: number;
  nameSize: number; // en % de la largeur de la carte
  stats: 'pill' | 'line' | 'hover' | 'circles' | 'none';
  pill?: { x: number; y: number; w: number; h: number };
  statsY?: number;
  logos: Logos;
  tabOpacity: number; // l'onglet note/rôle s'efface quand l'artwork prend la carte
  // Cadre de la graphiste (id Cloudinary dans cards/s1/cadres, sans suffixe _dev : version officielle).
  frame?: string;
  // Grande illustration Riot (1215×717, plus nette) au lieu de l'image verticale (308×560).
  artSource?: 'splash';
  // Rond en haut à gauche du cadre : rôle (ou note MVP) à la place de l'onglet CSS.
  topCircle?: { x: number; y: number; d: number };
  // Ronds des stats, de gauche à droite, dans l'ordre de STAT_CIRCLE_ORDER.
  statCircles?: { y: number; labelY: number; items: { x: number; d: number; y?: number; labelY?: number }[] };
  // Cadre propre à un type (ex. épique « événement » pour les cartes simples).
  frameByType?: Partial<Record<CardType, string>>;
  // Petit rond du rôle (épique) : le grand rond du haut affiche alors la note.
  roleCircle?: { x: number; y: number; d: number };
  // Logo d'équipe et division empilés en haut à droite de l'illustration (badges) : le pseudo a toute la largeur.
  badges?: { x: number; y1: number; y2: number; size: number };
  // Texte sombre (bande claire du cadre).
  ink?: 'dark';
  // Vernis holographique : arc-en-ciel visible seulement dans le dessin du vernis (masque, cards/s1/effets).
  varnish?: string;
};

// Note affichée tant qu'elle n'est pas remplie en base (cartes épiques).
export const DEFAULT_NOTE = 99;

// Ordre des stats dans les 5 ronds du bas : le KDA dans le grand rond du centre.
export const STAT_CIRCLE_ORDER = ['KP%', 'DPM', 'KDA', 'VIS/M', 'WR%'];

// Badges équipe + division des cadres de la graphiste (haut à droite de l'illustration).
const BADGES = { x: 1290, y1: 189, y2: 357, size: 150 };

// Largeur max du pseudo (gabarit 1500) : au-delà, il rétrécit.
export const NAME_MAX_WIDTH = 1350;

// Doit rester en phase avec les cadres PNG (générés par ~/www/czf-tcg/gen.mjs).
export const LAYOUTS: Record<Rarity, RarityLayout> = {
  // Cadre officiel de la graphiste (1500×2100) : illustration jusqu'à 1280, ronds mesurés sur son fichier.
  commune: {
    frame: 'commune', artSource: 'splash', art: 1280, tag: 1415, name: 1525, nameSize: 10.5, stats: 'circles', tabOpacity: 0,
    topCircle: { x: 243, y: 218, d: 262 },
    badges: BADGES,
    statCircles: { y: 1768, labelY: 1945, items: [{ x: 206, d: 192 }, { x: 460, d: 192 }, { x: 749, d: 262 }, { x: 1038, d: 192 }, { x: 1292, d: 192 }] },
    // Logos alignés sur la ligne du pseudo, rapprochés de lui.
    logos: { y: 1520, left: 250, right: 1250, size: 120 },
  },
  // Cadre rare de la graphiste : illustration jusqu'à 1710, bande beige en bas (texte sombre), pas de stats.
  // Rond du haut : « STAFF » pour le type staff, la note pour un joueur.
  rare: {
    frame: 'rare', artSource: 'splash', art: 1712, tag: 1800, name: 1905, nameSize: 10, stats: 'none', tabOpacity: 0, ink: 'dark',
    topCircle: { x: 243, y: 220, d: 262 },
    badges: BADGES,
    logos: { y: 1905, left: 250, right: 1250, size: 120 },
  },
  // Cadre épique de la graphiste : illustration pleine carte fondue vers le bas, note dans le grand rond,
  // rôle dans le petit, 5 stats en arc. Les cartes simples prennent le cadre « événement » (sans stats).
  epique: {
    frame: 'epique', frameByType: { simple: 'epique_evenement' }, artSource: 'splash', art: 2100,
    tag: 1320, name: 1425, nameSize: 10, stats: 'circles', tabOpacity: 0, varnish: 'vernis_epique_masque',
    topCircle: { x: 243, y: 220, d: 262 },
    roleCircle: { x: 353, y: 343, d: 150 },
    badges: BADGES,
    statCircles: {
      y: 1770, labelY: 1930,
      items: [
        { x: 206, d: 192, y: 1770, labelY: 1930 },
        { x: 460, d: 192, y: 1728, labelY: 1888 },
        { x: 750, d: 262, y: 1669, labelY: 1862 },
        { x: 1038, d: 192, y: 1728, labelY: 1888 },
        { x: 1292, d: 192, y: 1770, labelY: 1930 },
      ],
    },
    logos: { y: 1425, left: 250, right: 1250, size: 120 },
  },
  legendaire: {
    art: 2100, tag: null, name: 1950, nameSize: 8, stats: 'hover', tabOpacity: 0.42,
    logos: { y: 1950, left: 170, right: 1330, size: 120 },
  },
};

export const RARITY_ACCENTS: Record<Rarity, string> = {
  commune: '#D4B896',
  rare: '#C9D0D9',
  epique: '#F05010',
  legendaire: '#F2C14E',
};

export function cardFrame(rarity: Rarity, width = 750, cardType?: CardType) {
  const layout = LAYOUTS[rarity];
  const frame = (cardType && layout.frameByType?.[cardType]) ?? layout.frame ?? `${rarity}${ASSET_SUFFIX}`;
  return cdnImage(`cards/s1/cadres/${frame}`, `f_auto,q_auto,w_${width}`);
}

// Textures d'effet de la graphiste (vernis…).
export function cardEffect(name: string, width = 750) {
  return cdnImage(`cards/s1/effets/${name}`, `f_auto,q_auto,w_${width}`);
}

export function divisionIcon(division: DivisionName) {
  return cdnImage(`cards/s1/divisions/${division.toLowerCase()}${ASSET_SUFFIX}`, 'f_auto,q_auto,w_200');
}

// Cadrage par défaut de l'illustration : centrée horizontalement, un peu vers le haut, sans zoom.
export const ART_DEFAULT = { x: 50, y: 18, zoom: 1 };

// Artwork Riot (Data Dragon) tant qu'on n'a pas nos propres illustrations.
export function championArt(card: Pick<TcgCard, 'champion' | 'art_url' | 'skin_num' | 'rarity'>) {
  if (card.art_url) return card.art_url;
  if (LAYOUTS[card.rarity].artSource === 'splash') return splashArt(card.champion, card.skin_num ?? 0);
  return skinArt(card.champion, card.skin_num ?? 0);
}

// Grande illustration horizontale d'un skin (Data Dragon, 1215×717).
export const splashArt = (champion: string, skinNum = 0) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion}_${skinNum}.jpg`;

// Skins Data Dragon sans les chromas (un chroma a un parentSkin et pas d'illustration à lui).
export const isRealSkin = (skin: { parentSkin?: number | null }) => skin.parentSkin == null;

// Illustration verticale d'un skin (Data Dragon).
export const skinArt = (champion: string, skinNum = 0) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion}_${skinNum}.jpg`;

// Position sur le gabarit -> % de la carte.
export const pctX = (v: number) => `${(v / CARD_SIZE.w) * 100}%`;
export const pctY = (v: number) => `${(v / CARD_SIZE.h) * 100}%`;

// Illustrations acceptées : notre Cloudinary uniquement.
function isAllowedArtUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

// Vérifie et nettoie une carte envoyée par le formulaire admin. Les champs inutiles pour le type sont vidés.
export function parseCardInput(body: any): { card: TcgCard; error?: undefined } | { error: string; card?: undefined } {
  const cardType = body?.card_type as CardType;
  const rarity = body?.rarity as Rarity;

  if (!CARD_TYPES.includes(cardType)) return { error: 'Type de carte invalide.' };
  if (!RARITIES.includes(rarity)) return { error: 'Rareté invalide.' };
  if (!TYPE_RARITIES[cardType].includes(rarity)) {
    return {
      error: cardType === 'joueur' ? 'Une carte Joueur est toujours Commune.' : cardType === 'staff' ? 'Une carte Staff est toujours Rare.' : 'Une carte MVP est Rare, Épique ou Légendaire.',
    };
  }

  const name = text(body.name, 40);
  if (!name) return { error: 'Le pseudo est obligatoire.' };

  const champion = text(body.champion, 40);
  if (!/^[A-Za-z]+$/.test(champion)) return { error: 'Choisis un personnage dans la liste.' };

  const artUrl = text(body.art_url, 500) || null;
  if (artUrl && !isAllowedArtUrl(artUrl)) return { error: 'L’illustration doit être une image Cloudinary (https://res.cloudinary.com/…).' };

  const fields = TYPE_FIELDS[cardType];
  const playerId = Number(body.player_id);
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n)) * 100) / 100 : fallback;
  };
  const card: TcgCard = {
    player_id: Number.isInteger(playerId) && playerId > 0 ? playerId : null,
    card_type: cardType, rarity, name, champion, art_url: artUrl,
    art_x: clamp(body.art_x, 0, 100, ART_DEFAULT.x),
    art_y: clamp(body.art_y, 0, 100, ART_DEFAULT.y),
    art_zoom: clamp(body.art_zoom, 1, 3, ART_DEFAULT.zoom),
    skin_num: Math.round(clamp(body.skin_num, 0, 999, 0)),
    team_name: null, team_logo: null, role: null, division: null, note: null, stats: [],
  };

  if (fields.team) {
    card.team_name = text(body.team_name, 40) || null;
    card.team_logo = text(body.team_logo, 500) || null;
    if (card.team_logo && !isAllowedLogoUrl(card.team_logo)) return { error: 'Logo d’équipe : hébergeur non accepté (imgur, noelshack, discord, cloudinary…).' };

    card.role = body.role ? String(body.role) : null;
    if (card.role && !CARD_ROLES.includes(card.role)) return { error: 'Rôle invalide.' };

    card.division = body.division ? (String(body.division) as DivisionName) : null;
    if (card.division && !DIVISIONS.includes(card.division)) return { error: 'Division invalide.' };
  }

  if (fields.note) {
    const note = Number(body.note);
    if (!Number.isInteger(note) || note < 0 || note > 99) return { error: 'La note MVP doit être un entier entre 0 et 99.' };
    card.note = note;
  }

  if (fields.stats && Array.isArray(body.stats)) {
    card.stats = STAT_LABELS.map((label, index) => ({ label, value: text(body.stats[index]?.value, 8) }));
    if (card.stats.every((stat) => !stat.value)) card.stats = [];
  }

  return { card };
}

export const EMPTY_CARD: TcgCard = {
  season_id: null, player_id: null, art_x: 50, art_y: 18, art_zoom: 1, skin_num: 0, card_type: 'joueur', rarity: 'commune', name: '', champion: 'Ahri', art_url: null,
  team_name: '', team_logo: '', role: 'Mid', division: 'Yordle', note: null,
  stats: STAT_LABELS.map((label) => ({ label, value: '' })),
};
