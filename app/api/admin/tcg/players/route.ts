import { NextResponse } from 'next/server';
import { requireTcgAdmin } from '@/lib/tcg/access';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Joueurs en équipe, pour lier une carte à un joueur et pré-remplir ses infos.
export async function GET(request: Request) {
  const auth = await requireTcgAdmin(request);
  if (auth.error) return auth.error;

  const [players, members, teams] = await Promise.all([
    supabaseAdmin.from('players').select('id, riot_id, main_role, top_champions').limit(5000),
    supabaseAdmin.from('team_members').select('team_id, player_id, role').limit(10000),
    supabaseAdmin.from('teams').select('id, name, logo_url, division, validated_by_admin').limit(1000),
  ]);

  if (players.error) return NextResponse.json({ success: false, message: 'Impossible de charger les joueurs.' }, { status: 500 });

  const teamById = new Map((teams.data || []).map((t) => [t.id, t]));
  // Une équipe validée l'emporte si le joueur apparaît dans plusieurs rosters.
  const memberByPlayer = new Map<number, { team_id: number; role: string | null }>();
  for (const m of members.data || []) {
    const current = memberByPlayer.get(m.player_id);
    if (!current || (!teamById.get(current.team_id)?.validated_by_admin && teamById.get(m.team_id)?.validated_by_admin)) {
      memberByPlayer.set(m.player_id, m);
    }
  }

  const list = (players.data || [])
    .filter((p) => p.riot_id)
    .map((p) => {
      const member = memberByPlayer.get(p.id);
      const team = member ? teamById.get(member.team_id) : null;
      return {
        id: p.id,
        riot_id: p.riot_id,
        role: member?.role || p.main_role || null,
        team_name: team?.name ?? null,
        team_logo: team?.logo_url ?? null,
        division: team?.division ?? null,
        champions: (p.top_champions || []).map((c: { champion_name: string }) => c.champion_name).filter((c: string) => /^[A-Za-z]+$/.test(c)),
      };
    })
    .sort((a, b) => a.riot_id.localeCompare(b.riot_id, 'fr'));

  return NextResponse.json({ success: true, players: list });
}
