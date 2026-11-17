// Droits d'admin nommés (table admin_grants, SQL czf-import/admin-1-grants.sql), pour tout le site.
// is_admin reste l'accès général à l'admin ; un droit ouvre une action sensible précise.
// Serveur uniquement : lecture avec supabaseAdmin, jamais d'écriture depuis le navigateur.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Droits connus (nom -> à quoi il sert). Ajouter un droit : une ligne ici, puis le donner en base.
export const PERMISSIONS = {
  'tcg.refiger_numeros': 'Refiger la numérotation d’une saison TCG déjà figée',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export async function hasGrant(profileId: string, permission: Permission): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('admin_grants')
    .select('permission')
    .eq('profile_id', profileId)
    .eq('permission', permission)
    .maybeSingle();
  return !error && Boolean(data);
}

// Admin ET titulaire du droit demandé.
export async function requireGrant(request: Request, permission: Permission) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth;
  if (!(await hasGrant(auth.user.id, permission))) {
    return { error: NextResponse.json({ success: false, message: 'Tu n’as pas le droit de faire cette action.' }, { status: 403 }) };
  }
  return auth;
}
