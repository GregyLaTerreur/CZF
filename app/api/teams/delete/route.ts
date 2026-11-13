import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/auth';
import { loadManageableTeam } from '@/lib/teams/permissions';
import { invalidateResults } from '@/lib/results/cache';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Le capitaine (ou un admin) supprime l'équipe, ses membres et ses candidatures.
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = Number(body.team_id);
  if (!Number.isInteger(teamId) || teamId <= 0) return fail('team_id manquant', 400);

  const { team, allowed } = await loadManageableTeam(teamId, auth.user, auth.isAdmin);
  if (!team) return fail('Équipe introuvable.', 404);
  if (!allowed) return fail("Seul le capitaine de l'équipe ou un admin peut la supprimer.", 403);

  const { error: membersError } = await supabaseAdmin.from('team_members').delete().eq('team_id', teamId);
  // En prod, service_role n'a pas SELECT sur team_join_requests : repli sur le client anon
  // tant que le GRANT n'est pas fait (la permission a déjà été vérifiée plus haut).
  let { error: requestsError } = await supabaseAdmin.from('team_join_requests').delete().eq('team_id', teamId);
  if (requestsError) {
    ({ error: requestsError } = await supabase.from('team_join_requests').delete().eq('team_id', teamId));
  }
  const { error } = await supabaseAdmin.from('teams').delete().eq('id', teamId);

  if (membersError || requestsError) console.error('[teams DELETE]', membersError || requestsError);

  if (error) {
    console.error('[teams DELETE]', error);
    return fail("Erreur lors de la suppression de l'équipe.", 500);
  }

  invalidateResults();

  return NextResponse.json({ success: true });
}
