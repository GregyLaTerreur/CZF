// Constantes partagées entre composants serveur et client (pas de 'use client' ici).

export type DivisionName = 'Targon' | 'Ixtal' | 'Yordle';

export const DIVISIONS: DivisionName[] = ['Targon', 'Ixtal', 'Yordle'];

export const DIVISION_COLORS: Record<DivisionName, string> = {
  Targon: 'var(--purple)',
  Ixtal: 'var(--teal)',
  Yordle: 'var(--yordle)',
};
