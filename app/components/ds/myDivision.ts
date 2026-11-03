'use client';

// Division de l'équipe du joueur connecté : sert de filtre par défaut sur les listes.

import { supabase } from '@/lib/supabase';
import type { DivisionName } from '@/app/components/home/divisions';
import { normalizeRiotId, teamDivision } from './lol';

let request: Promise<DivisionName | null> | null = null;

async function loadMyDivision(): Promise<DivisionName | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return null;

  const { data: player } = await supabase
    .from('players')
    .select('id, riot_id')
    .eq('profile_id', userId)
    .limit(1)
    .maybeSingle();
  if (!player) return null;

  // Capitaine d'abord, sinon membre (par player_id ou Riot ID), comme sur Mon équipe.
  const { data: captainOf } = await supabase
    .from('teams')
    .select('division, validated_by_admin')
    .eq('captain_player_id', player.id)
    .limit(1)
    .maybeSingle();
  if (captainOf) return teamDivision(captainOf);

  const { data: byId } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('player_id', player.id)
    .limit(1)
    .maybeSingle();
  let membership = byId;

  if (!membership && player.riot_id) {
    const { data: byRiotId } = await supabase
      .from('team_members')
      .select('team_id, riot_id')
      .is('player_id', null)
      .ilike('riot_id', player.riot_id);
    const riotId = normalizeRiotId(player.riot_id);
    membership = (byRiotId || []).find((m) => normalizeRiotId(m.riot_id) === riotId) ?? null;
  }
  if (!membership) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('division, validated_by_admin')
    .eq('id', membership.team_id)
    .maybeSingle();

  return teamDivision(team);
}

// Une seule requête par chargement de page, partagée entre composants.
export function getMyDivision(): Promise<DivisionName | null> {
  if (!request) request = loadMyDivision().catch(() => null);
  return request;
}
