// Cartes TCG : types, raretés, positions des éléments sur le gabarit 1500x2100, images, validation.
// Pas de 'use client' ici : utilisable côté serveur comme côté client.

import { cdnImage } from '@/lib/assets';
import { isAllowedLogoUrl } from '@/lib/logo';
import { DIVISIONS, type DivisionName } from '@/app/components/home/divisions';

export type Rarity = 'commune' | 'rare' | 'epique' | 'legendaire';
export type CardType = 'joueur' | 'mvp' | 'simple';

export const RARITIES: Rarity[] = ['commune', 'rare', 'epique', 'legendaire'];
export const CARD_TYPES: CardType[] = ['joueur', 'mvp', 'simple'];
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
};

// Ce que chaque type affiche : simple = juste le nom et le personnage, la note n'existe qu'en MVP.
export const TYPE_FIELDS: Record<CardType, { team: boolean; note: boolean; stats: boolean }> = {
  joueur: { team: true, note: false, stats: true },
  mvp: { team: true, note: true, stats: true },
  simple: { team: false, note: false, stats: false },
};

export const STAT_LABELS = ['KDA', 'KP%', 'DPM', 'VIS/M', 'WR%'];

export type CardStat = { label: string; value: string };

// Une ligne de czf_tcg_cards.
export type TcgCard = {
  id?: number;
  card_type: CardType;
  rarity: Rarity;
  name: string;
  champion: string; // id Data Dragon, ex. "LeeSin"
  art_url: string | null; // illustration perso (Cloudinary), sinon artwork Riot
  team_name: string | null;
  team_logo: string | null;
  role: string | null;
  division: DivisionName | null;
  note: number | null;
  stats: CardStat[];
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
  stats: 'pill' | 'line' | 'hover';
  pill?: { x: number; y: number; w: number; h: number };
  statsY?: number;
  logos: Logos;
  tabOpacity: number; // l'onglet note/rôle s'efface quand l'artwork prend la carte
};

// Doit rester en phase avec les cadres PNG (générés par ~/www/czf-tcg/gen.mjs).
export const LAYOUTS: Record<Rarity, RarityLayout> = {
  commune: {
    art: 1400, tag: 1455, name: 1555, nameSize: 10, stats: 'pill', tabOpacity: 0.94,
    pill: { x: 220, y: 1650, w: 1060, h: 210 },
    logos: { y: 1970, left: 250, right: 1250, size: 170 },
  },
  rare: {
    art: 1700, tag: 1650, name: 1740, nameSize: 9.5, stats: 'pill', tabOpacity: 0.9,
    pill: { x: 220, y: 1830, w: 1060, h: 170 },
    logos: { y: 1720, left: 190, right: 1310, size: 150 },
  },
  epique: {
    art: 2100, tag: 1760, name: 1850, nameSize: 9, stats: 'line', statsY: 1975, tabOpacity: 0.6,
    logos: { y: 1850, left: 180, right: 1320, size: 140 },
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

export function cardFrame(rarity: Rarity, width = 750) {
  return cdnImage(`cards/s1/cadres/${rarity}${ASSET_SUFFIX}`, `f_auto,q_auto,w_${width}`);
}

export function divisionIcon(division: DivisionName) {
  return cdnImage(`cards/s1/divisions/${division.toLowerCase()}${ASSET_SUFFIX}`, 'f_auto,q_auto,w_200');
}

// Artwork Riot (Data Dragon) tant qu'on n'a pas nos propres illustrations.
export function championArt(card: Pick<TcgCard, 'champion' | 'art_url'>) {
  if (card.art_url) return card.art_url;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${card.champion}_0.jpg`;
}

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

  const name = text(body.name, 40);
  if (!name) return { error: 'Le pseudo est obligatoire.' };

  const champion = text(body.champion, 40);
  if (!/^[A-Za-z]+$/.test(champion)) return { error: 'Choisis un personnage dans la liste.' };

  const artUrl = text(body.art_url, 500) || null;
  if (artUrl && !isAllowedArtUrl(artUrl)) return { error: 'L’illustration doit être une image Cloudinary (https://res.cloudinary.com/…).' };

  const fields = TYPE_FIELDS[cardType];
  const card: TcgCard = {
    card_type: cardType, rarity, name, champion, art_url: artUrl,
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
  card_type: 'joueur', rarity: 'commune', name: '', champion: 'Ahri', art_url: null,
  team_name: '', team_logo: '', role: 'Mid', division: 'Yordle', note: null,
  stats: STAT_LABELS.map((label) => ({ label, value: '' })),
};
