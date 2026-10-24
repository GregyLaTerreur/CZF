import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Colonnes affichées par les pages Joueurs et Équipes (?view=list).
const LIST_COLUMNS =
  'id, riot_id, profile_id, main_role, secondary_role, description, lft, czf_points, summoner_level, profile_icon_id, soloq_tier, soloq_rank, soloq_lp, soloq_wins, soloq_losses, flex_tier, flex_rank, flex_lp, peak_tier, peak_rank, peak_lp, top_champions';

const normalizeRiotId = (value: any) =>
  String(value || '').trim().toLowerCase();

async function loadTeamData() {
  const [{ data: teams, error: teamsError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from('teams')
        .select('id, name, logo_url, division, validated_by_admin'),
      supabase
        .from('team_members')
        .select('team_id, player_id, riot_id')
        .order('created_at', { ascending: true }),
    ]);

  if (teamsError) throw teamsError;
  if (membersError) throw membersError;

  return { teams: teams || [], members: members || [] };
}

// Équipe de chaque joueur (?include=team) : membre lié par player_id,
// sinon par Riot ID ; le premier membre inscrit l'emporte.
function buildTeamByPlayer(
  players: any[],
  { teams, members }: { teams: any[]; members: any[] }
) {
  const teamById = new Map((teams || []).map((team) => [Number(team.id), team]));
  const byPlayerId = new Map<number, { index: number; member: any }>();
  const byRiotId = new Map<string, { index: number; member: any }>();

  (members || []).forEach((member, index) => {
    if (member.player_id !== null && member.player_id !== undefined) {
      const key = Number(member.player_id);
      if (!byPlayerId.has(key)) byPlayerId.set(key, { index, member });
    } else {
      const key = normalizeRiotId(member.riot_id);
      if (!byRiotId.has(key)) byRiotId.set(key, { index, member });
    }
  });

  const result = new Map<number, any>();

  for (const player of players) {
    const candidates = [
      byPlayerId.get(Number(player.id)),
      byRiotId.get(normalizeRiotId(player.riot_id)),
    ].filter(Boolean) as { index: number; member: any }[];

    if (!candidates.length) continue;

    const first = candidates.sort((a, b) => a.index - b.index)[0];
    const team = teamById.get(Number(first.member.team_id));

    if (team) result.set(Number(player.id), team);
  }

  return result;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const listView = params.get('view') === 'list';
  const includeTeam = listView && params.get('include') === 'team';

  // Lancé en parallèle des joueurs ; l'erreur éventuelle est gérée plus bas.
  const teamData = includeTeam ? loadTeamData() : null;
  teamData?.catch(() => {});

  const [
    { data: players, error: playersError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase
      .from('players')
      .select(listView ? LIST_COLUMNS : '*')
      .order('id', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, discord_name'),
  ]);

  if (playersError) {
    return NextResponse.json(
      { success: false, error: playersError },
      { status: 500 }
    );
  }

  if (profilesError) {
    return NextResponse.json(
      { success: false, error: profilesError },
      { status: 500 }
    );
  }

  const profileById = new Map(
    (profiles || []).map((profile) => [String(profile.id), profile])
  );

  let teamByPlayer = new Map<number, any>();

  if (teamData) {
    try {
      teamByPlayer = buildTeamByPlayer(players as any[], await teamData);
    } catch (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }
  }

  const playersWithProfiles = (players as any[]).map((player) => {
    const profile =
      profileById.get(String(player.profile_id)) || null;

    if (!listView) {
      return { ...player, profiles: profile };
    }

    // Vue allégée : pas de points de maîtrise ni d'id de profil en double.
    return {
      ...player,
      top_champions: (player.top_champions || []).map(
        (champion: any) => ({
          champion_id: champion.champion_id,
          champion_name: champion.champion_name,
        })
      ),
      profiles: profile
        ? { discord_name: profile.discord_name }
        : null,
      ...(includeTeam
        ? { team: teamByPlayer.get(Number(player.id)) || null }
        : {}),
    };
  });

  return NextResponse.json({
    success: true,
    data: playersWithProfiles,
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
  console.log('SERVICE ROLE EXISTS:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { error: profileUpsertError } = await supabaseAdmin
  .from('profiles')
  .upsert(
    {
      id: user.id,
      discord_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        'Joueur',
      is_admin: false,
    },
    { onConflict: 'id' }
  );

if (profileUpsertError) {
  console.log('PROFILE UPSERT ERROR:', profileUpsertError);

  return NextResponse.json(
    {
      success: false,
      message: `Impossible de créer le profil Discord : ${profileUpsertError.message}`,
      debug: profileUpsertError,
    },
    { status: 500 }
  );
}

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

// En local, sans le vrai bot Discord, on peut sauter la vérification.
// Jamais en production, même si la variable y est définie par erreur.
const skipDiscordCheck =
  process.env.NODE_ENV !== 'production' &&
  process.env.CZF_SKIP_DISCORD_CHECK === 'true';

const memberRes = skipDiscordCheck
  ? null
  : await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

if (memberRes && !memberRes.ok) {
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

const { data: existingPlayer, error: existingError } = await supabaseAdmin    .from('players')
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

const { data, error } = await supabaseAdmin
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

  const {
    player_id,
    lft,
    main_role,
    secondary_role,
    description,
    peak_tier,
    peak_rank,
    peak_lp,
  } = body;

  const updates: any = {};

  if (lft !== undefined) {
    updates.lft = lft;
  }

  if (main_role !== undefined) {
    updates.main_role = main_role;
  }

  if (secondary_role !== undefined) {
    updates.secondary_role = secondary_role;
  }

  if (description !== undefined) {
    updates.description = description;
  }

  if (peak_tier !== undefined) {
    updates.peak_tier = peak_tier;
  }

  if (peak_rank !== undefined) {
    updates.peak_rank = peak_rank;
  }

  if (peak_lp !== undefined) {
    updates.peak_lp = peak_lp;
  }

  const { data, error } = await supabaseAdmin
    .from('players')
    .update(updates)
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