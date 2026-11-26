import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadSeasons, resolveSeasonId } from '@/lib/tcg/seasons';
import { isSeasonLaunched } from '@/lib/tcg/choices';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Notes enregistrées (czf_player_rating) de la saison, avec joueur, équipe, division et rôle. Pour Admin > Notes.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const seasonId = await resolveSeasonId(new URL(request.url).searchParams.get('season'));
  if (!seasonId) return fail('Aucune saison.', 404);

  const [ratings, seasons, launched] = await Promise.all([
    supabaseAdmin
      .from('czf_player_rating')
      .select('player_id, note, ipi, score_kda, score_gpm, score_dpm, score_cs, score_kp, score_vision, computed_at')
      .eq('season_id', seasonId)
      .limit(5000),
    loadSeasons(),
    isSeasonLaunched(seasonId),
  ]);
  if (ratings.error) return fail('Impossible de lire les notes (table czf_player_rating ?).', 500);

  const ids = (ratings.data || []).map((r) => r.player_id);
  const [players, members, teams] = await Promise.all([
    supabaseAdmin.from('players').select('id, riot_id, main_role').in('id', ids.length ? ids : [0]),
    supabaseAdmin.from('team_members').select('team_id, player_id, role').in('player_id', ids.length ? ids : [0]),
    supabaseAdmin.from('teams').select('id, name, division, validated_by_admin').limit(1000),
  ]);

  const playerById = new Map((players.data || []).map((p) => [p.id, p]));
  const teamById = new Map((teams.data || []).map((t) => [t.id, t]));
  // Équipe validée en priorité si le joueur apparaît dans plusieurs rosters.
  const memberByPlayer = new Map<number, { team_id: number; role: string | null }>();
  for (const m of members.data || []) {
    const current = memberByPlayer.get(m.player_id);
    if (!current || (!teamById.get(current.team_id)?.validated_by_admin && teamById.get(m.team_id)?.validated_by_admin)) memberByPlayer.set(m.player_id, m);
  }

  const rows = (ratings.data || []).map((r) => {
    const player = playerById.get(r.player_id);
    const member = memberByPlayer.get(r.player_id);
    const team = member ? teamById.get(member.team_id) : null;
    return {
      ...r,
      ipi: r.ipi === null ? null : Number(r.ipi),
      riot_id: player?.riot_id ?? null,
      role: member?.role ?? player?.main_role ?? null,
      team: team?.name ?? null,
      division: team?.division ?? null,
    };
  });

  return NextResponse.json({ success: true, season: seasons.find((s) => s.id === seasonId) ?? { id: seasonId, name: `Saison ${seasonId}` }, launched, ratings: rows });
}
