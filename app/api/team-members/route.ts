import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/auth';
import { loadManageableTeam } from '@/lib/teams/permissions';
import { invalidateResults } from '@/lib/results/cache';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

const normalize = (riotId: unknown) => String(riotId ?? '').trim().toLowerCase();

export async function GET() {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[team-members GET]', error);
    return fail('Impossible de charger les membres.', 500);
  }

  return NextResponse.json({ success: true, data });
}

// Pas de POST : un joueur entre dans une équipe par une candidature acceptée
// (/api/team-join-requests) ou par un admin (/api/admin/team-members).

// Un joueur quitte son équipe, ou le capitaine / un admin retire un joueur.
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = Number(body.team_id);
  const riotId = String(body.riot_id ?? '').trim();

  if (!Number.isInteger(teamId) || teamId <= 0 || !riotId) return fail('team_id ou riot_id manquant', 400);

  const { team, allowed: canManage } = await loadManageableTeam(teamId, auth.user, auth.isAdmin);
  if (!team) return fail('Équipe introuvable.', 404);

  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('id, riot_id, player_id')
    .eq('team_id', teamId);

  const member = (members || []).find((m) => normalize(m.riot_id) === normalize(riotId));
  if (!member) return fail("Ce joueur n'est pas dans l'équipe.", 404);

  const { data: myPlayer } = await supabaseAdmin
    .from('players')
    .select('id, riot_id')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  const isSelf =
    !!myPlayer &&
    (Number(member.player_id) === Number(myPlayer.id) || normalize(member.riot_id) === normalize(myPlayer.riot_id));

  if (!canManage && !isSelf) return fail("Seul le capitaine, un admin ou le joueur lui-même peut faire ça.", 403);

  // Le capitaine ne quitte pas son équipe : il la supprime (ou un admin change le capitaine).
  const isCaptain =
    (team.captain_player_id && Number(member.player_id) === Number(team.captain_player_id)) ||
    (isSelf && team.captain_profile_id === auth.user.id);
  if (isCaptain && !auth.isAdmin) return fail("Le capitaine ne peut pas être retiré de l'équipe.", 400);

  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', member.id);

  if (error) {
    console.error('[team-members DELETE]', error);
    return fail('Erreur lors du retrait du joueur.', 500);
  }

  invalidateResults();

  return NextResponse.json({ success: true });
}
