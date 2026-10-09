
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Configuration Supabase manquante.');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function reply(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

async function identify(
  request: NextRequest,
  db: ReturnType<typeof getAdminClient>
) {
  const authorization =
    request.headers.get('authorization') || '';

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) return null;

  const { data: auth, error: authError } =
    await db.auth.getUser(token);

  if (authError || !auth.user) return null;

  const { data: profile, error: profileError } =
    await db
      .from('profiles')
      .select('is_admin')
      .eq('id', auth.user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  const { data: player, error: playerError } =
    await db
      .from('players')
      .select('id')
      .eq('profile_id', auth.user.id)
      .maybeSingle();

  if (playerError) throw playerError;

  let captainIds: number[] = [];

  if (player) {
    const { data: teams, error: teamError } =
      await db
        .from('teams')
        .select('id')
        .eq('captain_player_id', player.id);

    if (teamError) throw teamError;

    captainIds = (teams || []).map(
      (team) => Number(team.id)
    );
  }

  return {
    userId: auth.user.id,
    isAdmin: profile?.is_admin === true,
    captainIds,
  };
}

function isCaptainOfMatch(
  identity: NonNullable<
    Awaited<ReturnType<typeof identify>>
  >,
  fixture: {
    team1_id: number;
    team2_id: number;
  }
) {
  return (
    identity.captainIds.includes(
      Number(fixture.team1_id)
    ) ||
    identity.captainIds.includes(
      Number(fixture.team2_id)
    )
  );
}

async function getFixture(
  db: ReturnType<typeof getAdminClient>,
  fixtureId: number
) {
  const { data, error } = await db
    .from('czf_fixtures')
    .select(
      'id, season_id, team1_id, team2_id, match_id, status, best_of'
    )
    .eq('id', fixtureId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getCandidates(
  db: ReturnType<typeof getAdminClient>,
  matchId: number
) {
  const { data: games, error: gamesError } =
    await db
      .from('czf_games')
      .select('id')
      .eq('match_id', matchId);

  if (gamesError) throw gamesError;

  const gameIds = (games || []).map(
    (game) => Number(game.id)
  );

  if (!gameIds.length) return [];

  const { data: stats, error: statsError } =
    await db
      .from('czf_game_player_stats')
      .select('player_id, team_id')
      .in('game_id', gameIds);

  if (statsError) throw statsError;

  const participants = new Map<number, number>();

  for (const stat of stats || []) {
    participants.set(
      Number(stat.player_id),
      Number(stat.team_id)
    );
  }

  if (!participants.size) return [];

  const { data: players, error: playersError } =
    await db
      .from('players')
      .select('id, riot_id')
      .in('id', [...participants.keys()]);

  if (playersError) throw playersError;

  return (players || [])
    .map((player) => ({
      id: Number(player.id),
      name: String(player.riot_id || 'Joueur'),
      teamId: participants.get(Number(player.id)),
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'fr')
    );
}

// Les capitaines voient leurs BO terminés.
// Les admins voient les BO de l'édition active.
export async function GET(request: NextRequest) {
  try {
    const db = getAdminClient();
    const identity = await identify(request, db);

    if (!identity) {
      return reply(
        { success: false, error: 'Connexion nécessaire.' },
        401
      );
    }

    if (
      !identity.isAdmin &&
      identity.captainIds.length === 0
    ) {
      return reply({
        success: true,
        isAdmin: false,
        fixtures: [],
      });
    }

    const { data: season, error: seasonError } =
      await db
        .from('czf_seasons')
        .select('id, name')
        .eq('status', 'active')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (seasonError) throw seasonError;

    if (!season) {
      return reply({
        success: true,
        isAdmin: identity.isAdmin,
        fixtures: [],
      });
    }

    const { data: fixtures, error: fixturesError } =
      await db
        .from('czf_fixtures')
        .select(
          'id, season_id, team1_id, team2_id, match_id, status, best_of'
        )
        .eq('season_id', season.id)
        .not('match_id', 'is', null)
        .order('id', { ascending: false });

    if (fixturesError) throw fixturesError;

    const visible = (fixtures || []).filter(
      (fixture) =>
        identity.isAdmin ||
        isCaptainOfMatch(identity, fixture)
    );

    if (!visible.length) {
      return reply({
        success: true,
        isAdmin: identity.isAdmin,
        fixtures: [],
      });
    }

    const matchIds = visible.map(
      (fixture) => Number(fixture.match_id)
    );

    const fixtureIds = visible.map(
      (fixture) => Number(fixture.id)
    );

    const teamIds = [
      ...new Set(
        visible.flatMap((fixture) => [
          Number(fixture.team1_id),
          Number(fixture.team2_id),
        ])
      ),
    ];

    const [
      matchesResult,
      proposalsResult,
      teamsResult,
    ] = await Promise.all([
      db
        .from('czf_matches')
        .select('id, status, mvp_player_id')
        .in('id', matchIds),
      db
        .from('czf_mvp_proposals')
        .select(
          'fixture_id, proposed_player_id, status, final_player_id'
        )
        .in('fixture_id', fixtureIds),
      db
        .from('teams')
        .select('id, name')
        .in('id', teamIds),
    ]);

    if (matchesResult.error) throw matchesResult.error;
    if (proposalsResult.error) throw proposalsResult.error;
    if (teamsResult.error) throw teamsResult.error;

    const matchMap = new Map(
      (matchesResult.data || []).map(
        (match) => [Number(match.id), match]
      )
    );

    const proposalMap = new Map(
      (proposalsResult.data || []).map(
        (proposal) => [
          Number(proposal.fixture_id),
          proposal,
        ]
      )
    );

    const teamMap = new Map(
      (teamsResult.data || []).map(
        (team) => [
          Number(team.id),
          String(team.name),
        ]
      )
    );

    const result = [];

    for (const fixture of visible) {
      const matchId = Number(fixture.match_id);
      const match = matchMap.get(matchId);

      if (!match || match.status !== 'finished') {
        continue;
      }

      const candidates = await getCandidates(
        db,
        matchId
      );

      const proposal = proposalMap.get(
        Number(fixture.id)
      );

      result.push({
        fixtureId: Number(fixture.id),
        matchId,
        bestOf: Number(fixture.best_of),
        team1: {
          id: Number(fixture.team1_id),
          name:
            teamMap.get(Number(fixture.team1_id)) ||
            'Équipe 1',
        },
        team2: {
          id: Number(fixture.team2_id),
          name:
            teamMap.get(Number(fixture.team2_id)) ||
            'Équipe 2',
        },
        candidates,
        officialMvpId:
          match.mvp_player_id == null
            ? null
            : Number(match.mvp_player_id),
        proposal: proposal
          ? {
              playerId:
                Number(proposal.proposed_player_id),
              status: proposal.status,
              finalPlayerId:
                proposal.final_player_id == null
                  ? null
                  : Number(proposal.final_player_id),
            }
          : null,
        canPropose:
          isCaptainOfMatch(identity, fixture),
      });
    }

    return reply({
      success: true,
      isAdmin: identity.isAdmin,
      fixtures: result,
    });
  } catch (error) {
    console.error('[CZF MVP GET]', error);

    return reply(
      {
        success: false,
        error: 'Impossible de charger les MVP.',
      },
      500
    );
  }
}

// Un capitaine propose le MVP du cast.
export async function POST(request: NextRequest) {
  try {
    const db = getAdminClient();
    const identity = await identify(request, db);

    if (!identity) {
      return reply(
        { success: false, error: 'Connexion nécessaire.' },
        401
      );
    }

    const body = await request.json();
    const fixtureId = Number(body.fixtureId);
    const playerId = Number(body.playerId);

    if (
      !Number.isSafeInteger(fixtureId) ||
      fixtureId <= 0 ||
      !Number.isSafeInteger(playerId) ||
      playerId <= 0
    ) {
      return reply(
        { success: false, error: 'Données invalides.' },
        400
      );
    }

    const fixture = await getFixture(db, fixtureId);

    if (!fixture || fixture.match_id == null) {
      return reply(
        {
          success: false,
          error: 'BO terminé introuvable.',
        },
        404
      );
    }

    if (!isCaptainOfMatch(identity, fixture)) {
      return reply(
        {
          success: false,
          error: 'Réservé aux capitaines des deux équipes.',
        },
        403
      );
    }

    const { data: season, error: seasonError } =
      await db
        .from('czf_seasons')
        .select('status')
        .eq('id', fixture.season_id)
        .maybeSingle();

    if (seasonError) throw seasonError;

    if (season?.status !== 'active') {
      return reply(
        {
          success: false,
          error: "Cette édition n'est plus active.",
        },
        409
      );
    }

    const { data: match, error: matchError } =
      await db
        .from('czf_matches')
        .select('status, mvp_player_id')
        .eq('id', fixture.match_id)
        .maybeSingle();

    if (matchError) throw matchError;

    if (match?.status !== 'finished') {
      return reply(
        {
          success: false,
          error: "Le BO n'est pas encore terminé.",
        },
        409
      );
    }

    if (match.mvp_player_id != null) {
      return reply(
        {
          success: false,
          error: 'Un MVP officiel existe déjà.',
        },
        409
      );
    }

    const candidates = await getCandidates(
      db,
      Number(fixture.match_id)
    );

    if (
      !candidates.some(
        (candidate) => candidate.id === playerId
      )
    ) {
      return reply(
        {
          success: false,
          error:
            "Ce joueur n'a pas participé officiellement au BO.",
        },
        400
      );
    }

    // L'unicité fixture_id empêche deux propositions
    // concurrentes de créer deux votes différents.
    const { error: insertError } =
      await db
        .from('czf_mvp_proposals')
        .insert({
          fixture_id: fixtureId,
          match_id: fixture.match_id,
          proposed_player_id: playerId,
          proposed_by: identity.userId,
          status: 'pending',
        });

    if (insertError?.code === '23505') {
      return reply(
        {
          success: false,
          error:
            'Un capitaine a déjà proposé un MVP pour ce BO.',
        },
        409
      );
    }

    if (insertError) throw insertError;

    return reply(
      {
        success: true,
        message: 'MVP proposé aux admins.',
      },
      201
    );
  } catch (error) {
    console.error('[CZF MVP POST]', error);

    return reply(
      {
        success: false,
        error: 'Impossible de proposer le MVP.',
      },
      500
    );
  }
}

// L'admin approuve ou corrige le MVP.
export async function PATCH(request: NextRequest) {
  try {
    const db = getAdminClient();
    const identity = await identify(request, db);

    if (!identity?.isAdmin) {
      return reply(
        {
          success: false,
          error: 'Accès administrateur refusé.',
        },
        403
      );
    }

    const body = await request.json();
    const fixtureId = Number(body.fixtureId);
    const playerId = Number(body.playerId);

    if (
      !Number.isSafeInteger(fixtureId) ||
      fixtureId <= 0 ||
      !Number.isSafeInteger(playerId) ||
      playerId <= 0
    ) {
      return reply(
        {
          success: false,
          error: 'Données invalides.',
        },
        400
      );
    }

    const fixture = await getFixture(db, fixtureId);

    if (!fixture || fixture.match_id == null) {
      return reply(
        {
          success: false,
          error: 'Rencontre introuvable.',
        },
        404
      );
    }

    const { data: proposal, error: proposalError } =
      await db
        .from('czf_mvp_proposals')
        .select(
          'id, match_id, proposed_player_id, status'
        )
        .eq('fixture_id', fixtureId)
        .maybeSingle();

    if (proposalError) throw proposalError;

    if (!proposal || proposal.status !== 'pending') {
      return reply(
        {
          success: false,
          error: 'Aucune proposition en attente.',
        },
        409
      );
    }

    if (
      Number(proposal.match_id) !==
      Number(fixture.match_id)
    ) {
      return reply(
        {
          success: false,
          error: 'Incohérence entre le BO et la proposition.',
        },
        409
      );
    }

    const candidates = await getCandidates(
      db,
      Number(fixture.match_id)
    );

    if (
      !candidates.some(
        (candidate) => candidate.id === playerId
      )
    ) {
      return reply(
        {
          success: false,
          error: 'Joueur non éligible au MVP.',
        },
        400
      );
    }

    const { data: updatedMatch, error: matchError } =
      await db
        .from('czf_matches')
        .update({
          mvp_player_id: playerId,
        })
        .eq('id', fixture.match_id)
        .eq('status', 'finished')
        .is('mvp_player_id', null)
        .select('id')
        .maybeSingle();

    if (matchError) throw matchError;

    if (!updatedMatch) {
      return reply(
        {
          success: false,
          error:
            'Un MVP existe déjà. Actualise la page.',
        },
        409
      );
    }

    const status =
      Number(proposal.proposed_player_id) === playerId
        ? 'approved'
        : 'corrected';

    const { error: updateError } =
      await db
        .from('czf_mvp_proposals')
        .update({
          status,
          final_player_id: playerId,
          reviewed_by: identity.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', proposal.id)
        .eq('status', 'pending');

    if (updateError) {
      console.error(
        '[CZF MVP] MVP enregistré, mais historique à corriger :',
        updateError
      );

      return reply(
        {
          success: false,
          error:
            "Le MVP est enregistré, mais l'historique de validation doit être vérifié.",
        },
        500
      );
    }

    return reply({
      success: true,
      message:
        status === 'approved'
          ? 'MVP validé.'
          : 'MVP corrigé et validé.',
    });
  } catch (error) {
    console.error('[CZF MVP PATCH]', error);

    return reply(
      {
        success: false,
        error: 'Impossible de valider le MVP.',
      },
      500
    );
  }
}
