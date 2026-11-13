import { createHash, timingSafeEqual } from 'node:crypto';

// Les routes serveur appellent /api/riot/player en HTTP : cet en-tête prouve que l'appel vient du serveur.
// Dérivé de la clé service_role (toujours présente côté serveur) : aucune variable d'env à ajouter.
const HEADER = 'x-czf-internal';

function internalToken() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createHash('sha256').update(`czf-internal:${key}`).digest('hex');
}

export function internalHeaders(): Record<string, string> {
  return { [HEADER]: internalToken() };
}

export function isInternalRequest(request: Request): boolean {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;

  const received = Buffer.from(request.headers.get(HEADER) || '');
  const expected = Buffer.from(internalToken());

  return received.length === expected.length && timingSafeEqual(received, expected);
}
