'use client';

// Bêta-testeur (profiles.is_betatest) : décide si on montre les fonctionnalités en bêta (TCG).
// N'affiche ou ne cache que des liens : les routes API vérifient elles-mêmes (lib/tcg/access.ts).
// Requête à part de is_admin : si la colonne manque (SQL pas encore passé), seul le TCG disparaît.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

let cache: { userId: string; value: Promise<boolean>; known?: boolean } | null = null;

export function loadIsBetaTester(userId: string): Promise<boolean> {
  if (cache?.userId !== userId) {
    const entry: NonNullable<typeof cache> = {
      userId,
      value: Promise.resolve(supabase.from('profiles').select('is_betatest').eq('id', userId).maybeSingle()).then(({ data, error }) => {
        if (error && cache === entry) cache = null; // on redemandera à la prochaine page
        entry.known = data?.is_betatest === true;
        return entry.known;
      }),
    };
    cache = entry;
  }
  return cache.value;
}

// Le joueur connecté est-il bêta-testeur ? (false tant qu'on ne sait pas, ou sans session)
export function useIsBetaTester(): boolean {
  const [beta, setBeta] = useState(cache?.known === true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const value = session?.user ? await loadIsBetaTester(session.user.id) : false;
      if (alive) setBeta(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return beta;
}
