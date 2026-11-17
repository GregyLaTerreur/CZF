import { NextResponse } from 'next/server';
import { requireTcgPlayer } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadSeasons, resolveSeasonId } from '@/lib/tcg/seasons';
import { isRealSkin } from '@/lib/tcg/cards';
import { isSeasonLaunched, isValidChampion, loadChoices, topChampion } from '@/lib/tcg/choices';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

async function myPlayer(profileId: string) {
  const { data } = await supabaseAdmin.from('players').select('id, riot_id, top_champions').eq('profile_id', profileId).maybeSingle();
  return data;
}

// Skins existants d'un champion (Data Dragon), pour refuser un numéro de skin inventé.
async function skinExists(champion: string, skinNum: number): Promise<boolean> {
  try {
    const versions: string[] = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 3600 } }).then((r) => r.json());
    const json = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/fr_FR/champion/${champion}.json`, { next: { revalidate: 3600 } }).then((r) => r.json());
    const skins: { num: number; parentSkin?: number }[] = json?.data?.[champion]?.skins ?? [];
    return skins.some((s) => s.num === skinNum && isRealSkin(s));
  } catch {
    return false;
  }
}

// Mon champion et mon skin pour la saison (active par défaut), et si la saison est lancée (verrouillée).
export async function GET(request: Request) {
  const auth = await requireTcgPlayer(request);
  if (auth.error) return auth.error;

  const player = await myPlayer(auth.user.id);
  if (!player) return fail('Aucun joueur lié à ton profil.', 404);

  const seasonId = await resolveSeasonId(new URL(request.url).searchParams.get('season'));
  if (!seasonId) return fail('Aucune saison active.', 404);

  const [seasons, launched, choices] = await Promise.all([loadSeasons(), isSeasonLaunched(seasonId), loadChoices(seasonId, [player.id])]);
  const fallback = topChampion(player.top_champions);
  const choice = choices.get(player.id) ?? (fallback ? { champion: fallback, skin_num: 0, is_default: true } : null);

  return NextResponse.json({ success: true, season: seasons.find((s) => s.id === seasonId) ?? { id: seasonId, name: `Saison ${seasonId}` }, launched, choice });
}

// Enregistre mon choix, tant que la saison n'est pas lancée.
export async function POST(request: Request) {
  const auth = await requireTcgPlayer(request);
  if (auth.error) return auth.error;

  const player = await myPlayer(auth.user.id);
  if (!player) return fail('Aucun joueur lié à ton profil.', 404);

  const body = await request.json().catch(() => ({}));
  const seasonId = await resolveSeasonId(body.season_id);
  if (!seasonId) return fail('Aucune saison active.', 404);

  const champion = body.champion;
  const skinNum = Number(body.skin_num);
  if (!isValidChampion(champion)) return fail('Choisis un champion dans la liste.', 400);
  if (!Number.isInteger(skinNum) || skinNum < 0 || skinNum > 999) return fail('Skin invalide.', 400);
  if (await isSeasonLaunched(seasonId)) return fail('La collection de cette saison est lancée : ton choix est verrouillé.', 409);
  if (!(await skinExists(champion, skinNum))) return fail('Ce skin n’existe pas pour ce champion.', 400);

  const { error } = await supabaseAdmin
    .from('czf_tcg_player_choices')
    .upsert({ player_id: player.id, season_id: seasonId, champion, skin_num: skinNum, is_default: false, updated_at: new Date().toISOString() }, { onConflict: 'player_id,season_id' });

  if (error) {
    if (error.message?.includes('SAISON_LANCEE')) return fail('La collection de cette saison est lancée : ton choix est verrouillé.', 409);
    if (error.message?.includes('czf_tcg_player_choices')) return fail('Base pas à jour : lancer czf-import/tcg-11-choix-skin-lancement.sql.', 500);
    return fail('Impossible d’enregistrer ton choix.', 500);
  }

  return NextResponse.json({ success: true });
}
