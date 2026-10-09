
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type FixtureRow = {
  id: number;
  division: string;
  stage: string;
  best_of: number;
  round_number: number | null;
  team1_id: number;
  team2_id: number;
  scheduled_at: string | null;
  status: string;
  match_id: number | null;
};

type TeamRow = {
  id: number;
  name: string;
  logo_url: string | null;
};

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration Supabase manquante.',
        },
        { status: 500 }
      );
    }

    const db = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: season, error: seasonError } = await db
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
        matches: [],
      });
    }

    // Une seule chaîne pour éviter les erreurs
    // d'inférence TypeScript avec Supabase.
    const { data: fixturesData, error: fixturesError } =
      await db
        .from('czf_fixtures')
        .select('id, division, stage, best_of, round_number, team1_id, team2_id, scheduled_at, status, match_id')
        .eq('season_id', season.id)
        .eq('status', 'scheduled')
        .not('scheduled_at', 'is', null)
        .is('match_id', null)
        .order('scheduled_at', { ascending: true });

    if (fixturesError) throw fixturesError;

    const fixtures = (fixturesData || []) as FixtureRow[];

    const teamIds = [
      ...new Set(
        fixtures.flatMap((fixture) => [
          Number(fixture.team1_id),
          Number(fixture.team2_id),
        ])
      ),
    ];

    if (teamIds.length === 0) {
      return NextResponse.json({
        success: true,
        season: season.name,
        matches: [],
      });
    }

    const { data: teamsData, error: teamsError } = await db
      .from('teams')
      .select('id, name, logo_url')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    const teams = (teamsData || []) as TeamRow[];

    const teamMap = new Map(
      teams.map((team) => [
        Number(team.id),
        {
          id: Number(team.id),
          name: String(team.name || 'Équipe'),
          logo: team.logo_url || null,
        },
      ])
    );

    const matches = fixtures.map((fixture) => ({
      id: Number(fixture.id),
      division: fixture.division,
      stage: fixture.stage,
      bestOf: Number(fixture.best_of),
      roundNumber: fixture.round_number,
      scheduledAt: fixture.scheduled_at,
      team1: teamMap.get(Number(fixture.team1_id)) || {
        id: Number(fixture.team1_id),
        name: 'Équipe 1',
        logo: null,
      },
      team2: teamMap.get(Number(fixture.team2_id)) || {
        id: Number(fixture.team2_id),
        name: 'Équipe 2',
        logo: null,
      },
    }));

    return NextResponse.json(
      {
        success: true,
        season: season.name,
        matches,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[CZF PLANNING]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de charger le planning.',
      },
      { status: 500 }
    );
  }
}
