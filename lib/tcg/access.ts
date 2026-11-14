// Accès au TCG : boosters et cartes réservés aux joueurs connectés avec Discord ET liés à un compte Riot.
// La collection globale, le classement et les collections des autres restent publics.
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Profil lié à un joueur avec un Riot ID.
export async function hasRiotAccount(profileId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('profile_id', profileId)
    .not('riot_id', 'is', null)
    .limit(1);
  return Boolean(data?.length);
}

// Profils autorisés à recevoir des boosters (liés à un compte Riot), éventuellement parmi une liste.
export async function eligibleProfiles(among?: string[]): Promise<string[]> {
  let query = supabaseAdmin.from('players').select('profile_id').not('profile_id', 'is', null).not('riot_id', 'is', null).limit(10000);
  if (among) query = query.in('profile_id', among.length ? among : ['00000000-0000-0000-0000-000000000000']);
  const { data } = await query;
  return [...new Set((data || []).map((row) => row.profile_id as string))];
}

type Access = { user: User; error?: undefined } | { error: NextResponse; user?: undefined };

// Comme requireUser, et refuse un compte qui n'a pas lié son Riot ID.
export async function requireTcgPlayer(request: Request): Promise<Access> {
  const auth = await requireUser(request);
  if (auth.error) return auth;
  if (!(await hasRiotAccount(auth.user.id))) {
    return {
      error: NextResponse.json(
        { success: false, code: 'RIOT_REQUIS', message: 'Lie ton compte Riot à ton profil pour obtenir des boosters et des cartes.' },
        { status: 403 }
      ),
    };
  }
  return { user: auth.user };
}
