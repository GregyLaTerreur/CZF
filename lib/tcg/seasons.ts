// Saisons du TCG (table czf_seasons) : côté serveur uniquement (client supabaseAdmin).
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type TcgSeason = { id: number; name: string; status: string };

export async function loadSeasons(): Promise<TcgSeason[]> {
  const { data } = await supabaseAdmin.from('czf_seasons').select('id, name, status').order('id', { ascending: false });
  return (data || []) as TcgSeason[];
}

// Saison demandée si elle existe, sinon la saison active (ou la plus récente).
export async function resolveSeasonId(requested: unknown): Promise<number | null> {
  const seasons = await loadSeasons();
  const id = Number(requested);
  if (Number.isInteger(id) && seasons.some((s) => s.id === id)) return id;
  return (seasons.find((s) => s.status === 'active') ?? seasons[0])?.id ?? null;
}
