// Cartes TCG : raretés, positions des éléments sur le gabarit 1500x2100, images des cadres.
// Pas de 'use client' ici : utilisable côté serveur comme côté client.

import { cdnImage } from '@/lib/assets';
import type { DivisionName } from '@/app/components/home/divisions';

export type Rarity = 'commune' | 'rare' | 'epique' | 'legendaire';

export const RARITIES: Rarity[] = ['commune', 'rare', 'epique', 'legendaire'];

export const RARITY_LABELS: Record<Rarity, string> = {
  commune: 'Commune',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
};

// Cadres et icônes provisoires : suffixe _dev = utilisés seulement en dev, à remplacer par ceux de la graphiste.
const ASSET_SUFFIX = '_dev';

export const CARD_SIZE = { w: 1500, h: 2100 };

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
};

// Doit rester en phase avec les cadres PNG (générés par ~/www/czf-tcg/gen.mjs, zones.json).
export const LAYOUTS: Record<Rarity, RarityLayout> = {
  commune: {
    art: 1400, tag: 1455, name: 1555, nameSize: 10, stats: 'pill',
    pill: { x: 220, y: 1650, w: 1060, h: 210 },
    logos: { y: 1970, left: 250, right: 1250, size: 170 },
  },
  rare: {
    art: 1700, tag: 1650, name: 1740, nameSize: 9.5, stats: 'pill',
    pill: { x: 220, y: 1830, w: 1060, h: 170 },
    logos: { y: 1720, left: 190, right: 1310, size: 150 },
  },
  epique: {
    art: 2100, tag: 1760, name: 1850, nameSize: 9, stats: 'line', statsY: 1975,
    logos: { y: 1850, left: 180, right: 1320, size: 140 },
  },
  legendaire: {
    art: 2100, tag: null, name: 1950, nameSize: 8, stats: 'hover',
    logos: { y: 1950, left: 170, right: 1330, size: 120 },
  },
};

export const NOTE_POS = { cx: 161, cy: 150 };
export const ROLE_POS = { cx: 161, cy: 280, size: 96 };
export const CARD_RADIUS = 52;

export function cardFrame(rarity: Rarity, width = 750) {
  return cdnImage(`cards/s1/cadres/${rarity}${ASSET_SUFFIX}`, `f_auto,q_auto,w_${width}`);
}

export function divisionIcon(division: DivisionName) {
  return cdnImage(`cards/s1/divisions/${division.toLowerCase()}${ASSET_SUFFIX}`, 'f_auto,q_auto,w_200');
}

// Artwork Riot (Data Dragon) en attendant nos propres illustrations. championId = id DDragon, ex. "LeeSin".
export function championArt(championId: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championId}_0.jpg`;
}

// Position sur le gabarit -> % de la carte.
export const pctX = (v: number) => `${(v / CARD_SIZE.w) * 100}%`;
export const pctY = (v: number) => `${(v / CARD_SIZE.h) * 100}%`;
