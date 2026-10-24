// Cache serveur des données de résultats (pages Résultats et Stats).
// Invalidé par les routes qui modifient matchs, games, MVP, équipes, rosters ou joueurs.

import { revalidateTag } from 'next/cache';

export const RESULTS_TAG = 'resultats';

// Durée max du cache : couvre les changements faits directement en base.
export const RESULTS_TTL_SECONDS = 300;

export function invalidateResults() {
  revalidateTag(RESULTS_TAG, { expire: 0 });
}
