
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return errorResponse('Configuration manquante.', 500);
    }

    const db = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authorization =
      request.headers.get('authorization') || '';

    if (!authorization.startsWith('Bearer ')) {
      return errorResponse('Connexion requise.', 401);
    }

    const token = authorization.substring(7).trim();

    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Session invalide.', 401);
    }

    const { data: profile, error: profileError } =
      await db
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || profile?.is_admin !== true) {
      return errorResponse('Accès admin refusé.', 403);
    }

    const { data: season, error: seasonError } =
      await db
        .from('czf_seasons')
        .select('id, name')
        .eq('status', 'active')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (seasonError) throw seasonError;

    if (!season) {
      return NextResponse.json({
        success: true,
        season: null,
        fixtures: [],
      });
    }

    const { data: fixtures, error: fixturesError } =
      await db
        .from('czf_fixtures')
        .select(
          'id, division, stage, best_of, round_number, team1_id, team2_id, status, match_id, scheduled_at'
        )
        .eq('season_id', season.id)
        .order('id', { ascending: false });

    if (fixturesError) throw fixturesError;

    const openFixtures = (fixtures || []).filter(
      (fixture) =>
        fixture.match_id == null &&
        fixture.status !== 'cancelled' &&
        fixture.status !== 'completed'
    );

    if (openFixtures.length === 0) {
      return NextResponse.json({
        success: true,
        season: season.name,
        fixtures: [],
      });
    }

    const fixtureIds = openFixtures.map((f) => Number(f.id));

    const teamIds = [
      ...new Set(
        openFixtures.flatMap((f) => [
          Number(f.team1_id),
          Number(f.team2_id),
        ])
      ),
    ];

    const [slotsResult, teamsResult] = await Promise.all([
      db
        .from('czf_tournament_game_slots')
        .select(
          'id, fixture_id, game_number, status, riot_match_id, validation_error'
        )
        .in('fixture_id', fixtureIds),

      db
        .from('teams')
        .select('id, name, logo_url')
        .in('id', teamIds),
    ]);

    if (slotsResult.error) throw slotsResult.error;
    if (teamsResult.error) throw teamsResult.error;

    const slots = slotsResult.data || [];

    // N'afficher que les rencontres ayant
    // au moins un emplacement Riot préparé.
    if (slots.length === 0) {
      return NextResponse.json({
        success: true,
        season: season.name,
        fixtures: [],
      });
    }

    const slotIds = slots.map((slot) => Number(slot.id));

    const [importsResult, validationsResult] =
      await Promise.all([
        db
          .from('czf_riot_match_imports')
          .select(
            'slot_id, riot_match_id, status, attempts, last_error'
          )
          .in('slot_id', slotIds),

        db
          .from('czf_riot_roster_validations')
          .select('slot_id, riot_match_id, status, details')
          .in('slot_id', slotIds),
      ]);

    if (importsResult.error) throw importsResult.error;
    if (validationsResult.error) throw validationsResult.error;

    const teamMap = new Map(
      (teamsResult.data || []).map((t) => [
        Number(t.id),
        {
          id: Number(t.id),
          name: String(t.name || 'Équipe'),
          logo: t.logo_url || null,
        },
      ])
    );

    const importMap = new Map(
      (importsResult.data || []).map((i) => [
        Number(i.slot_id),
        i,
      ])
    );

    const validationMap = new Map(
      (validationsResult.data || []).map((v) => [
        Number(v.slot_id),
        v,
      ])
    );

    const slotsByFixture = new Map<number, typeof slots>();

    for (const slot of slots) {
      const fixtureId = Number(slot.fixture_id);
      const list = slotsByFixture.get(fixtureId) || [];
      list.push(slot);
      slotsByFixture.set(fixtureId, list);
    }

    const responseFixtures = openFixtures
      .filter((fixture) =>
        slotsByFixture.has(Number(fixture.id))
      )
      .map((fixture) => ({
        id: Number(fixture.id),
        division: fixture.division,
        stage: fixture.stage,
        bestOf: Number(fixture.best_of),
        roundNumber: fixture.round_number,
        status: fixture.status,
        scheduledAt: fixture.scheduled_at,
        team1:
          teamMap.get(Number(fixture.team1_id)) || {
            id: Number(fixture.team1_id),
            name: 'Équipe 1',
            logo: null,
          },
        team2:
          teamMap.get(Number(fixture.team2_id)) || {
            id: Number(fixture.team2_id),
            name: 'Équipe 2',
            logo: null,
          },
        games: (slotsByFixture.get(Number(fixture.id)) || [])
          .sort(
            (a, b) =>
              Number(a.game_number) -
              Number(b.game_number)
          )
          .map((slot) => {
            const imported = importMap.get(Number(slot.id));
            const validation = validationMap.get(Number(slot.id));

            return {
              number: Number(slot.game_number),
              status: slot.status,
              hasRiotMatch: Boolean(slot.riot_match_id),
              importStatus: imported?.status || null,
              importAttempts: imported?.attempts || 0,
              importError: imported?.last_error || null,
              rosterStatus: validation?.status || null,
              rosterDetails: validation?.details || null,
              validationError: slot.validation_error || null,
            };
          }),
      }));

    return NextResponse.json(
      {
        success: true,
        season: season.name,
        fixtures: responseFixtures,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[CZF RIOT REVIEW]', error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Erreur de chargement Riot.',
      500
    );
  }
}
