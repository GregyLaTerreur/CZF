import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { linkPlayerRiotAccount } from '@/lib/riot/link-account';

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Change le compte Riot du joueur connecté (pseudo renommé ou autre compte).
export async function PATCH(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return fail('Tu dois être connecté avec Discord.', 401);

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return fail('Session invalide. Reconnecte-toi avec Discord.', 401);

  const body = await request.json().catch(() => ({}));

  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (playerError) return fail('Impossible de charger ton profil joueur.', 500);
  if (!player) return fail('Tu n’as pas de profil joueur.', 404);

  const result = await linkPlayerRiotAccount(player, String(body.riot_id || '').trim(), new URL(request.url).origin);
  if (!result.ok) return fail(result.message, result.status);

  invalidateResults();

  return NextResponse.json({ success: true, riot_id: result.riotId });
}
