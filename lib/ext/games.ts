// Données des routes publiques /api/ext/* (lecture seule, ouvertes aux collaborateurs).

import { type NextRequest, NextResponse } from 'next/server';
import { type AnyObject, normalizeRole, roleOrder } from '@/lib/results/core';
import { fetchAll } from '@/lib/results/load';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type TeamNames = Map<number, string | null>;

const num = (value: any) => Number(value) || 0;

export const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 1000) / 10 : 0;

// Date française à l'heure de Paris : « 03/11/2026 13:07 ».
const frDate = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatFrDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : frDate.format(date).replace(',', '');
}

// Comparaison de noms sans casse ni accents.
export function normalizeText(value: any): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Paramètre d'id facultatif : null si absent, invalid si ce n'est pas un entier positif.
export function readIdParam(request: NextRequest, name: string) {
  const raw = request.nextUrl.searchParams.get(name);
  const value = raw ? Number(raw) : null;

  return { value, invalid: Boolean(raw) && !(Number.isInteger(value) && value! > 0) };
}

// Toutes les équipes, validées ou non : un BO ancien peut référencer une équipe dissoute.
export async function loadTeamNames(): Promise<TeamNames> {
  const rows = await fetchAll((from, to) =>
    supabaseAdmin.from('teams').select('id, name').order('id', { ascending: true }).range(from, to)
  );

  return new Map(rows.map((row) => [Number(row.id), row.name ?? null]));
}

// Joueurs d'une game (officiels + remplaçants) avec leur KP, et les kills de chaque équipe.
export function buildGamePlayers(
  game: AnyObject,
  stats: AnyObject[],
  playerNames: Map<number, string | null>,
  teamNames: TeamNames
) {
  const official = stats.map((stat) => ({
    id_player: Number(stat.player_id) as number | null,
    riotId: playerNames.get(Number(stat.player_id)) ?? null,
    isSub: false,
    id_team: Number(stat.team_id),
    teamName: teamNames.get(Number(stat.team_id)) ?? null,
    role: normalizeRole(stat.role),
    champion: stat.champion_id ?? null,
    kills: num(stat.kills),
    deaths: num(stat.deaths),
    assists: num(stat.assists),
    cs: num(stat.cs) as number | null,
    gold: num(stat.gold) as number | null,
    damage: num(stat.damage) as number | null,
    visionScore: num(stat.vision_score) as number | null,
  }));

  // Les remplaçants n'ont ni compte CZF ni dégâts/vision enregistrés.
  const subs = (Array.isArray(game.substitute_stats) ? game.substitute_stats : []).map(
    (sub: AnyObject) => ({
      id_player: null,
      riotId: null,
      isSub: true,
      id_team: Number(sub.teamId ?? sub.team_id),
      teamName: teamNames.get(Number(sub.teamId ?? sub.team_id)) ?? null,
      role: normalizeRole(sub.role),
      champion: sub.championId ?? sub.champion_id ?? null,
      kills: num(sub.kills),
      deaths: num(sub.deaths),
      assists: num(sub.assists),
      cs: null,
      gold: null,
      damage: null,
      visionScore: null,
    })
  );

  const all = [...official, ...subs];
  const teamKills = new Map<number, number>();

  for (const player of all) {
    teamKills.set(player.id_team, (teamKills.get(player.id_team) ?? 0) + player.kills);
  }

  const players = all
    .sort((a, b) => a.id_team - b.id_team || roleOrder(a.role) - roleOrder(b.role))
    .map((player) => ({
      ...player,
      // KP = (kills + assists) / kills de l'équipe sur la game.
      killParticipation: percent(player.kills + player.assists, teamKills.get(player.id_team) ?? 0),
    }));

  return { players, teamKills };
}

// Lecture publique : sans cache navigateur, appelable depuis un autre site.
export function extJson(body: AnyObject, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
