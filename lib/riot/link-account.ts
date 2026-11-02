// Change le compte Riot d'un joueur CZF ou d'un membre de roster sans profil.
// Partagé par le profil (/api/players/riot-account) et le capitaine (/api/team-members/riot-id).

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Result = { ok: true; riotId: string } | { ok: false; message: string; status: number };

const normalizeRiotId = (value: any) => String(value || '').trim().toLowerCase();

// Recherche Riot (format, existence, rang, points CZF) via la route existante.
async function lookupRiot(origin: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${origin}/api/riot/player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!json?.success) {
      return { ok: false as const, message: json?.message || 'Compte Riot introuvable.', status: 400 };
    }

    return { ok: true as const, data: json.data };
  } catch {
    return { ok: false as const, message: 'Impossible de contacter le service Riot.', status: 502 };
  }
}

// Un compte Riot ne peut appartenir qu'à un seul joueur CZF.
async function isTaken(riotId: string, puuid: string | null, exceptPlayerId: number | null) {
  const { data, error } = await supabaseAdmin.from('players').select('id, riot_id, puuid');
  if (error) throw error;

  return (data || []).some(
    (other: any) =>
      Number(other.id) !== Number(exceptPlayerId) &&
      ((puuid && other.puuid === puuid) || normalizeRiotId(other.riot_id) === normalizeRiotId(riotId))
  );
}

// Joueur CZF : met à jour compte, rang, points, rosters et capitaine.
export async function linkPlayerRiotAccount(player: any, riotId: string, origin: string): Promise<Result> {
  const lookup = await lookupRiot(origin, {
    riot_id: riotId,
    peak_tier: player.peak_tier,
    peak_rank: player.peak_rank,
    peak_lp: player.peak_lp,
  });
  if (!lookup.ok) return lookup;

  const data = lookup.data;

  if (await isTaken(data.riot_id, data.puuid, player.id)) {
    return { ok: false, message: `${data.riot_id} est déjà lié à un autre joueur CZF.`, status: 409 };
  }

  const oldRiotId = String(player.riot_id || '').trim();
  const newRiotId = data.riot_id;

  const { error } = await supabaseAdmin
    .from('players')
    .update({
      riot_id: newRiotId,
      puuid: data.puuid,
      summoner_level: data.summoner_level,
      profile_icon_id: data.profile_icon_id,
      soloq_tier: data.soloq_tier,
      soloq_rank: data.soloq_rank,
      soloq_lp: data.soloq_lp,
      soloq_wins: data.soloq_wins,
      soloq_losses: data.soloq_losses,
      flex_tier: data.flex_tier,
      flex_rank: data.flex_rank,
      flex_lp: data.flex_lp,
      peak_tier: data.peak_tier,
      peak_rank: data.peak_rank,
      peak_lp: data.peak_lp,
      top_champions: data.top_champions ?? player.top_champions,
      czf_points: data.czf_points,
    })
    .eq('id', player.id);

  if (error) return { ok: false, message: 'Impossible d’enregistrer le compte Riot.', status: 500 };

  // Les rosters et capitaines gardent encore le Riot ID en texte : on les suit.
  await Promise.all([
    supabaseAdmin.from('team_members').update({ riot_id: newRiotId }).eq('player_id', player.id),
    oldRiotId
      ? supabaseAdmin
          .from('team_members')
          .update({ riot_id: newRiotId })
          .is('player_id', null)
          .eq('riot_id', oldRiotId)
      : null,
    supabaseAdmin.from('teams').update({ captain_riot_id: newRiotId }).eq('captain_player_id', player.id),
  ]);

  return { ok: true, riotId: newRiotId };
}

// Membre sans joueur CZF : on vérifie juste le compte chez Riot.
export async function linkMemberRiotAccount(member: any, riotId: string, origin: string): Promise<Result> {
  const lookup = await lookupRiot(origin, { riot_id: riotId, skip_top_champions: true });
  if (!lookup.ok) return lookup;

  const newRiotId = lookup.data.riot_id;

  if (await isTaken(newRiotId, lookup.data.puuid, null)) {
    return { ok: false, message: `${newRiotId} est déjà lié à un joueur CZF.`, status: 409 };
  }

  const { error } = await supabaseAdmin.from('team_members').update({ riot_id: newRiotId }).eq('id', member.id);
  if (error) return { ok: false, message: 'Impossible d’enregistrer le Riot ID.', status: 500 };

  return { ok: true, riotId: newRiotId };
}
