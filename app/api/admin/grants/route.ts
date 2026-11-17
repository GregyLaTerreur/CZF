import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PERMISSIONS, isPermission, requireSuperAdmin } from '@/lib/grants';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Droits connus, qui les a, et les profils (pour en donner). Superadmins seulement.
export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;

  const [grants, profiles, players] = await Promise.all([
    supabaseAdmin.from('admin_grants').select('profile_id, permission, granted_at, granted_by, note'),
    supabaseAdmin.from('profiles').select('id, discord_name, is_admin').order('discord_name').limit(5000),
    supabaseAdmin.from('players').select('riot_id, profile_id').not('profile_id', 'is', null).limit(5000),
  ]);

  if (grants.error) return fail('Impossible de lire les droits (la table admin_grants existe-t-elle ?).', 500);

  const riot = new Map((players.data || []).map((p) => [p.profile_id, p.riot_id]));
  return NextResponse.json({
    success: true,
    permissions: Object.entries(PERMISSIONS).map(([name, description]) => ({ name, description })),
    grants: grants.data,
    profiles: (profiles.data || []).map((p) => ({ ...p, riot_id: riot.get(p.id) ?? null })),
  });
}

function readBody(body: any) {
  const profileId = String(body?.profile_id ?? '');
  const permission = body?.permission;
  if (!UUID.test(profileId)) return { error: 'Profil invalide.' };
  if (!isPermission(permission)) return { error: 'Droit inconnu.' };
  return { profileId, permission, note: String(body?.note ?? '').trim().slice(0, 200) || null };
}

// Donner un droit à un profil.
export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;

  const parsed = readBody(await request.json().catch(() => ({})));
  if ('error' in parsed && parsed.error) return fail(parsed.error, 400);
  const { profileId, permission, note } = parsed as { profileId: string; permission: string; note: string | null };

  const { error } = await supabaseAdmin
    .from('admin_grants')
    .upsert({ profile_id: profileId, permission, note, granted_by: auth.user.id }, { onConflict: 'profile_id,permission' });
  if (error) return fail('Impossible de donner ce droit.', 500);

  return NextResponse.json({ success: true });
}

// Retirer un droit à un profil.
export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;

  const parsed = readBody(await request.json().catch(() => ({})));
  if ('error' in parsed && parsed.error) return fail(parsed.error, 400);
  const { profileId, permission } = parsed as { profileId: string; permission: string };

  const { error } = await supabaseAdmin.from('admin_grants').delete().eq('profile_id', profileId).eq('permission', permission);
  if (error) return fail('Impossible de retirer ce droit.', 500);

  return NextResponse.json({ success: true });
}
