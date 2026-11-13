import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Charge l'équipe et dit si l'utilisateur peut la gérer (capitaine ou admin).
export async function loadManageableTeam(teamId: number, user: User, isAdmin: boolean) {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name, captain_profile_id, captain_player_id')
    .eq('id', teamId)
    .maybeSingle();

  if (!team) return { team: null, allowed: false };
  if (isAdmin || team.captain_profile_id === user.id) return { team, allowed: true };

  // Équipes anciennes sans captain_profile_id : on passe par le joueur capitaine.
  if (team.captain_player_id) {
    const { data: captain } = await supabaseAdmin
      .from('players')
      .select('profile_id')
      .eq('id', team.captain_player_id)
      .maybeSingle();

    if (captain?.profile_id === user.id) return { team, allowed: true };
  }

  return { team, allowed: false };
}
