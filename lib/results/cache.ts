// Cache serveur des données de résultats (pages Résultats et Stats).
// Invalidé par les routes qui modifient matchs, games, MVP ou validation d'équipe.

import { revalidateTag } from 'next/cache';

export const RESULTS_TAG = 'resultats';

// Durée max du cache : couvre les changements faits hors de ces routes (roster, pseudo…).
export const RESULTS_TTL_SECONDS = 60;

export function invalidateResults() {
  revalidateTag(RESULTS_TAG, { expire: 0 });
}
