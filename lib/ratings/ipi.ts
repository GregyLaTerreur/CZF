// IPI : Indice de Performance Individuelle sur 100 (algorithme de l'outil « App CZF », core.js).
// Chaque stat est notée de 0 à 100 sur un barème par division et par rôle, puis moyenne pondérée par rôle.
// Sans dépendance serveur : utilisable partout.
import { IPI_BENCHMARKS, type Threshold } from './benchmarks';

export type IpiRole = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';
export type IpiStat = 'KDA' | 'GPM' | 'DPM' | 'CS/min' | 'KP %' | 'Score de vision/min';

const ALL_STATS: IpiStat[] = ['KDA', 'GPM', 'DPM', 'CS/min', 'KP %', 'Score de vision/min'];

// Poids par rôle, dans l'ordre de statKeys(role). Jungle : poids sur 85, remis sur 100.
export const IPI_WEIGHTS: Record<IpiRole, number[]> = {
  Top: [20, 15, 25, 20, 20],
  Jungle: [20, 15, 15, 10, 25].map((w) => (w * 100) / 85),
  Mid: [20, 15, 30, 15, 20],
  ADC: [15, 15, 35, 25, 10],
  Support: [20, 5, 10, 30, 35],
};

// Stats prises en compte : CS/min sauf pour les supports, vision/min seulement pour les supports.
export function statKeys(role: IpiRole): IpiStat[] {
  return ALL_STATS.filter((stat) => (stat === 'CS/min' ? role !== 'Support' : stat === 'Score de vision/min' ? role === 'Support' : true));
}

// Note d'une stat : 0 sous le plancher, 50 au centre, 100 au plafond, linéaire entre les deux.
export function scoreStat(value: number, { floor, center, ceiling }: Threshold): number {
  if (value <= floor) return 0;
  if (value >= ceiling) return 100;
  if (value <= center) return (50 * (value - floor)) / (center - floor);
  return 50 + (50 * (value - center)) / (ceiling - center);
}

export type IpiResult = { ipi: number; scores: Record<string, number> };

// null si la division / le rôle n'a pas de barème ou s'il manque une stat.
export function calculateIpi(role: IpiRole, division: string, stats: Partial<Record<IpiStat, number | null>>): IpiResult | null {
  const benchmarks = IPI_BENCHMARKS[division]?.[role];
  if (!benchmarks || !IPI_WEIGHTS[role]) return null;
  const keys = statKeys(role);
  const scores: Record<string, number> = {};
  let ipi = 0;
  for (const [index, key] of keys.entries()) {
    const value = stats[key];
    if (value == null || !Number.isFinite(value) || value < 0 || !benchmarks[key]) return null;
    scores[key] = scoreStat(value, benchmarks[key]);
    ipi += (scores[key] * IPI_WEIGHTS[role][index]) / 100;
  }
  return { ipi, scores };
}

// Participation minimale pour être noté : 45 % des parties de son équipe.
export const IPI_MIN_PARTICIPATION = 0.45;

// Note affichée sur les cartes (0 à 99) à partir de l'IPI sur 100.
export const ipiToNote = (ipi: number) => Math.max(0, Math.min(99, Math.round(ipi)));
