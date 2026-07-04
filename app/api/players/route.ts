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
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        message: 'Tu dois être connecté avec Discord.',
      },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      {
        success: false,
        message: 'Session invalide. Reconnecte-toi avec Discord.',
      },
      { status: 401 }
    );
  }

  const profile_id = user.id;

const discordUserId =
  user.user_metadata?.provider_id ||
  user.identities?.[0]?.identity_data?.provider_id;

if (!discordUserId) {
  return NextResponse.json(
    {
      success: false,
      message: 'Impossible de vérifier ton compte Discord. Reconnecte-toi.',
    },
    { status: 401 }
  );
}

const memberRes = await fetch(
  `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
  {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
  }
);

if (!memberRes.ok) {
  return NextResponse.json(
    {
      success: false,
      message: 'Tu dois rejoindre le serveur Discord CZF avant de créer ton profil.',
    },
    { status: 403 }
  );
}

  const body = await request.json();

  const {
    riot_id,
    main_role,
    secondary_role,
    description,

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

  const { data: existingPlayer, error: existingError } = await supabase
    .from('players')
    .select('*')
    .eq('profile_id', profile_id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { success: false, error: existingError },
      { status: 500 }
    );
  }

  if (existingPlayer) {
    return NextResponse.json(
      {
        success: false,
        message: 'Tu as déjà un profil joueur.',
      },
      { status: 400 }
    );
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