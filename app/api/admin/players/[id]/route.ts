import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { linkPlayerRiotAccount } from '@/lib/riot/link-account';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Un admin modifie un joueur : Riot ID (vérifié chez Riot), rôles, LFT.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const body = await request.json().catch(() => ({}));

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle();

  if (!player) return fail('Joueur introuvable.', 404);

  const mainRole = body.main_role ?? player.main_role;
  const secondaryRole = body.secondary_role || null;

  if (mainRole && !ROLES.includes(mainRole)) return fail('Rôle principal invalide.', 400);
  if (secondaryRole && !ROLES.includes(secondaryRole)) return fail('Rôle secondaire invalide.', 400);
  if (secondaryRole && secondaryRole === mainRole) {
    return fail('Le rôle secondaire doit être différent du principal.', 400);
  }

  // Riot ID changé : même chemin que le profil (compte, rang, points, rosters).
  const riotId = String(body.riot_id ?? '').trim();
  let finalRiotId = player.riot_id;

  if (riotId && riotId.toLowerCase() !== String(player.riot_id || '').trim().toLowerCase()) {
    const result = await linkPlayerRiotAccount(player, riotId, new URL(request.url).origin);
    if (!result.ok) return fail(result.message, result.status);
    finalRiotId = result.riotId;
  }

  const { error } = await supabaseAdmin
    .from('players')
    .update({
      main_role: mainRole,
      secondary_role: secondaryRole,
      lft: Boolean(body.lft ?? player.lft),
    })
    .eq('id', player.id);

  if (error) return fail('Impossible d’enregistrer le joueur.', 500);

  invalidateResults();

  return NextResponse.json({ success: true, riot_id: finalRiotId });
}
