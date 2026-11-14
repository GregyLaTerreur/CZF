import { NextResponse } from 'next/server';
import { requireTcgBeta, hasRiotAccount } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Nombre de boosters pas encore ouverts du joueur connecté (pastille du lien Collection).
export async function GET(request: Request) {
  const auth = await requireTcgBeta(request);
  if (auth.error) return auth.error;
  if (!(await hasRiotAccount(auth.user.id))) return NextResponse.json({ success: true, count: 0 });

  const { data, error } = await supabaseAdmin.from('czf_tcg_user_boosters').select('quantity').eq('profile_id', auth.user.id).gt('quantity', 0);
  if (error) return NextResponse.json({ success: false, count: 0 }, { status: 500 });

  return NextResponse.json({ success: true, count: data.reduce((sum, row) => sum + row.quantity, 0) });
}
