import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function isAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return false;

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !auth.user) return false;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', auth.user.id)
    .maybeSingle();

  return profile?.is_admin === true;
}

// Supprime un BO saisi à la main : stats des games, games, propositions MVP
// puis le match. La rencontre planifiée liée est gardée et repasse « à jouer ».
// Pas de cascade en base : on supprime dans l'ordre des clés étrangères.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(request))) {
    return reply({ success: false, error: 'Accès administrateur refusé.' }, 401);
  }

  const matchId = Number((await params).id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return reply({ success: false, error: 'Match invalide.' }, 400);
  }

  try {
    const { data: match, error: matchError } = await supabaseAdmin
      .from('czf_matches')
      .select('id')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return reply({ success: false, error: 'Match introuvable.' }, 404);

    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from('czf_fixtures')
      .select('id')
      .eq('match_id', matchId);

    if (fixturesError) throw fixturesError;

    const fixtureIds = (fixtures || []).map((fixture) => fixture.id);

    // Un BO publié depuis Riot se gère depuis /admin/riot, pas ici.
    if (fixtureIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('czf_tournament_game_slots')
        .select('id', { count: 'exact', head: true })
        .in('fixture_id', fixtureIds)
        .not('riot_match_id', 'is', null);

      if (error) throw error;

      if (count) {
        return reply(
          { success: false, error: 'Ce BO vient du système Riot : il ne peut pas être supprimé ici.' },
          409
        );
      }
    }

    const { data: games, error: gamesError } = await supabaseAdmin
      .from('czf_games')
      .select('id')
      .eq('match_id', matchId);

    if (gamesError) throw gamesError;

    const gameIds = (games || []).map((game) => game.id);

    const steps = [
      () =>
        gameIds.length > 0
          ? supabaseAdmin.from('czf_game_player_stats').delete().in('game_id', gameIds)
          : Promise.resolve({ error: null }),
      () => supabaseAdmin.from('czf_mvp_proposals').delete().eq('match_id', matchId),
      () =>
        supabaseAdmin
          .from('czf_fixtures')
          .update({ match_id: null, status: 'pending' })
          .eq('match_id', matchId),
      () => supabaseAdmin.from('czf_games').delete().eq('match_id', matchId),
      () => supabaseAdmin.from('czf_matches').delete().eq('id', matchId),
    ];

    for (const step of steps) {
      const { error } = await step();
      if (error) throw error;
    }

    return reply({ success: true, deleted: { matchId, games: gameIds.length } });
  } catch (error: any) {
    console.error('[CZF ADMIN RESULTS DELETE]', error);
    return reply({ success: false, error: error?.message || 'Suppression impossible.' }, 500);
  }
}
