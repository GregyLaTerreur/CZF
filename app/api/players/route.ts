import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    riot_id,
    main_role,
    secondary_role,
    description,
    profile_id,

    puuid,
    summoner_level,
    profile_icon_id,

    soloq_tier,
    soloq_rank,
    soloq_lp,
    soloq_wins,
    soloq_losses,

    flex_tier,
    flex_rank,
    flex_lp,

    peak_tier,
    peak_rank,
    peak_lp,

    czf_points,
    top_champions,
  } = body;

  const { data: existingPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('profile_id', profile_id)
    .maybeSingle();

  if (existingPlayer) {
    return NextResponse.json({
      success: false,
      message: 'Tu as déjà un profil joueur.',
    });
  }

  const { data, error } = await supabase
    .from('players')
    .insert([
      {
        riot_id,
        main_role,
        secondary_role,
        description,
        profile_id,

        puuid,
        summoner_level,
        profile_icon_id,

        soloq_tier,
        soloq_rank,
        soloq_lp,
        soloq_wins,
        soloq_losses,

        flex_tier,
        flex_rank,
        flex_lp,

        peak_tier,
        peak_rank,
        peak_lp,

        czf_points,
        top_champions,

        lft: false,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const { player_id, lft } = body;

  const { data, error } = await supabase
    .from('players')
    .update({ lft })
    .eq('id', player_id)
    .select();

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}