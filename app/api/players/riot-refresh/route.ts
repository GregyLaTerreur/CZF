import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { lookupRiot } from '@/lib/riot/link-account';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// « Actualiser Riot » sur son profil : rang, points CZF et champion pool. Réservé au joueur ou à un admin.
export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const playerId = Number(body.player_id);
  if (!Number.isInteger(playerId) || playerId <= 0) return fail('player_id manquant', 400);

  const { data: player } = await supabaseAdmin.from('players').select('*').eq('id', playerId).maybeSingle();
  if (!player) return fail('Joueur introuvable.', 404);

  if (player.profile_id !== auth.user.id && !auth.isAdmin) {
    return fail('Tu ne peux actualiser que ton propre profil.', 403);
  }

  // Chaque appel coûte plusieurs requêtes Riot : 3 actualisations par joueur toutes les 2 minutes.
  if (!auth.isAdmin && !rateLimit(`riot-refresh:${playerId}`, 3, 120_000)) {
    return fail('Profil déjà actualisé il y a peu. Réessaie dans 2 minutes.', 429);
  }

  const riot = await lookupRiot(new URL(request.url).origin, {
    riot_id: String(player.riot_id).trim(),
    peak_tier: player.peak_tier,
    peak_rank: player.peak_rank,
    peak_lp: player.peak_lp,
    // « Actualiser Riot » met aussi à jour le champion pool.
    skip_top_champions: false,
  });

  if (!riot.ok) return fail(riot.message, riot.status);

  const data = riot.data;

  const { error } = await supabaseAdmin
    .from('players')
    .update({
      puuid: data.puuid,
      summoner_level: data.summoner_level,
      profile_icon_id: data.profile_icon_id,

      soloq_tier: data.soloq_tier,
      soloq_rank: data.soloq_rank,
      soloq_lp: data.soloq_lp,
      soloq_wins: data.soloq_wins,
      soloq_losses: data.soloq_losses,

      flex_tier: data.flex_tier,
      flex_rank: data.flex_rank,
      flex_lp: data.flex_lp,

      peak_tier: data.peak_tier,
      peak_rank: data.peak_rank,
      peak_lp: data.peak_lp,

      top_champions: data.top_champions ?? player.top_champions,
      czf_points: data.czf_points,
    })
    .eq('id', playerId);

  if (error) {
    console.error('[riot-refresh]', error);
    return fail('Erreur lors de la mise à jour du profil.', 500);
  }

  return NextResponse.json({ success: true, message: 'Données Riot actualisées.' });
}
