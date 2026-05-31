export type RankTier = 'IRON'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'EMERALD'|'DIAMOND'|'MASTER'|'GRANDMASTER'|'CHALLENGER';
export type PlayerStats = { tier: RankTier; division?: 'IV'|'III'|'II'|'I'; lp?: number; winrate: number; games: number; peakTier?: RankTier; peakDivision?: 'IV'|'III'|'II'|'I'; };

const tierBase: Record<RankTier, number> = { IRON: 5, BRONZE: 10, SILVER: 16, GOLD: 24, PLATINUM: 34, EMERALD: 48, DIAMOND: 68, MASTER: 92, GRANDMASTER: 110, CHALLENGER: 130 };
const divBonus: Record<string, number> = { IV: 0, III: 3, II: 6, I: 9 };

export function calculateCzfScore(stats: PlayerStats) {
  const current = tierBase[stats.tier] + (stats.division ? divBonus[stats.division] : 0) + Math.min(5, Math.floor((stats.lp ?? 0) / 20));
  const wrConfidence = Math.min(1, stats.games / 120);
  const wrDelta = (stats.winrate - 50) * 0.9 * wrConfidence;
  const activity = stats.games >= 200 ? 4 : stats.games >= 100 ? 3 : stats.games >= 40 ? 1 : -2;
  const peakBase = stats.peakTier ? tierBase[stats.peakTier] + (stats.peakDivision ? divBonus[stats.peakDivision] : 0) : current;
  const peakBonus = Math.max(0, Math.min(12, (peakBase - current) * 0.25));
  return Math.round(current + wrDelta + activity + peakBonus);
}

export function teamDivision(total: number) {
  if (total >= 315) return 'Targon';
  if (total >= 255) return 'Ixtal';
  return 'Yordle';
}
