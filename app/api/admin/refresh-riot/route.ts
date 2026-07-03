import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const { data: players, error } = await supabase
    .from('players')
    .select('*');

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  for (const player of players || []) {
    const url = new URL(request.url);

const riotRes = await fetch(
  `${url.origin}/api/riot/player`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riot_id: String(player.riot_id).trim(),
          peak_tier: player.peak_tier,
          peak_rank: player.peak_rank,
          peak_lp: player.peak_lp,
        }),
      }
    );

    const riotData = await riotRes.json();

    if (!riotData.success) continue;

    const data = riotData.data;

    await supabase
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
        top_champions: data.top_champions,
        czf_points: data.czf_points,
      })
      .eq('id', player.id);
      await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return NextResponse.json({
    success: true,
    message: 'Tous les joueurs ont été actualisés.',
  });
}