import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { requireUser } from '@/lib/auth';
import { lookupRiot } from '@/lib/riot/link-account';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const PEAK_TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const PEAK_RANKS = ['I', 'II', 'III', 'IV'];
const DESCRIPTION_MAX = 500;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

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
    },
    // Ne touche jamais une ligne existante : sinon un admin perdrait is_admin.
    { onConflict: 'id', ignoreDuplicates: true }
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

  const body = await request.json().catch(() => ({}));

  const riot_id = String(body.riot_id ?? '').trim();
  const main_role = body.main_role;
  const secondary_role = body.secondary_role || null;
  const description = String(body.description ?? '').trim().slice(0, DESCRIPTION_MAX) || null;

  if (!/^.{3,16}#.{2,5}$/.test(riot_id)) {
    return fail('Riot ID invalide. Format attendu : Pseudo#TAG', 400);
  }
  if (!ROLES.includes(main_role)) return fail('Choisis un rôle principal.', 400);
  if (secondary_role && !ROLES.includes(secondary_role)) return fail('Rôle secondaire invalide.', 400);

  const { data: existingPlayer, error: existingError } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('profile_id', profile_id)
    .maybeSingle();

  if (existingError) {
    console.error('[players POST]', existingError);
    return fail('Erreur lors de la vérification du profil.', 500);
  }

  if (existingPlayer) return fail('Tu as déjà un profil joueur.', 400);

  // Rang, points CZF et PUUID viennent de Riot, jamais du navigateur.
  const riot = await lookupRiot(new URL(request.url).origin, { riot_id });
  if (!riot.ok) return fail(riot.message, riot.status);

  const riotData = riot.data;

  // Un compte Riot ne peut appartenir qu'à un seul compte Discord.
  const { data: samePuuid } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('puuid', riotData.puuid)
    .not('profile_id', 'is', null)
    .limit(1);

  if (samePuuid?.length) return fail('Ce compte Riot est déjà lié à un autre joueur.', 409);

  const { data, error } = await supabaseAdmin
    .from('players')
    .insert([
      {
        riot_id: riotData.riot_id || riot_id,
        main_role,
        secondary_role,
        description,
        profile_id,

        puuid: riotData.puuid,
        summoner_level: riotData.summoner_level,
        profile_icon_id: riotData.profile_icon_id,

        soloq_tier: riotData.soloq_tier,
        soloq_rank: riotData.soloq_rank,
        soloq_lp: riotData.soloq_lp,
        soloq_wins: riotData.soloq_wins,
        soloq_losses: riotData.soloq_losses,

        flex_tier: riotData.flex_tier,
        flex_rank: riotData.flex_rank,
        flex_lp: riotData.flex_lp,

        peak_tier: riotData.peak_tier,
        peak_rank: riotData.peak_rank,
        peak_lp: riotData.peak_lp,

        czf_points: riotData.czf_points,
        top_champions: riotData.top_champions,

        lft: false,
      },
    ])
    .select();

  if (error) {
    console.error('[players POST]', error);
    return fail('Erreur lors de la création du profil.', 500);
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

// Le joueur (ou un admin) modifie son profil : LFT, rôles, description, peak. Champ absent = inchangé.
export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const playerId = Number(body.player_id);
  if (!Number.isInteger(playerId) || playerId <= 0) return fail('player_id manquant', 400);

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id, profile_id')
    .eq('id', playerId)
    .maybeSingle();

  if (!player) return fail('Joueur introuvable.', 404);
  if (player.profile_id !== auth.user.id && !auth.isAdmin) {
    return fail('Tu ne peux modifier que ton propre profil.', 403);
  }

  const updates: Record<string, unknown> = {};

  if (body.lft !== undefined) updates.lft = body.lft === true;

  if (body.main_role !== undefined) {
    if (!ROLES.includes(body.main_role)) return fail('Rôle principal invalide.', 400);
    updates.main_role = body.main_role;
  }

  if (body.secondary_role !== undefined) {
    if (body.secondary_role && !ROLES.includes(body.secondary_role)) return fail('Rôle secondaire invalide.', 400);
    updates.secondary_role = body.secondary_role || null;
  }

  if (body.description !== undefined) {
    updates.description = String(body.description ?? '').trim().slice(0, DESCRIPTION_MAX) || null;
  }

  if (body.peak_tier !== undefined) {
    if (body.peak_tier && !PEAK_TIERS.includes(String(body.peak_tier).toUpperCase())) {
      return fail('Peak invalide.', 400);
    }
    updates.peak_tier = body.peak_tier ? String(body.peak_tier).toUpperCase() : null;
  }

  if (body.peak_rank !== undefined) {
    if (body.peak_rank && !PEAK_RANKS.includes(body.peak_rank)) return fail('Division du peak invalide.', 400);
    updates.peak_rank = body.peak_rank || null;
  }

  if (body.peak_lp !== undefined) {
    const lp = Number(body.peak_lp) || 0;
    if (lp < 0 || lp > 5000) return fail('LP du peak invalides.', 400);
    updates.peak_lp = Math.round(lp);
  }

  if (!Object.keys(updates).length) return fail('Rien à modifier.', 400);

  const { data, error } = await supabaseAdmin
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select();

  if (error) {
    console.error('[players PATCH]', error);
    return fail('Erreur lors de la modification du profil.', 500);
  }

  invalidateResults();

  return NextResponse.json({
    success: true,
    data,
  });
}
