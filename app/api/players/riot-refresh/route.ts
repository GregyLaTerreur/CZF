import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const body = await request.json();

  const { player_id } = body;

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', player_id)
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      {
        success: false,
        message: 'Joueur introuvable.',
      },
      { status: 404 }
    );
  }

  let riotData: any;

  try {
    // Origine de la requête plutôt que NEXT_PUBLIC_SITE_URL : marche quel que soit le domaine ou le port.
    const riotRes = await fetch(
      `${new URL(request.url).origin}/api/riot/player`,
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
          skip_top_champions: true,
        }),
      }
    );

    const text = await riotRes.text();
    riotData = text ? JSON.parse(text) : null;

    if (!riotData) {
      throw new Error(`Réponse vide de /api/riot/player (${riotRes.status}).`);
    }
  } catch (error: any) {
    console.log('RIOT REFRESH ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Impossible de contacter le service Riot.',
      },
      { status: 502 }
    );
  }

  if (!riotData.success) {
    return NextResponse.json(
      {
        success: false,
        message: riotData.message || 'Erreur Riot.',
      },
      { status: 500 }
    );
  }

  const data = riotData.data;

  const { error } = await supabase
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
    .eq('id', player_id);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Données Riot actualisées.',
  });
}