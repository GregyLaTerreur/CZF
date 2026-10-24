// Constantes et helpers League of Legends partagés par les pages refondues.
// Pas de 'use client' ici : utilisable côté serveur comme côté client.

import { DIVISIONS, type DivisionName } from '@/app/components/home/divisions';

export const ROLES = [
  { name: 'Top', label: 'TOP', image: '/assets/roles/top.png' },
  { name: 'Jungle', label: 'JGL', image: '/assets/roles/jungle.png' },
  { name: 'Mid', label: 'MID', image: '/assets/roles/mid.png' },
  { name: 'ADC', label: 'ADC', image: '/assets/roles/adc.png' },
  { name: 'Support', label: 'SUP', image: '/assets/roles/sup.png' },
];

export const TIERS: Record<string, { label: string; icon: string; order: number }> = {
  IRON: { label: 'Fer', icon: '/assets/ranks/iron.webp', order: 0 },
  BRONZE: { label: 'Bronze', icon: '/assets/ranks/bronze.webp', order: 1 },
  SILVER: { label: 'Argent', icon: '/assets/ranks/silver.webp', order: 2 },
  GOLD: { label: 'Or', icon: '/assets/ranks/gold.webp', order: 3 },
  PLATINUM: { label: 'Platine', icon: '/assets/ranks/platine.webp', order: 4 },
  EMERALD: { label: 'Émeraude', icon: '/assets/ranks/Emerald.webp', order: 5 },
  DIAMOND: { label: 'Diamant', icon: '/assets/ranks/diamant.webp', order: 6 },
  MASTER: { label: 'Maître', icon: '/assets/ranks/master.webp', order: 7 },
  GRANDMASTER: { label: 'Grand Maître', icon: '/assets/ranks/gm.webp', order: 8 },
  CHALLENGER: { label: 'Challenger', icon: '/assets/ranks/chall.webp', order: 9 },
};

const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVISION_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

export const DDRAGON_FALLBACK = '14.24.1';

export function splitRiotId(riotId: string) {
  const [name, tag] = String(riotId || '').split('#');
  return { name, tag };
}

export function roleInfo(role: string | null | undefined) {
  return ROLES.find((item) => item.name === role) || null;
}

// "Maître 375 LP", "Or II 54 LP" ou null si non classé.
export function formatRank(tier?: string | null, division?: string | null, lp?: number | null) {
  if (!tier) return null;

  const label = TIERS[tier]?.label ?? tier;

  if (APEX_TIERS.includes(tier)) return `${label} ${lp || 0} LP`;

  return `${label} ${division || ''} ${lp || 0} LP`.replace(/\s+/g, ' ');
}

export function rankValue(player: any) {
  const tier = TIERS[player?.soloq_tier]?.order ?? -1;
  const division = DIVISION_ORDER[player?.soloq_rank] ?? 0;

  return tier * 10000 + division * 1000 + (player?.soloq_lp || 0);
}

export function soloqGames(player: any) {
  return (player?.soloq_wins || 0) + (player?.soloq_losses || 0);
}

export function winRate(player: any): number | null {
  const games = soloqGames(player);
  return games ? Math.round(((player.soloq_wins || 0) / games) * 100) : null;
}

// Division officielle d'une équipe : seulement si elle est validée.
export function teamDivision(team: any): DivisionName | null {
  if (team?.validated_by_admin !== true) return null;

  return DIVISIONS.includes(team.division) ? team.division : null;
}

// Seuils de division selon la somme des points CZF (cf. admin).
export function divisionFromPoints(points: number): DivisionName {
  if (points >= 6101) return 'Targon';
  if (points >= 3901) return 'Ixtal';

  return 'Yordle';
}

export function dpmUrl(riotId: string) {
  return `https://dpm.lol/${encodeURIComponent(riotId.replace('#', '-'))}`;
}

export function normalizeRiotId(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

// Joueur d'un membre d'équipe : par player_id, sinon par Riot ID.
export function findMemberPlayer(member: any, players: any[]) {
  if (!member) return null;

  if (member.player_id !== null && member.player_id !== undefined) {
    const byId = players.find((p) => Number(p.id) === Number(member.player_id));
    if (byId) return byId;
  }

  const riotId = normalizeRiotId(member.riot_id);
  return players.find((p) => normalizeRiotId(p.riot_id) === riotId) || null;
}
