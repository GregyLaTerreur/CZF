import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/auth';
import { isAllowedLogoUrl } from '@/lib/logo';
import { loadManageableTeam } from '@/lib/teams/permissions';
import { invalidateResults } from '@/lib/results/cache';

const NAME_MAX = 50;
const DESCRIPTION_MAX = 500;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Vide = pas de logo ; sinon une image https d'un hébergeur connu.
function checkLogo(logoUrl: unknown): string | null | { error: string } {
  const value = String(logoUrl ?? '').trim();
  if (!value) return null;
  if (!isAllowedLogoUrl(value)) {
    return { error: 'Logo : lien https vers imgur, noelshack, Discord, ibb ou Cloudinary uniquement.' };
  }
  return value;
}

function checkMultigg(url: unknown): string | null | { error: string } {
  const value = String(url ?? '').trim();
  if (!value) return null;
  try {
    if (new URL(value).protocol === 'https:') return value;
  } catch {}
  return { error: 'Lien multi OP.GG invalide.' };
}

export async function GET() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[teams GET]', error);
    return fail('Impossible de charger les équipes.', 500);
  }

  return NextResponse.json({ success: true, data });
}

// Un joueur connecté crée son équipe et en devient capitaine.
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));

  const name = String(body.name ?? '').trim();
  if (!name) return fail("Le nom de l'équipe est obligatoire.", 400);
  if (name.length > NAME_MAX) return fail(`Nom trop long (${NAME_MAX} caractères max).`, 400);

  const description = String(body.description ?? '').trim().slice(0, DESCRIPTION_MAX) || null;

  const logo = checkLogo(body.logo_url);
  if (logo && typeof logo === 'object') return fail(logo.error, 400);

  const multigg = checkMultigg(body.multigg_url);
  if (multigg && typeof multigg === 'object') return fail(multigg.error, 400);

  // Le capitaine est toujours le joueur du compte connecté, jamais celui envoyé par le navigateur.
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id, riot_id')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (!player) return fail("Crée d'abord ton profil joueur.", 400);

  const [{ data: captainOf }, { data: memberOf }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id')
      .or(`captain_profile_id.eq.${auth.user.id},captain_player_id.eq.${player.id}`)
      .limit(1),
    supabaseAdmin.from('team_members').select('id').eq('player_id', player.id).limit(1),
  ]);

  if (captainOf?.length || memberOf?.length) return fail('Tu as déjà une équipe.', 409);

  const { data, error } = await supabaseAdmin
    .from('teams')
    .insert([
      {
        name,
        captain_riot_id: player.riot_id,
        captain_profile_id: auth.user.id,
        captain_player_id: player.id,
        description,
        logo_url: logo,
        multigg_url: multigg,
      },
    ])
    .select();

  if (error) {
    console.error('[teams POST]', error);
    return fail("Erreur lors de la création de l'équipe.", 500);
  }

  return NextResponse.json({ success: true, data });
}

// Le capitaine (ou un admin) modifie son équipe. Champ absent = inchangé.
export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));

  const teamId = Number(body.team_id);
  if (!Number.isInteger(teamId) || teamId <= 0) return fail('team_id manquant', 400);

  const { team, allowed } = await loadManageableTeam(teamId, auth.user, auth.isAdmin);
  if (!team) return fail('Équipe introuvable.', 404);
  if (!allowed) return fail("Seul le capitaine de l'équipe ou un admin peut la modifier.", 403);

  const update: Record<string, string | null> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return fail("Le nom de l'équipe est obligatoire.", 400);
    if (name.length > NAME_MAX) return fail(`Nom trop long (${NAME_MAX} caractères max).`, 400);
    update.name = name;
  }

  if (body.description !== undefined) {
    update.description = String(body.description ?? '').trim().slice(0, DESCRIPTION_MAX) || null;
  }

  if (body.logo_url !== undefined) {
    const logo = checkLogo(body.logo_url);
    if (logo && typeof logo === 'object') return fail(logo.error, 400);
    update.logo_url = logo;
  }

  if (body.multigg_url !== undefined) {
    const multigg = checkMultigg(body.multigg_url);
    if (multigg && typeof multigg === 'object') return fail(multigg.error, 400);
    update.multigg_url = multigg;
  }

  // Absent = on ne touche pas au tag (l'admin ne l'envoie pas) ; vide = on l'efface.
  if (body.tag !== undefined) {
    const tag = String(body.tag || '').trim().toUpperCase() || null;
    if (tag && !/^[A-Z0-9]{2,5}$/.test(tag)) {
      return fail('Le tag doit faire 2 à 5 lettres ou chiffres.', 400);
    }
    update.tag = tag;
  }

  if (!Object.keys(update).length) return fail('Rien à modifier.', 400);

  const { data, error } = await supabaseAdmin
    .from('teams')
    .update(update)
    .eq('id', teamId)
    .select();

  if (error) {
    console.error('[teams PATCH]', error);
    return fail("Erreur lors de la modification de l'équipe.", 500);
  }

  invalidateResults();

  return NextResponse.json({ success: true, data });
}
