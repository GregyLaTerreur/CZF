// Boosters TCG : types, illustration, validation du formulaire admin.
// Pas de 'use client' ici : utilisable côté serveur comme côté client.

import { cdnImage } from '@/lib/assets';
import { RARITIES, type CardType, type Rarity } from '@/lib/tcg/cards';

export type BoosterType = 'tout' | CardType;

export const BOOSTER_TYPES: BoosterType[] = ['tout', 'joueur', 'mvp', 'simple'];

export const BOOSTER_TYPE_LABELS: Record<BoosterType, string> = {
  tout: 'Tout',
  joueur: 'Joueur',
  mvp: 'MVP',
  simple: 'Simple',
};

// Une ligne de czf_tcg_boosters.
export type TcgBooster = {
  id?: number;
  name: string;
  card_type: BoosterType;
  cards_per_pack: number;
  rate_commune: number;
  rate_rare: number;
  rate_epique: number;
  rate_legendaire: number;
  image_url: string | null;
  active: boolean;
};

export const rateKey = (rarity: Rarity) => `rate_${rarity}` as const;

export const EMPTY_BOOSTER: TcgBooster = {
  name: '', card_type: 'tout', cards_per_pack: 5,
  rate_commune: 70, rate_rare: 20, rate_epique: 8, rate_legendaire: 2,
  image_url: null, active: true,
};

// Illustration provisoire (_dev) tant que la graphiste n'a pas fait les sachets.
export function boosterImage(booster: Pick<TcgBooster, 'image_url'>, width = 500) {
  return booster.image_url || cdnImage('cards/s1/boosters/booster_dev', `f_auto,q_auto,w_${width}`);
}

export function ratesTotal(booster: TcgBooster) {
  return RARITIES.reduce((sum, rarity) => sum + Number(booster[rateKey(rarity)] || 0), 0);
}

// Vérifie et nettoie un booster envoyé par le formulaire admin.
export function parseBoosterInput(body: any): { booster: TcgBooster; error?: undefined } | { error: string; booster?: undefined } {
  const name = String(body?.name ?? '').trim().slice(0, 40);
  if (!name) return { error: 'Le nom du booster est obligatoire.' };

  const cardType = body?.card_type as BoosterType;
  if (!BOOSTER_TYPES.includes(cardType)) return { error: 'Type de booster invalide.' };

  const cardsPerPack = Number(body?.cards_per_pack);
  if (!Number.isInteger(cardsPerPack) || cardsPerPack < 1 || cardsPerPack > 10) return { error: 'Un booster contient de 1 à 10 cartes.' };

  const rates = Object.fromEntries(
    RARITIES.map((rarity) => [rateKey(rarity), Math.round(Number(body?.[rateKey(rarity)] ?? 0) * 100) / 100])
  ) as Pick<TcgBooster, 'rate_commune' | 'rate_rare' | 'rate_epique' | 'rate_legendaire'>;

  if (Object.values(rates).some((rate) => !Number.isFinite(rate) || rate < 0)) return { error: 'Les pourcentages doivent être positifs.' };

  const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0);
  if (Math.abs(total - 100) > 0.001) return { error: `Le total des chances doit faire 100 % (actuellement ${total} %).` };

  const imageUrl = String(body?.image_url ?? '').trim() || null;
  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') throw new Error();
    } catch {
      return { error: 'L’illustration doit être une image Cloudinary (https://res.cloudinary.com/…).' };
    }
  }

  return {
    booster: { name, card_type: cardType, cards_per_pack: cardsPerPack, ...rates, image_url: imageUrl, active: body?.active !== false },
  };
}

// Messages des erreurs levées par les fonctions SQL czf_tcg_open_booster / czf_tcg_give_boosters.
export function boosterSqlError(message: string | undefined) {
  if (message?.includes('PAS_DE_BOOSTER')) return { message: 'Tu n’as plus de booster de ce type.', status: 409 };
  if (message?.includes('BOOSTER_VIDE')) return { message: 'Ce booster ne contient encore aucune carte.', status: 409 };
  if (message?.includes('BOOSTER_INTROUVABLE')) return { message: 'Booster introuvable.', status: 404 };
  if (message?.includes('QUANTITE_INVALIDE')) return { message: 'Quantité invalide (1 à 100).', status: 400 };
  return null;
}
