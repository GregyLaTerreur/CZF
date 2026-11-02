import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { linkMemberRiotAccount, linkPlayerRiotAccount } from '@/lib/riot/link-account';

const normalizeRiotId = (value: any) => String(value || '').trim().toLowerCase();

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Le capitaine (ou un admin) change le Riot ID d'un joueur de son roster.
export async function PATCH(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return fail('Tu dois être connecté avec Discord.', 401);

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return fail('Session invalide. Reconnecte-toi avec Discord.', 401);

  const body = await request.json().catch(() => ({}));
  const riotId = String(body.riot_id || '').trim();

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('*')
    .eq('id', Number(body.member_id))
    .maybeSingle();

  if (!member) return fail('Joueur introuvable dans le roster.', 404);

  const [{ data: team }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('teams').select('id, captain_profile_id').eq('id', member.team_id).maybeSingle(),
    supabaseAdmin.from('profiles').select('is_admin').eq('id', auth.user.id).maybeSingle(),
  ]);

  if (!team) return fail('Équipe introuvable.', 404);
  if (team.captain_profile_id !== auth.user.id && profile?.is_admin !== true) {
    return fail('Seul le capitaine peut modifier les Riot ID de l’équipe.', 403);
  }

  // Joueur CZF du membre : par player_id, sinon par Riot ID (anciennes lignes).
  let player: any = null;

  if (member.player_id) {
    ({ data: player } = await supabaseAdmin.from('players').select('*').eq('id', member.player_id).maybeSingle());
  } else {
    const { data: candidates } = await supabaseAdmin.from('players').select('*').ilike('riot_id', member.riot_id);
    player = (candidates || []).find((p: any) => normalizeRiotId(p.riot_id) === normalizeRiotId(member.riot_id)) || null;
  }

  const origin = new URL(request.url).origin;
  const result = player
    ? await linkPlayerRiotAccount(player, riotId, origin)
    : await linkMemberRiotAccount(member, riotId, origin);

  if (!result.ok) return fail(result.message, result.status);

  invalidateResults();

  return NextResponse.json({ success: true, riot_id: result.riotId });
}
