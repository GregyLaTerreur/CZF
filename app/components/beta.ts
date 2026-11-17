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

// Boosters pas encore ouverts (pastille du lien Collection). La page Collection envoie
// l'événement BOOSTERS_CHANGED après une ouverture pour mettre la pastille à jour.
export const BOOSTERS_CHANGED = 'czf-tcg-boosters-changed';

export function useBoosterCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const refresh = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const json = await fetch('/api/tcg/boosters-count', { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((res) => res.json())
        .catch(() => null);
      if (alive && json?.success) setCount(json.count);
    };
    void refresh();
    window.addEventListener(BOOSTERS_CHANGED, refresh);
    return () => {
      alive = false;
      window.removeEventListener(BOOSTERS_CHANGED, refresh);
    };
  }, [enabled]);

  return count;
}

// Superadmin (profiles.is_superadmin) : seul à voir la page Admin > Droits. Affichage seulement,
// la route /api/admin/grants vérifie elle-même.
export function useIsSuperAdmin(): boolean {
  const [value, setValue] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase.from('profiles').select('is_superadmin').eq('id', session.user.id).maybeSingle();
      if (alive) setValue(data?.is_superadmin === true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return value;
}
