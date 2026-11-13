// Limite d'appels en mémoire, par instance serveur : un frein contre les boucles, pas une garantie absolue
// (sur Vercel, chaque instance a son propre compteur).
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);

  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  // Évite que la table grossisse sans fin.
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (!times.some((time) => now - time < windowMs)) hits.delete(k);
  }

  return true;
}
