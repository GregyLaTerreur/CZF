import { NextResponse, type NextRequest } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LOGO_SIZES } from '@/lib/logo';

// Logo d'équipe redimensionné en WebP (transparence gardée), mis en cache un an par le CDN.
// Seules les URLs enregistrées comme logo d'une équipe sont servies : pas de proxy ouvert.

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const url = params.get('u') ?? '';
  const width = Number(params.get('w'));

  if (!/^https?:\/\//i.test(url) || !LOGO_SIZES.includes(width as (typeof LOGO_SIZES)[number])) {
    return new NextResponse('Paramètres invalides', { status: 400 });
  }

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('logo_url', url)
    .limit(1)
    .maybeSingle();

  if (!team) return new NextResponse('Logo inconnu', { status: 404 });

  try {
    // Certains hébergeurs (imgur) refusent les clients sans User-Agent de navigateur.
    const source = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (CZF logo resizer)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const length = Number(source.headers.get('content-length') || 0);

    if (!source.ok || length > MAX_SOURCE_BYTES) throw new Error(`Source ${source.status}`);

    const input = Buffer.from(await source.arrayBuffer());

    if (input.byteLength > MAX_SOURCE_BYTES) throw new Error('Source trop lourde');

    const output = await sharp(input, { animated: true })
      .resize(width, width, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/webp',
        // L'URL source change quand le logo change : la réponse peut rester en cache.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[LOGO]', url, error);
    // Image originale en secours : le logo s'affiche quand même.
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
  }
}
