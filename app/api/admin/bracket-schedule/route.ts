// Date et lien de stream d'un match de l'arbre (page Résultats), saisis par un admin.
// Body : { division, key, scheduledAt: ISO | null, streamUrl: string | null }. Les deux à null = ligne supprimée.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { normalizeDivision } from '@/lib/results/core';
import { BRACKET_KEYS } from '@/app/results/bracket';

export const dynamic = 'force-dynamic';

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const division = normalizeDivision(String(body?.division ?? ''));
  const key = String(body?.key ?? '');

  if (!division) return fail('Division inconnue.');
  if (!BRACKET_KEYS.includes(key)) return fail('Match de l’arbre inconnu.');

  let scheduledAt: string | null = null;
  if (body?.scheduledAt) {
    const date = new Date(body.scheduledAt);
    if (Number.isNaN(date.getTime())) return fail('Date invalide.');
    scheduledAt = date.toISOString();
  }

  let streamUrl: string | null = null;
  if (body?.streamUrl) {
    try {
      const url = new URL(String(body.streamUrl).trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
      streamUrl = url.toString();
    } catch {
      return fail('Lien de stream invalide (il doit commencer par https://).');
    }
  }

  const { error } =
    scheduledAt || streamUrl
      ? await supabaseAdmin.from('czf_bracket_schedule').upsert({
          division,
          match_key: key,
          scheduled_at: scheduledAt,
          stream_url: streamUrl,
          updated_at: new Date().toISOString(),
        })
      : await supabaseAdmin.from('czf_bracket_schedule').delete().eq('division', division).eq('match_key', key);

  if (error) {
    console.error('[bracket-schedule]', error);
    return fail('Enregistrement impossible.', 500);
  }

  invalidateResults();

  return NextResponse.json({ success: true, entry: { key, scheduledAt, streamUrl } });
}
