import { NextResponse } from 'next/server';
import { loadLeaderboard } from '@/lib/tcg/collection';

export const dynamic = 'force-dynamic';

// Classement des collectionneurs : cartes différentes possédées, puis boosters acquis.
export async function GET() {
  try {
    return NextResponse.json({ success: true, leaderboard: await loadLeaderboard() });
  } catch {
    return NextResponse.json({ success: false, message: 'Impossible de charger le classement.' }, { status: 500 });
  }
}
