
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type FixtureRow = {
  id: number;
  season_id: number;
  division: string;
  stage: string;
  round_number: number | null;
  team1_id: number;
  team2_id: number;
  best_of: number;
  scheduled_at: string | null;
  status: string;
  match_id: number | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse('Configuration Supabase manquante.', 500);
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Le serveur vérifie lui-même l'identité.
    // On ne fait jamais confiance à un team_id du navigateur.
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;

    if (!token) {
      return errorResponse('Connexion nécessaire.', 401);
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return errorResponse('Session invalide.', 401);
    }

    const userId = authData.user.id;

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, profile_id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return NextResponse.json({
        success: true,
        teamId: null,
        season: null,
        fixtures: [],
      });
    }

    const { data: captainTeams, error: captainError } =
      await supabase
        .from('teams')
        .select('id')
        .eq('captain_player_id', player.id)
        .limit(1);

    if (captainError) throw captainError;

    const { data: memberships, error: memberError } =
      await supabase
        .from('team_members')
        .select('team_id')
        .eq('player_id', player.id)
        .limit(1);

    if (memberError) throw memberError;

    const teamId =
      captainTeams?.[0]?.id ??
      memberships?.[0]?.team_id ??
      null;

    if (!teamId) {
      return NextResponse.json({
        success: true,
        teamId: null,
        season: null,
        fixtures: [],
      });
    }

    const { data: seasons, error: seasonsError } = await supabase
      .from('czf_seasons')
      .select('id, name, status')
      .eq('status', 'active')
      .order('id', { ascending: false })
      .limit(1);

    if (seasonsError) throw seasonsError;

    const season = seasons?.[0] ?? null;

    if (!season) {
      return NextResponse.json({
        success: true,
        teamId,
        season: null,
        fixtures: [],
      });
    }

    // Vérifier que l'équipe appartient bien à cette édition.
    const { data: seasonMembership, error: seasonTeamError } =
      await supabase
        .from('czf_season_teams')
        .select('team_id, division')
        .eq('season_id', season.id)
        .eq('team_id', teamId)
        .maybeSingle();

    if (seasonTeamError) throw seasonTeamError;

    if (!seasonMembership) {
      return NextResponse.json({
        success: true,
        teamId,
        season,
        fixtures: [],
      });
    }

    const { data: fixturesData, error: fixturesError } =
      await supabase
        .from('czf_fixtures')
        .select('*')
        .eq('season_id', season.id)
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
        .order('id', { ascending: true });

    if (fixturesError) throw fixturesError;

    const fixtureRows = (fixturesData ?? []) as FixtureRow[];

    if (fixtureRows.length === 0) {
      return NextResponse.json({
        success: true,
        teamId,
        season,
        fixtures: [],
      });
    }

    const teamIds = [
      ...new Set(
        fixtureRows.flatMap((f) => [f.team1_id, f.team2_id])
      ),
    ];

    const matchIds = [
      ...new Set(
        fixtureRows
          .map((f) => f.match_id)
          .filter((id): id is number => id !== null)
      ),
    ];

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    let games: {
      match_id: number;
      winner_team_id: number;
    }[] = [];

    if (matchIds.length > 0) {
      const { data, error } = await supabase
        .from('czf_games')
        .select('match_id, winner_team_id')
        .in('match_id', matchIds);

      if (error) throw error;

      games = data ?? [];
    }

    const teamMap = new Map(
      (teams ?? []).map((team) => [Number(team.id), team])
    );

    const fixtures = fixtureRows.map((fixture) => {
      const team1 = teamMap.get(Number(fixture.team1_id));
      const team2 = teamMap.get(Number(fixture.team2_id));

      const matchGames = games.filter(
        (game) => Number(game.match_id) === Number(fixture.match_id)
      );

      const score1 = matchGames.filter(
        (game) =>
          Number(game.winner_team_id) === Number(fixture.team1_id)
      ).length;

      const score2 = matchGames.filter(
        (game) =>
          Number(game.winner_team_id) === Number(fixture.team2_id)
      ).length;

      return {
        id: fixture.id,
        division: fixture.division,
        stage: fixture.stage,
        roundNumber: fixture.round_number,
        bestOf: fixture.best_of,
        scheduledAt: fixture.scheduled_at,
        status: fixture.status,
        matchId: fixture.match_id,
        isCaptainTeam1: Number(teamId) === Number(fixture.team1_id),
        team1: {
          id: fixture.team1_id,
          name: team1?.name ?? 'Équipe inconnue',
          logo: team1?.logo_url ?? null,
          score: fixture.status === 'completed' ? score1 : null,
        },
        team2: {
          id: fixture.team2_id,
          name: team2?.name ?? 'Équipe inconnue',
          logo: team2?.logo_url ?? null,
          score: fixture.status === 'completed' ? score2 : null,
        },
      };
    });

    return NextResponse.json(
      {
        success: true,
        teamId,
        season,
        fixtures,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[MY FIXTURES]', error);
    return errorResponse('Impossible de charger les rencontres.', 500);
  }
}
