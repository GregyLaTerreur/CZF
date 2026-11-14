import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseBoosterInput } from '@/lib/tcg/boosters';
import { loadSeasons, resolveSeasonId } from '@/lib/tcg/seasons';

export const dynamic = 'force-dynamic';

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

// Boosters + profils et équipes (pour la distribution) + boosters non ouverts par booster.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const [boosters, profiles, stock, players, teams, members, seasons] = await Promise.all([
    supabaseAdmin.from('czf_tcg_boosters').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, discord_name').order('discord_name').limit(5000),
    supabaseAdmin.from('czf_tcg_user_boosters').select('booster_id, quantity').gt('quantity', 0).limit(50000),
    supabaseAdmin.from('players').select('id, riot_id, profile_id').not('profile_id', 'is', null).limit(5000),
    supabaseAdmin.from('teams').select('id, name, division, validated_by_admin').order('name').limit(1000),
    supabaseAdmin.from('team_members').select('team_id, player_id').limit(10000),
    loadSeasons(),
  ]);

  if (boosters.error) return fail('Impossible de charger les boosters (les tables TCG existent-elles ?).', 500);

  const unopened: Record<number, number> = {};
  for (const row of stock.data || []) unopened[row.booster_id] = (unopened[row.booster_id] || 0) + row.quantity;

  // Riot ID du joueur lié à chaque profil, pour reconnaître les comptes Discord.
  const playerById = new Map((players.data || []).map((p) => [p.id, p]));
  const riotByProfile = new Map((players.data || []).map((p) => [p.profile_id, p.riot_id]));

  // Équipe -> profils de ses membres (seuls les joueurs liés à un compte peuvent recevoir un booster).
  const teamProfiles = new Map<number, Set<string>>();
  for (const member of members.data || []) {
    const profileId = playerById.get(member.player_id)?.profile_id;
    if (!profileId) continue;
    if (!teamProfiles.has(member.team_id)) teamProfiles.set(member.team_id, new Set());
    teamProfiles.get(member.team_id)!.add(profileId);
  }

  return NextResponse.json({
    success: true,
    boosters: boosters.data,
    seasons,
    unopened,
    profiles: (profiles.data || []).map((p) => ({ ...p, riot_id: riotByProfile.get(p.id) || null })),
    teams: (teams.data || [])
      .map((t) => ({ id: t.id, name: t.name, division: t.division, validated: t.validated_by_admin === true, profile_ids: [...(teamProfiles.get(t.id) || [])] }))
      .filter((t) => t.profile_ids.length),
  });
}

// Un admin crée un booster.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = parseBoosterInput(body);
  if (!parsed.booster) return fail(parsed.error, 400);

  const seasonId = await resolveSeasonId(body.season_id);
  if (!seasonId) return fail('Aucune saison en base.', 400);

  const { data, error } = await supabaseAdmin.from('czf_tcg_boosters').insert({ ...parsed.booster, season_id: seasonId }).select('*').single();
  if (error) return fail('Impossible de créer le booster.', 500);

  return NextResponse.json({ success: true, booster: data });
}
