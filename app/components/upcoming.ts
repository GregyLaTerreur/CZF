'use client';

// Prochains matchs de l'arbre ayant une date (GET /api/a-venir), partagés entre le bandeau
// sous le menu et l'accueil : une seule requête par minute pour toute la visite.
import { useEffect, useState } from 'react';
import type { UpcomingMatch, UpcomingSide } from '@/lib/results/upcoming';

export type { UpcomingMatch, UpcomingSide };

const TTL_MS = 60_000;
let cache: { at: number; promise: Promise<UpcomingMatch[]>; value?: UpcomingMatch[] } | null = null;

function loadUpcoming(): Promise<UpcomingMatch[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.promise;

  const entry: NonNullable<typeof cache> = {
    at: Date.now(),
    promise: fetch('/api/a-venir')
      .then((res) => res.json())
      .then((json) => {
        const matches: UpcomingMatch[] = json?.success ? json.matches : [];
        entry.value = matches;
        return matches;
      })
      .catch(() => {
        if (cache === entry) cache = null;
        return [];
      }),
  };

  cache = entry;
  return entry.promise;
}

export function useUpcomingMatches(): UpcomingMatch[] | null {
  const [matches, setMatches] = useState<UpcomingMatch[] | null>(cache?.value ?? null);

  useEffect(() => {
    let alive = true;
    loadUpcoming().then((value) => {
      if (alive) setMatches(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return matches;
}

export function sideLabel(side: UpcomingSide) {
  return side.shortName ?? side.placeholder;
}

// « sam 22/11 · 20h », à l'heure de Paris.
export function formatMatchDate(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  );

  const minutes = parts.minute === '00' ? '' : parts.minute;

  return `${parts.weekday.replace('.', '')} ${parts.day}/${parts.month} · ${parts.hour}h${minutes}`;
}
