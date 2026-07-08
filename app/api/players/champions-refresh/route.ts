import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request) {
  const { player_id } = await request.json();

  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('id', player_id)
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      { success: false, message: 'Joueur introuvable.' },
      { status: 404 }
    );
  }

  const riotRes = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/riot/player`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        riot_id: String(player.riot_id).trim(),
        peak_tier: player.peak_tier,
        peak_rank: player.peak_rank,
        peak_lp: player.peak_lp,
        skip_top_champions: false,
      }),
    }
  );

  const riotData = await riotRes.json();

  if (!riotData.success) {
    return NextResponse.json(
      {
        success: false,
        message: riotData.message || 'Erreur Riot champion pool.',
      },
      { status: 500 }
    );
  }

  const { error } = await supabaseAdmin
    .from('players')
    .update({
      top_champions: riotData.data.top_champions,
    })
    .eq('id', player_id);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Champion pool actualisé.',
  });
}