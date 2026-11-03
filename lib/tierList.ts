// Tier list des champions d'un joueur : partagé entre l'API et la page profil.

export const TIER_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;

export type TierKey = (typeof TIER_KEYS)[number];

// Identifiants Data Dragon des champions, dans l'ordre choisi par le joueur.
export type TierListData = Record<TierKey, string[]>;

// Couleurs classiques des tier lists.
export const TIER_COLORS: Record<TierKey, string> = {
  S: '#FF7F7F',
  A: '#FFBF7F',
  B: '#FFDF7F',
  C: '#FFFF7F',
  D: '#BFFF7F',
};

export function emptyTierList(): TierListData {
  return { S: [], A: [], B: [], C: [], D: [] };
}
