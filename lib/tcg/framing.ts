// Cadrage de l'illustration partagé par champion + skin + rareté (SQL czf-import/tcg-12). Serveur uniquement.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { TcgCard } from '@/lib/tcg/cards';

export type ArtFraming = { champion: string; skin_num: number; rarity: string; art_x: number; art_y: number; art_zoom: number };

export async function loadFramings(): Promise<ArtFraming[] | null> {
  const { data, error } = await supabaseAdmin.from('czf_tcg_art_framing').select('champion, skin_num, rarity, art_x, art_y, art_zoom');
  return error ? null : (data as ArtFraming[]);
}

// Retient le cadrage de la carte enregistrée et l'applique aux autres cartes du même champion / skin / rareté.
// Renvoie le nombre d'autres cartes recadrées (0 si illustration perso ou SQL tcg-12 absent).
export async function shareFraming(card: TcgCard & { id?: number }, userId: string): Promise<number> {
  if (card.art_url || !card.id) return 0;
  const key = { champion: card.champion, skin_num: card.skin_num ?? 0, rarity: card.rarity };
  const framing = { art_x: card.art_x ?? 50, art_y: card.art_y ?? 18, art_zoom: card.art_zoom ?? 1 };

  const saved = await supabaseAdmin
    .from('czf_tcg_art_framing')
    .upsert({ ...key, ...framing, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'champion,skin_num,rarity' });
  if (saved.error) return 0;

  const { data } = await supabaseAdmin
    .from('czf_tcg_cards')
    .update(framing)
    .eq('champion', key.champion)
    .eq('skin_num', key.skin_num)
    .eq('rarity', key.rarity)
    .is('art_url', null)
    .neq('id', card.id)
    .select('id');
  return data?.length ?? 0;
}
