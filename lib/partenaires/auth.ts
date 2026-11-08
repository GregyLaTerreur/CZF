// Clés API des collaborateurs : CZF_PARTNER_API_KEYS="cle1,cle2" (une par collaborateur).

import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { jsonNoStore } from '@/lib/results/load';

function sameKey(a: string, b: string): boolean {
  // Hash pour comparer à longueur égale, en temps constant.
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();

  return timingSafeEqual(hashA, hashB);
}

// Renvoie une réponse d'erreur si la clé manque ou est fausse, sinon null.
export function checkPartnerKey(request: NextRequest) {
  const keys = (process.env.CZF_PARTNER_API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    return jsonNoStore({ success: false, error: 'API partenaires non configurée.' }, 503);
  }

  const given = request.headers.get('x-api-key')?.trim();

  if (!given || !keys.some((key) => sameKey(key, given))) {
    return jsonNoStore({ success: false, error: 'Clé API invalide.' }, 401);
  }

  return null;
}
