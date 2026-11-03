// Constantes partagées entre composants serveur et client (pas de 'use client' ici).

export type DivisionName = 'Targon' | 'Ixtal' | 'Yordle';

export const DIVISIONS: DivisionName[] = ['Targon', 'Ixtal', 'Yordle'];

export const DIVISION_COLORS: Record<DivisionName, string> = {
  Targon: 'var(--purple)',
  Ixtal: 'var(--teal)',
  Yordle: 'var(--yordle)',
};

// Rang affiché au classement : « - » sous une équipe à égalité parfaite.
export function displayRank(teams: { rank?: number }[], index: number): string {
  const rank = teams[index].rank ?? index + 1;
  return index > 0 && teams[index - 1].rank === rank ? '-' : String(rank);
}
