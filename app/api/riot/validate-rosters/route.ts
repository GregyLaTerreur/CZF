
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Participant = {
  puuid?: string;
  teamId?: number;
};

type RiotMatchData = {
  metadata?: {
    matchId?: string;
  };
  info?: {
    participants?: Participant[];
  };
};

type Finding = {
  code: string;
  message: string;
};

function sameSecret(received: string, expected: string) {
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secret || !url || !key) {
      return reply(
        { success: false, error: 'Configuration manquante.' },
        503
      );
    }

    const bearer = request.headers.get('authorization') || '';
    const received = bearer.startsWith('Bearer ')
      ? bearer.slice(7)
      : '';

    if (!sameSecret(received, secret)) {
      return reply(
        { success: false, error: 'Accès refusé.' },
        401
      );
    }

    const admin = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Uniquement les données Riot déjà téléchargées.
    const { data: imports, error: importsError } = await admin
      .from('czf_riot_match_imports')
      .select('slot_id, riot_match_id, match_data')
      .eq('status', 'fetched')
      .order('id', { ascending: true })
      .limit(50);

    if (importsError) throw importsError;

    if (!imports?.length) {
      return reply({
        success: true,
        checked: 0,
        results: [],
      });
    }

    const slotIds = imports.map((item) => Number(item.slot_id));

    // Ne pas refaire les validations déjà enregistrées.
    const { data: previous, error: previousError } = await admin
      .from('czf_riot_roster_validations')
      .select('slot_id')
      .in('slot_id', slotIds);

    if (previousError) throw previousError;

    const alreadyChecked = new Set(
      (previous || []).map((item) => Number(item.slot_id))
    );

    const pending = imports
      .filter((item) => !alreadyChecked.has(Number(item.slot_id)))
      .slice(0, 10);

    if (!pending.length) {
      return reply({
        success: true,
        checked: 0,
        results: [],
      });
    }

    const { data: slots, error: slotsError } = await admin
      .from('czf_tournament_game_slots')
      .select('id, fixture_id, riot_match_id, status')
      .in(
        'id',
        pending.map((item) => Number(item.slot_id))
      );

    if (slotsError) throw slotsError;

    const slotMap = new Map(
      (slots || []).map((slot) => [Number(slot.id), slot])
    );

    const fixtureIds = [
      ...new Set(
        (slots || []).map((slot) => Number(slot.fixture_id))
      ),
    ];

    const { data: fixtures, error: fixtureError } = await admin
      .from('czf_fixtures')
      .select(
        'id, team1_id, team2_id, season_id, division, match_id'
      )
      .in('id', fixtureIds);

    if (fixtureError) throw fixtureError;

    const fixtureMap = new Map(
      (fixtures || []).map((fixture) => [
        Number(fixture.id),
        fixture,
      ])
    );

    const teamIds = [
      ...new Set(
        (fixtures || []).flatMap((fixture) => [
          Number(fixture.team1_id),
          Number(fixture.team2_id),
        ])
      ),
    ];

    // On utilise les player_id du roster enregistré,
    // et non le pseudo Riot, qui peut changer.
    const { data: memberships, error: membersError } =
      await admin
        .from('team_members')
        .select('team_id, player_id')
        .in('team_id', teamIds);

    if (membersError) throw membersError;

    const rosterByTeam = new Map<number, Set<number>>();

    for (const member of memberships || []) {
      if (member.player_id == null) continue;

      const teamId = Number(member.team_id);
      const playerId = Number(member.player_id);

      if (!rosterByTeam.has(teamId)) {
        rosterByTeam.set(teamId, new Set());
      }

      rosterByTeam.get(teamId)!.add(playerId);
    }

    // Certains capitaines peuvent être liés directement
    // à l'équipe. On les inclut également dans le roster.
    if (teamIds.length) {
      const { data: teams, error: teamsError } = await admin
        .from('teams')
        .select('id, captain_player_id')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      for (const team of teams || []) {
        if (team.captain_player_id == null) continue;

        const teamId = Number(team.id);

        if (!rosterByTeam.has(teamId)) {
          rosterByTeam.set(teamId, new Set());
        }

        rosterByTeam
          .get(teamId)!
          .add(Number(team.captain_player_id));
      }
    }

    const allPlayerIds = [
      ...new Set(
        [...rosterByTeam.values()].flatMap((set) => [...set])
      ),
    ];

    const { data: players, error: playersError } =
      allPlayerIds.length > 0
        ? await admin
            .from('players')
            .select('id, puuid')
            .in('id', allPlayerIds)
        : { data: [], error: null };

    if (playersError) throw playersError;

    const puuidsByTeam = new Map<number, Set<string>>();
    const rosterMissingPuuid = new Map<number, number>();

    const playerMap = new Map(
      (players || []).map((player) => [
        Number(player.id),
        String(player.puuid || '').trim(),
      ])
    );

    for (const teamId of teamIds) {
      const puuids = new Set<string>();
      let missingCount = 0;

      for (const playerId of rosterByTeam.get(teamId) || []) {
        const puuid = playerMap.get(playerId);

        if (puuid) {
          puuids.add(puuid);
        } else {
          missingCount++;
        }
      }

      puuidsByTeam.set(teamId, puuids);
      rosterMissingPuuid.set(teamId, missingCount);
    }

    const results: Array<{
      slotId: number;
      status: string;
      issues: number;
    }> = [];

    for (const item of pending) {
      const slotId = Number(item.slot_id);
      const slot = slotMap.get(slotId);
      const fixture = slot
        ? fixtureMap.get(Number(slot.fixture_id))
        : null;

      const findings: Finding[] = [];

      if (!slot || !fixture) {
        // Incohérence de données à traiter manuellement.
        results.push({
          slotId,
          status: 'missing_fixture',
          issues: 1,
        });
        continue;
      }

      if (
        slot.riot_match_id !== item.riot_match_id ||
        fixture.match_id !== null
      ) {
        findings.push({
          code: 'MATCH_LINK_CONFLICT',
          message:
            'La liaison entre la rencontre et la partie Riot est incohérente.',
        });
      }

      const match = item.match_data as RiotMatchData | null;
      const participants = match?.info?.participants;

      if (
        match?.metadata?.matchId !== item.riot_match_id
      ) {
        findings.push({
          code: 'RIOT_MATCH_ID_MISMATCH',
          message: "L'identifiant Match-V5 ne correspond pas.",
        });
      }

      if (
        !Array.isArray(participants) ||
        participants.length !== 10
      ) {
        findings.push({
          code: 'INVALID_PARTICIPANTS',
          message:
            'La partie ne contient pas exactement 10 participants.',
        });
      }

      const gamePlayers = Array.isArray(participants)
        ? participants
        : [];

      const puuids = gamePlayers.map((p) =>
        String(p.puuid || '').trim()
      );

      if (
        puuids.some((puuid) => !puuid) ||
        new Set(puuids).size !== 10
      ) {
        findings.push({
          code: 'DUPLICATE_OR_MISSING_PUUID',
          message:
            'Un PUUID est absent ou apparaît plusieurs fois.',
        });
      }

      const riotBlue = gamePlayers.filter(
        (p) => p.teamId === 100
      );

      const riotRed = gamePlayers.filter(
        (p) => p.teamId === 200
      );

      if (
        riotBlue.length !== 5 ||
        riotRed.length !== 5
      ) {
        findings.push({
          code: 'INVALID_RIOT_TEAMS',
          message:
            'La répartition Riot ne correspond pas à 5 contre 5.',
        });
      }

      const team1Id = Number(fixture.team1_id);
      const team2Id = Number(fixture.team2_id);

      const team1Roster =
        puuidsByTeam.get(team1Id) || new Set<string>();

      const team2Roster =
        puuidsByTeam.get(team2Id) || new Set<string>();

      const bluePuuids = riotBlue.map((p) =>
        String(p.puuid || '').trim()
      );

      const redPuuids = riotRed.map((p) =>
        String(p.puuid || '').trim()
      );

      const belongs = (
        items: string[],
        roster: Set<string>
      ) =>
        items.length === 5 &&
        items.every((puuid) => roster.has(puuid));

      // L'équipe CZF 1 n'est pas forcément côté bleu.
      const normal =
        belongs(bluePuuids, team1Roster) &&
        belongs(redPuuids, team2Roster);

      const reversed =
        belongs(bluePuuids, team2Roster) &&
        belongs(redPuuids, team1Roster);

      if (!normal && !reversed) {
        findings.push({
          code: 'ROSTER_MISMATCH',
          message:
            'Les 10 comptes ne correspondent pas exactement aux deux rosters CZF.',
        });
      }

      const missingPuuids = puuids.filter(
        (puuid) =>
          puuid &&
          !team1Roster.has(puuid) &&
          !team2Roster.has(puuid)
      );

      if (missingPuuids.length) {
        findings.push({
          code: 'UNKNOWN_PLAYERS',
          message:
            `${missingPuuids.length} compte(s) absent(s) des deux rosters.`,
        });
      }

      // Les joueurs sans PUUID ne peuvent pas être
      // validés automatiquement, même si leur pseudo correspond.
      const incompleteRoster =
        (rosterMissingPuuid.get(team1Id) || 0) +
        (rosterMissingPuuid.get(team2Id) || 0);

      const status =
        findings.length === 0
          ? 'verified'
          : 'pending_review';

      const { error: saveError } = await admin
        .from('czf_riot_roster_validations')
        .upsert(
          {
            slot_id: slotId,
            riot_match_id: item.riot_match_id,
            status,
            details: {
              fixtureId: fixture.id,
              team1Id,
              team2Id,
              riotBlueTeam:
                normal ? team1Id : reversed ? team2Id : null,
              riotRedTeam:
                normal ? team2Id : reversed ? team1Id : null,
              participantsCount: gamePlayers.length,
              unknownPlayerCount: missingPuuids.length,
              incompleteRosterEntries: incompleteRoster,
              findings,
            },
            validated_at: new Date().toISOString(),
          },
          {
            onConflict: 'slot_id',
            ignoreDuplicates: true,
          }
        );

      if (saveError) throw saveError;

      // On conserve le statut du slot.
      // La publication reste une étape indépendante.
      if (status === 'pending_review') {
        const { error: reviewError } = await admin
          .from('czf_tournament_game_slots')
          .update({
            status: 'pending_review',
            validation_error:
              'Vérification du roster requise.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', slotId)
          .eq('status', 'processing');

        if (reviewError) throw reviewError;
      }

      results.push({
        slotId,
        status,
        issues: findings.length,
      });
    }

    return reply({
      success: true,
      checked: results.length,
      results,
    });
  } catch (error) {
    console.error('[CZF ROSTER VALIDATION]', error);

    return reply(
      {
        success: false,
        error: 'Impossible de vérifier les rosters.',
      },
      500
    );
  }
}
