// Accès au TCG (en bêta) : tout le TCG est réservé aux profils is_betatest. Parmi eux, boosters et cartes
// demandent en plus un compte Riot lié ; la collection globale, le classement et les autres collections non.
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireAdmin, requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Access = { user: User; error?: undefined } | { error: NextResponse; user?: undefined };

// Bêta-testeur ? Requête à part de is_admin : si la colonne manque encore, seul le TCG est fermé.
export async function isBetaTester(profileId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('profiles').select('is_betatest').eq('id', profileId).maybeSingle();
  return !error && data?.is_betatest === true;
}

const notBeta = () =>
  NextResponse.json({ success: false, code: 'BETA_REQUISE', message: 'Le TCG est en bêta, réservé aux bêta-testeurs.' }, { status: 403 });

// Connecté et bêta-testeur (collection globale, classement, collections des autres).
export async function requireTcgBeta(request: Request): Promise<Access> {
  const auth = await requireUser(request);
  if (auth.error) return auth;
  if (!(await isBetaTester(auth.user.id))) return { error: notBeta() };
  return { user: auth.user };
}

// Admin et bêta-testeur (gestion du TCG).
export async function requireTcgAdmin(request: Request): Promise<Access> {
  const auth = await requireAdmin(request);
  if (auth.error) return auth;
  if (!(await isBetaTester(auth.user.id))) return { error: notBeta() };
  return { user: auth.user };
}

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

// Profils autorisés à avoir des boosters et des cartes : bêta-testeurs liés à un compte Riot.
export async function eligibleProfiles(among?: string[]): Promise<string[]> {
  let query = supabaseAdmin.from('players').select('profile_id').not('profile_id', 'is', null).not('riot_id', 'is', null).limit(10000);
  if (among) query = query.in('profile_id', among.length ? among : ['00000000-0000-0000-0000-000000000000']);
  const { data } = await query;
  const linked = [...new Set((data || []).map((row) => row.profile_id as string))];
  if (!linked.length) return [];
  const { data: beta, error } = await supabaseAdmin.from('profiles').select('id').eq('is_betatest', true).in('id', linked);
  return error ? [] : (beta || []).map((row) => row.id as string);
}

// Bêta-testeur ET compte Riot lié (boosters, cartes).
export async function requireTcgPlayer(request: Request): Promise<Access> {
  const auth = await requireTcgBeta(request);
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
