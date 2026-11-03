'use client';

// Division de l'équipe du joueur connecté : sert de filtre par défaut sur les listes.
// Calculée dès l'arrivée sur le site (la Nav la lance) et gardée dans le navigateur :
// les pages la lisent tout de suite (peekMyDivision) puis elle est recalculée en arrière-plan.

import { supabase } from '@/lib/supabase';
import { DIVISIONS, type DivisionName } from '@/app/components/home/divisions';
import { normalizeRiotId, teamDivision } from './lol';

const STORAGE_KEY = 'czf:my-division';

let request: Promise<DivisionName | null> | null = null;
// undefined : pas encore connue sur cet appareil.
let known: DivisionName | null | undefined;

function readStored(): DivisionName | null | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;

    const value = JSON.parse(raw)?.division ?? null;
    return DIVISIONS.includes(value) ? value : null;
  } catch {
    return undefined;
  }
}

function store(division: DivisionName | null | undefined) {
  known = division;

  try {
    if (division === undefined) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ division }));
  } catch {}
}

// Valeur connue tout de suite, sans réseau (undefined si jamais calculée sur cet appareil).
export function peekMyDivision(): DivisionName | null | undefined {
  if (known === undefined && typeof window !== 'undefined') known = readStored();
  return known;
}

async function loadMyDivision(): Promise<DivisionName | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  // Déconnecté : null, qui remplace aussi la division gardée d'un compte précédent.
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

// Un seul calcul par visite, partagé entre composants ; le résultat est gardé pour les visites suivantes.
export function getMyDivision(): Promise<DivisionName | null> {
  request ??= loadMyDivision()
    .then((division) => {
      store(division);
      return division;
    })
    .catch(() => peekMyDivision() ?? null);

  return request;
}
