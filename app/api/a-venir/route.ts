import { jsonError, jsonNoStore, loadResultsDataset } from '@/lib/results/load';
import { upcomingMatches } from '@/lib/results/upcoming';

export const dynamic = 'force-dynamic';

// Prochains matchs de l'arbre ayant une date (toutes divisions), du plus proche au plus lointain.
export async function GET() {
  try {
    const dataset = await loadResultsDataset();

    return jsonNoStore({ success: true, matches: upcomingMatches(dataset) });
  } catch (error) {
    return jsonError('A VENIR API', error, 'Impossible de charger les prochains matchs.');
  }
}
