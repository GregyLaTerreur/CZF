import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';

const normalizeRiotId = (value: any) => String(value || '').trim().toLowerCase();

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Un admin retire un joueur d'un roster (le capitaine reste : l'équipe en dépend).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return fail('Non connecté.', 401);

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return fail('Session invalide.', 401);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profile?.is_admin !== true) return fail('Accès admin requis.', 403);

  const { id } = await params;

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, team_id, player_id, riot_id')
    .eq('id', Number(id))
    .maybeSingle();

  if (!member) return fail('Membre introuvable.', 404);

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('captain_player_id, captain_riot_id')
    .eq('id', member.team_id)
    .maybeSingle();

  const isCaptain =
    team &&
    ((member.player_id && Number(member.player_id) === Number(team.captain_player_id)) ||
      normalizeRiotId(member.riot_id) === normalizeRiotId(team.captain_riot_id));

  if (isCaptain) return fail('Impossible de retirer le capitaine de son équipe.', 400);

  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', member.id);
  if (error) return fail('Impossible de retirer le joueur.', 500);

  invalidateResults();

  return NextResponse.json({ success: true, riot_id: member.riot_id });
}
