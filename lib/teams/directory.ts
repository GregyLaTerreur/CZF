// Données de la page « Les équipes », assemblées côté serveur et mises en cache.
// Invalidé avec les résultats (invalidateResults) par les routes qui modifient équipes, rosters, joueurs et demandes.

import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { RESULTS_TAG, RESULTS_TTL_SECONDS } from '@/lib/results/cache';
import { fetchAll } from '@/lib/results/load';
import { findMemberPlayer } from '@/app/components/ds/lol';

const TEAM_COLUMNS =
  'id, name, logo_url, division, validated_by_admin, captain_riot_id, captain_profile_id, captain_player_id, created_at';
const MEMBER_COLUMNS = 'team_id, player_id, riot_id, role';
// Pas de profile_id ni de champions : seulement ce qu'affiche une carte d'équipe.
const PLAYER_COLUMNS = 'id, riot_id, czf_points, soloq_tier, soloq_rank, soloq_lp';

export type TeamsDirectory = {
  teams: any[];
  members: any[];
  // Joueurs présents dans un roster uniquement.
  players: any[];
  pendingRequests: Record<number, number>;
};

async function fetchTeamsDirectory(): Promise<TeamsDirectory> {
  const [teamsRes, membersRes, allPlayers, requestsRes] = await Promise.all([
    supabaseAdmin.from('teams').select(TEAM_COLUMNS).order('created_at', { ascending: false }),
    supabaseAdmin.from('team_members').select(MEMBER_COLUMNS).order('created_at', { ascending: true }),
    fetchAll((from, to) => supabaseAdmin.from('players').select(PLAYER_COLUMNS).order('id').range(from, to)),
    // Client anon : en prod, service_role n'a pas le droit SELECT sur cette table.
    supabase.from('team_join_requests').select('team_id').eq('status', 'pending'),
  ]);

  if (teamsRes.error) throw teamsRes.error;
  if (membersRes.error) throw membersRes.error;

  const members = membersRes.data ?? [];
  const rostered = new Map<number, any>();

  for (const member of members) {
    const player = findMemberPlayer(member, allPlayers);
    if (player) rostered.set(Number(player.id), player);
  }

  const pendingRequests: Record<number, number> = {};

  for (const request of requestsRes.data ?? []) {
    const teamId = Number(request.team_id);
    pendingRequests[teamId] = (pendingRequests[teamId] ?? 0) + 1;
  }

  return {
    teams: teamsRes.data ?? [],
    members,
    players: [...rostered.values()],
    pendingRequests,
  };
}

export const loadTeamsDirectory = unstable_cache(fetchTeamsDirectory, ['equipes-directory-v1'], {
  revalidate: RESULTS_TTL_SECONDS,
  tags: [RESULTS_TAG],
});
