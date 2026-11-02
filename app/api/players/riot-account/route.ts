import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';

const normalizeRiotId = (value: any) => String(value || '').trim().toLowerCase();

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Change le compte Riot du joueur connecté (pseudo renommé ou autre compte).
export async function PATCH(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return fail('Tu dois être connecté avec Discord.', 401);

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return fail('Session invalide. Reconnecte-toi avec Discord.', 401);

  const body = await request.json().catch(() => ({}));
  const riotId = String(body.riot_id || '').trim();

  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (playerError) return fail('Impossible de charger ton profil joueur.', 500);
  if (!player) return fail('Tu n’as pas de profil joueur.', 404);

  // Recherche Riot (format, existence, rang, points CZF) via la route existante.
  let riotData: any;

  try {
    const riotRes = await fetch(`${new URL(request.url).origin}/api/riot/player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        riot_id: riotId,
        peak_tier: player.peak_tier,
        peak_rank: player.peak_rank,
        peak_lp: player.peak_lp,
      }),
    });
    const text = await riotRes.text();
    riotData = text ? JSON.parse(text) : null;
  } catch {
    return fail('Impossible de contacter le service Riot.', 502);
  }

  if (!riotData?.success) {
    return fail(riotData?.message || 'Compte Riot introuvable.', 400);
  }

  const data = riotData.data;

  // Un compte Riot ne peut appartenir qu'à un seul joueur CZF.
  const { data: others, error: othersError } = await supabaseAdmin
    .from('players')
    .select('id, riot_id, puuid')
    .neq('id', player.id);

  if (othersError) return fail('Impossible de vérifier le compte Riot.', 500);

  const taken = (others || []).some(
    (other: any) =>
      (other.puuid && other.puuid === data.puuid) ||
      normalizeRiotId(other.riot_id) === normalizeRiotId(data.riot_id)
  );

  if (taken) return fail('Ce compte Riot est déjà lié à un autre joueur CZF.', 409);

  const oldRiotId = String(player.riot_id || '').trim();
  const newRiotId = data.riot_id;

  const { error: updateError } = await supabaseAdmin
    .from('players')
    .update({
      riot_id: newRiotId,
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
    .eq('id', player.id);

  if (updateError) return fail('Impossible d’enregistrer le compte Riot.', 500);

  // Les rosters et capitaines gardent encore le Riot ID en texte : on les suit.
  await Promise.all([
    supabaseAdmin.from('team_members').update({ riot_id: newRiotId }).eq('player_id', player.id),
    oldRiotId
      ? supabaseAdmin
          .from('team_members')
          .update({ riot_id: newRiotId })
          .is('player_id', null)
          .eq('riot_id', oldRiotId)
      : null,
    supabaseAdmin.from('teams').update({ captain_riot_id: newRiotId }).eq('captain_player_id', player.id),
  ]);

  invalidateResults();

  return NextResponse.json({ success: true, riot_id: newRiotId });
}
