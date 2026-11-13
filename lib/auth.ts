import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type AuthResult =
  | { user: User; isAdmin: boolean; error?: undefined }
  | { error: NextResponse; user?: undefined; isAdmin?: undefined };

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Lit le token Supabase envoyé par le front (Authorization: Bearer …) et vérifie la session.
export async function requireUser(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) return { error: fail('Non connecté.', 401) };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: fail('Session invalide. Reconnecte-toi.', 401) };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .maybeSingle();

  return { user: data.user, isAdmin: profile?.is_admin === true };
}

// Comme requireUser, mais refuse tout compte qui n'est pas admin.
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const auth = await requireUser(request);
  if (auth.error) return auth;
  if (!auth.isAdmin) return { error: fail('Accès admin requis.', 403) };
  return auth;
}
