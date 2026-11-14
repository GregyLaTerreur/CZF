import { NextResponse } from 'next/server';
import { requireTcgBeta } from '@/lib/tcg/access';
import { isProfileId, loadCollection, loadProfileNames } from '@/lib/tcg/collection';

export const dynamic = 'force-dynamic';

// Collection d'un autre joueur, en lecture seule (sans ses boosters).
export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const auth = await requireTcgBeta(request);
  if (auth.error) return auth.error;

  const { profileId } = await params;
  if (!isProfileId(profileId)) return NextResponse.json({ success: false, message: 'Profil introuvable.' }, { status: 404 });

  try {
    const [collection, names] = await Promise.all([loadCollection(profileId), loadProfileNames([profileId])]);
    const owner = names.get(profileId);
    if (!owner) return NextResponse.json({ success: false, message: 'Profil introuvable.' }, { status: 404 });

    return NextResponse.json({ success: true, profileId, owner, ...collection });
  } catch {
    return NextResponse.json({ success: false, message: 'Impossible de charger cette collection.' }, { status: 500 });
  }
}
