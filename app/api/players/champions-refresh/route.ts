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
          skip_top_champions: false,
        }),
      }
    );

    const text = await riotRes.text();
    riotData = text ? JSON.parse(text) : null;

    if (!riotData) {
      throw new Error(`Réponse vide de /api/riot/player (${riotRes.status}).`);
    }
  } catch (error: any) {
    console.log('CHAMPIONS REFRESH ERROR:', error);

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