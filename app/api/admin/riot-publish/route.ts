
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  buildCzfGameFromRiot,
  type CzFGame,
  type RiotMatchV5,
} from '@/lib/riot/build-czf-game';

import { buildCzfBo } from '@/lib/riot/build-czf-bo';
import { invalidateResults } from '@/lib/results/cache';

export const dynamic = 'force-dynamic';

type Body = {
  fixtureId: number;
  publish?: boolean;
  confirm?: string;
  bracket?: 'winner' | 'loser' | 'grand_final';
  round?: string;
};

type PreparedGame = CzFGame & {
  riotMatchId: string;
};

function fail(error: string, status = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return fail('Configuration Supabase manquante.', 500);
    }

    const db = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ADMIN OBLIGATOIRE
    const authorization =
      request.headers.get('authorization') || '';

    if (!authorization.startsWith('Bearer ')) {
      return fail('Connexion administrateur requise.', 401);
    }

    const token = authorization.slice(7).trim();

    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);

    if (authError || !user) {
      return fail('Session invalide.', 401);
    }

    const { data: profile, error: profileError } =
      await db
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || profile?.is_admin !== true) {
      return fail('Accès administrateur refusé.', 403);
    }

    const body = (await request.json()) as Body;

    const fixtureId = Number(body.fixtureId);

    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
      return fail('Identifiant de rencontre invalide.');
    }

    const publish = body.publish === true;

    // Protection supplémentaire :
    // la publication exige une confirmation explicite.
    if (publish && body.confirm !== 'PUBLIER_CZF') {
      return fail('Confirmation de publication manquante.');
    }

    const { data: fixture, error: fixtureError } =
      await db
        .from('czf_fixtures')
        .select('*')
        .eq('id', fixtureId)
        .single();

    if (fixtureError || !fixture) {
      return fail('Rencontre introuvable.', 404);
    }

    if (
      fixture.match_id !== null ||
      fixture.status === 'completed' ||
      fixture.status === 'cancelled'
    ) {
      return fail('Rencontre déjà terminée ou annulée.');
    }

    const team1Id = Number(fixture.team1_id);
    const team2Id = Number(fixture.team2_id);
    const bestOf = Number(fixture.best_of);

    if (bestOf !== 2 && bestOf !== 3 && bestOf !== 5) {
      return fail('Format BO non pris en charge.');
    }

    if (
      fixture.stage === 'playoff' &&
      !['winner', 'loser', 'grand_final'].includes(
        String(body.bracket || '')
      )
    ) {
      return fail('Bracket de playoffs obligatoire.');
    }

    // Récupérer les emplacements Riot.
    const { data: slots, error: slotsError } =
      await db
        .from('czf_tournament_game_slots')
        .select('*')
        .eq('fixture_id', fixtureId)
        .order('game_number', { ascending: true });

    if (slotsError) throw slotsError;

    if (!slots?.length) {
      return fail('Aucune game Riot préparée.');
    }

    // Récupérer uniquement les imports liés à ces slots.
    const slotIds = slots.map((slot) => Number(slot.id));

    const [importsResult, validationsResult] =
      await Promise.all([
        db
          .from('czf_riot_match_imports')
          .select('*')
          .in('slot_id', slotIds),

        db
          .from('czf_riot_roster_validations')
          .select('*')
          .in('slot_id', slotIds),
      ]);

    if (importsResult.error) throw importsResult.error;
    if (validationsResult.error) throw validationsResult.error;

    const imports = new Map(
      (importsResult.data || []).map((entry) => [
        Number(entry.slot_id),
        entry,
      ])
    );

    const validations = new Map(
      (validationsResult.data || []).map((entry) => [
        Number(entry.slot_id),
        entry,
      ])
    );

    // Les joueurs doivent être reliés à leur équipe CZF.
    const [membersResult, teamsResult] = await Promise.all([
      db
        .from('team_members')
        .select('team_id, player_id')
        .in('team_id', [team1Id, team2Id]),

      db
        .from('teams')
        .select('id, captain_player_id')
        .in('id', [team1Id, team2Id]),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (teamsResult.error) throw teamsResult.error;

    const membership = new Map<number, number>();

    for (const member of membersResult.data || []) {
      if (member.player_id === null) continue;

      const playerId = Number(member.player_id);
      const teamId = Number(member.team_id);

      if (
        membership.has(playerId) &&
        membership.get(playerId) !== teamId
      ) {
        return fail('Un joueur figure dans deux équipes.');
      }

      membership.set(playerId, teamId);
    }

    for (const team of teamsResult.data || []) {
      if (team.captain_player_id === null) continue;

      const playerId = Number(team.captain_player_id);
      const teamId = Number(team.id);

      if (
        membership.has(playerId) &&
        membership.get(playerId) !== teamId
      ) {
        return fail('Capitaine associé à une autre équipe.');
      }

      membership.set(playerId, teamId);
    }

    const playerIds = [...membership.keys()];

    if (!playerIds.length) {
      return fail('Aucun joueur CZF reconnu.');
    }

    const { data: players, error: playersError } =
      await db
        .from('players')
        .select('id, puuid')
        .in('id', playerIds);

    if (playersError) throw playersError;

    const playerIdsByPuuid = new Map<string, number>();
    const teamByPuuid = new Map<string, number>();

    for (const player of players || []) {
      const puuid = String(player.puuid || '').trim();
      const playerId = Number(player.id);
      const teamId = membership.get(playerId);

      if (!puuid || !teamId) continue;

      if (playerIdsByPuuid.has(puuid)) {
        return fail('PUUID dupliqué dans les rosters CZF.');
      }

      playerIdsByPuuid.set(puuid, playerId);
      teamByPuuid.set(puuid, teamId);
    }

    const preparedGames: PreparedGame[] = [];

    for (const slot of slots) {
      const gameNumber = Number(slot.game_number);
      const imported = imports.get(Number(slot.id));
      const validation = validations.get(Number(slot.id));

      // Les emplacements inutilisés sont ignorés.
      if (
        !slot.riot_match_id &&
        !imported &&
        slot.status === 'pending'
      ) {
        continue;
      }

      if (
        !slot.riot_match_id ||
        !imported ||
        !validation
      ) {
        return fail(
          `Game ${gameNumber} : données Riot incomplètes.`
        );
      }

      if (
        slot.status !== 'pending_review' ||
        validation.status !== 'verified' ||
        !['fetched', 'pending_review'].includes(
          String(imported.status)
        )
      ) {
        return fail(
          `Game ${gameNumber} : vérification Riot non terminée.`
        );
      }

      if (
        imported.riot_match_id !== slot.riot_match_id ||
        validation.riot_match_id !== slot.riot_match_id
      ) {
        return fail(
          `Game ${gameNumber} : identifiants Riot incohérents.`
        );
      }

      const riotMatch = imported.match_data as RiotMatchV5;

      if (
        riotMatch?.metadata?.matchId !==
        slot.riot_match_id
      ) {
        return fail(
          `Game ${gameNumber} : données Match-V5 incorrectes.`
        );
      }

      const participants = riotMatch.info?.participants || [];

      const bluePlayers = participants.filter(
        (p) => p.teamId === 100
      );

      const redPlayers = participants.filter(
        (p) => p.teamId === 200
      );

      if (
        bluePlayers.length !== 5 ||
        redPlayers.length !== 5
      ) {
        return fail(
          `Game ${gameNumber} : composition Riot invalide.`
        );
      }

      function getTeamForSide(
        sidePlayers: typeof participants
      ): number {
        const teams = new Set(
          sidePlayers.map(
            (p) => teamByPuuid.get(String(p.puuid || ''))
          )
        );

        if (teams.size !== 1 || teams.has(undefined)) {
          throw new Error(
            `Game ${gameNumber} : roster non reconnu.`
          );
        }

        return [...teams][0] as number;
      }

      const blueTeamId = getTeamForSide(bluePlayers);
      const redTeamId = getTeamForSide(redPlayers);

      if (
        blueTeamId === redTeamId ||
        ![team1Id, team2Id].includes(blueTeamId) ||
        ![team1Id, team2Id].includes(redTeamId)
      ) {
        return fail(
          `Game ${gameNumber} : équipes incorrectes.`
        );
      }

      const converted = buildCzfGameFromRiot(
        riotMatch,
        {
          riotMatchId: String(slot.riot_match_id),
          gameNumber,
          team1Id,
          team2Id,
          blueTeamId,
          redTeamId,
          playerIdsByPuuid,
        }
      );

      preparedGames.push({
        ...converted,
        riotMatchId: String(slot.riot_match_id),
      });
    }

    const bo = buildCzfBo({
      bestOf,
      team1Id,
      team2Id,
      games: preparedGames,
    });

    // Preview : aucune écriture en base.
    if (!publish) {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        fixtureId,
        division: fixture.division,
        stage: fixture.stage,
        bo,
        readyToPublish: bo.completed,
        games: preparedGames,
      });
    }

    if (!bo.completed) {
      return fail('Impossible de publier un BO incomplet.');
    }

    // La fonction SQL assure une transaction atomique.
    // Les vérifications sont aussi répétées en base.
    const { data: matchId, error: publishError } =
      await db.rpc('czf_publish_riot_bo', {
        p_fixture_id: fixtureId,
        p_games: preparedGames,
        p_bracket:
          fixture.stage === 'playoff'
            ? body.bracket || null
            : null,
        p_round:
          fixture.stage === 'playoff'
            ? body.round || null
            : null,
      });

    if (publishError) {
      throw publishError;
    }

    invalidateResults();

    return NextResponse.json({
      success: true,
      mode: 'published',
      fixtureId,
      matchId,
      score: {
        team1: bo.team1Score,
        team2: bo.team2Score,
      },
      winnerTeamId: bo.winnerTeamId,
      message: 'BO publié dans les résultats CZF.',
    });
  } catch (error) {
    console.error('[CZF RIOT PUBLISH]', error);

    return fail(
      error instanceof Error
        ? error.message
        : 'Erreur lors de la préparation du BO Riot.',
      400
    );
  }
}
