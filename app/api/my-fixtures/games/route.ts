
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function failure(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Configuration Supabase manquante.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getIdentity(request: NextRequest, admin: any) {
  const header = request.headers.get('authorization');

  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) return null;

  const { data: auth, error: authError } =
    await admin.auth.getUser(token);

  if (authError || !auth.user) return null;

  const { data: player, error: playerError } = await admin
    .from('players')
    .select('id, riot_id')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (playerError) throw playerError;
  if (!player) return null;

  return {
    playerId: Number(player.id),
    riotId: String(player.riot_id || ''),
  };
}

async function getTeamContext(admin: any, identity: any) {
  const { data: captainTeams, error: captainError } = await admin
    .from('teams')
    .select('id, captain_player_id')
    .eq('captain_player_id', identity.playerId);

  if (captainError) throw captainError;

  if (captainTeams?.length) {
    return {
      teamId: Number(captainTeams[0].id),
      isCaptain: true,
    };
  }

  const { data: membership, error: memberError } = await admin
    .from('team_members')
    .select('team_id')
    .eq('player_id', identity.playerId)
    .limit(1);

  if (memberError) throw memberError;

  let teamId = membership?.[0]?.team_id;

  if (!teamId && identity.riotId) {
    const { data: members, error: fallbackError } = await admin
      .from('team_members')
      .select('team_id, riot_id');

    if (fallbackError) throw fallbackError;

    const normalized = identity.riotId.trim().toLowerCase();

    const found = (members || []).find(
      (m: any) =>
        String(m.riot_id || '').trim().toLowerCase() ===
        normalized
    );

    teamId = found?.team_id;
  }

  if (!teamId) return null;

  return {
    teamId: Number(teamId),
    isCaptain: false,
  };
}

async function getActiveSeason(admin: any) {
  const { data, error } = await admin
    .from('czf_seasons')
    .select('id, name, status')
    .eq('status', 'active')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const admin = getAdmin();
    const identity = await getIdentity(request, admin);

    if (!identity) {
      return failure('Connexion ou profil joueur requis.', 401);
    }

    const team = await getTeamContext(admin, identity);

    if (!team) {
      return failure('Aucune équipe associée.', 403);
    }

    const season = await getActiveSeason(admin);

    if (!season) {
      return NextResponse.json({
        success: true,
        slots: [],
      });
    }

    const { data: registration, error: registrationError } =
      await admin
        .from('czf_season_teams')
        .select('team_id')
        .eq('season_id', season.id)
        .eq('team_id', team.teamId)
        .maybeSingle();

    if (registrationError) throw registrationError;

    if (!registration) {
      return NextResponse.json({
        success: true,
        slots: [],
      });
    }

    const { data: fixtures, error: fixtureError } = await admin
      .from('czf_fixtures')
      .select('id')
      .eq('season_id', season.id)
      .or(
        `team1_id.eq.${team.teamId},team2_id.eq.${team.teamId}`
      );

    if (fixtureError) throw fixtureError;

    const fixtureIds = (fixtures || []).map(
      (fixture: any) => fixture.id
    );

    if (fixtureIds.length === 0) {
      return NextResponse.json({
        success: true,
        slots: [],
      });
    }

    const { data: slots, error: slotError } = await admin
      .from('czf_tournament_game_slots')
      .select(
        'id, fixture_id, game_number, status, tournament_code, riot_match_id, validation_error'
      )
      .in('fixture_id', fixtureIds)
      .order('game_number', { ascending: true });

    if (slotError) throw slotError;

    // Aucun code privé n'est exposé tant que
    // le système Riot n'est pas opérationnel.
    return NextResponse.json(
      {
        success: true,
        slots: (slots || []).map((slot: any) => ({
          id: slot.id,
          fixtureId: slot.fixture_id,
          gameNumber: slot.game_number,
          status: slot.status,
          hasCode: Boolean(slot.tournament_code),
          hasRiotMatch: Boolean(slot.riot_match_id),
          needsReview: Boolean(slot.validation_error),
        })),
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('[MY FIXTURE GAMES GET]', error);

    return failure(
      'Impossible de charger les games.',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdmin();
    const identity = await getIdentity(request, admin);

    if (!identity) {
      return failure('Connexion ou profil joueur requis.', 401);
    }

    const team = await getTeamContext(admin, identity);

    if (!team?.isCaptain) {
      return failure(
        'Seul un capitaine peut préparer les games.',
        403
      );
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return failure('JSON invalide.', 400);
    }

    if (!payload || typeof payload !== 'object') {
      return failure('Données invalides.', 400);
    }

    const fixtureId = (payload as Record<string, unknown>)
      .fixtureId;

    if (
      typeof fixtureId !== 'number' ||
      !Number.isSafeInteger(fixtureId) ||
      fixtureId <= 0
    ) {
      return failure('Rencontre invalide.', 400);
    }

    const season = await getActiveSeason(admin);

    if (!season) {
      return failure('Aucune saison active.', 409);
    }

    const { data: fixture, error: fixtureError } = await admin
      .from('czf_fixtures')
      .select(
        'id, season_id, division, team1_id, team2_id, best_of, status, match_id'
      )
      .eq('id', fixtureId)
      .eq('season_id', season.id)
      .maybeSingle();

    if (fixtureError) throw fixtureError;

    if (!fixture) {
      return failure('Rencontre introuvable.', 404);
    }

    const belongsToTeam =
      Number(fixture.team1_id) === team.teamId ||
      Number(fixture.team2_id) === team.teamId;

    if (!belongsToTeam) {
      return failure(
        "Tu n'es pas capitaine d'une équipe de ce match.",
        403
      );
    }

    if (
      fixture.match_id !== null ||
      !['pending', 'scheduled'].includes(fixture.status)
    ) {
      return failure(
        'Cette rencontre ne peut plus être préparée.',
        409
      );
    }

    const { data: registrations, error: registrationError } =
      await admin
        .from('czf_season_teams')
        .select('team_id')
        .eq('season_id', fixture.season_id)
        .eq('division', fixture.division)
        .in('team_id', [
          fixture.team1_id,
          fixture.team2_id,
        ]);

    if (registrationError) throw registrationError;

    const registeredIds = new Set(
      (registrations || []).map(
        (item: any) => Number(item.team_id)
      )
    );

    if (
      !registeredIds.has(Number(fixture.team1_id)) ||
      !registeredIds.has(Number(fixture.team2_id))
    ) {
      return failure(
        "Une équipe n'est plus inscrite à cette édition.",
        409
      );
    }

    const bestOf = Number(fixture.best_of);

    if (![2, 3, 5].includes(bestOf)) {
      return failure('Format de BO non reconnu.', 409);
    }

    const records = Array.from(
      { length: bestOf },
      (_, index) => ({
        fixture_id: fixture.id,
        game_number: index + 1,
        status: 'pending',
      })
    );

    // Un slot existant est conservé.
    // Deux capitaines peuvent cliquer sans créer de doublons.
    const { error: insertError } = await admin
      .from('czf_tournament_game_slots')
      .upsert(records, {
        onConflict: 'fixture_id,game_number',
        ignoreDuplicates: true,
      });

    if (insertError) throw insertError;

    const { data: slots, error: slotsError } = await admin
      .from('czf_tournament_game_slots')
      .select('id, fixture_id, game_number, status')
      .eq('fixture_id', fixture.id)
      .order('game_number', { ascending: true });

    if (slotsError) throw slotsError;

    return NextResponse.json({
      success: true,
      message: 'Games préparées avec succès.',
      slots: (slots || []).map((slot: any) => ({
        id: slot.id,
        fixtureId: slot.fixture_id,
        gameNumber: slot.game_number,
        status: slot.status,
      })),
    });
  } catch (error) {
    console.error('[MY FIXTURE GAMES POST]', error);

    return failure(
      'Impossible de préparer les games.',
      500
    );
  }
}
