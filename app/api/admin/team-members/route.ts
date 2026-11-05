import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { invalidateResults } from '@/lib/results/cache';

const ROLES = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

function fail(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}

async function requireAdmin(
  request: Request
) {
  const authorization =
    request.headers.get(
      'authorization'
    ) || '';

  const token =
    authorization.startsWith(
      'Bearer '
    )
      ? authorization.slice(7)
      : '';

  if (!token) {
    return {
      ok: false as const,
      response: fail(
        'Non connecté.',
        401
      ),
    };
  }

  const {
    data: auth,
    error: authError,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    authError ||
    !auth.user
  ) {
    return {
      ok: false as const,
      response: fail(
        'Session invalide.',
        401
      ),
    };
  }

  const { data: profile } =
    await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq(
        'id',
        auth.user.id
      )
      .maybeSingle();

  if (
    profile?.is_admin !==
    true
  ) {
    return {
      ok: false as const,
      response: fail(
        'Accès admin requis.',
        403
      ),
    };
  }

  return {
    ok: true as const,
    user: auth.user,
  };
}

/*
 * Admin :
 * ajoute un joueur existant dans une équipe.
 */
export async function POST(
  request: Request
) {
  const admin =
    await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const body =
    await request
      .json()
      .catch(() => ({}));

  const teamId =
    Number(body.team_id);

  const playerId =
    Number(body.player_id);

  const role =
    String(body.role || '')
      .trim();

  if (
    !Number.isFinite(teamId)
  ) {
    return fail(
      'Équipe invalide.',
      400
    );
  }

  if (
    !Number.isFinite(playerId)
  ) {
    return fail(
      'Joueur invalide.',
      400
    );
  }

  if (
    !ROLES.includes(role)
  ) {
    return fail(
      'Rôle invalide.',
      400
    );
  }

  const { data: team } =
    await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .maybeSingle();

  if (!team) {
    return fail(
      'Équipe introuvable.',
      404
    );
  }

  const { data: player } =
    await supabaseAdmin
      .from('players')
      .select(
        'id, riot_id, profile_id'
      )
      .eq('id', playerId)
      .maybeSingle();

  if (!player) {
    return fail(
      'Joueur introuvable.',
      404
    );
  }

  /*
   * Un joueur ne peut être
   * que dans une seule équipe.
   */
  const {
    data: existingMember,
  } = await supabaseAdmin
    .from('team_members')
    .select(
      'id, team_id'
    )
    .eq(
      'player_id',
      playerId
    )
    .maybeSingle();

  if (existingMember) {
    if (
      Number(
        existingMember.team_id
      ) === teamId
    ) {
      return fail(
        'Ce joueur est déjà dans cette équipe.',
        400
      );
    }

    return fail(
      'Ce joueur appartient déjà à une autre équipe.',
      409
    );
  }

  /*
   * Compatibilité anciennes lignes
   * éventuellement sans player_id.
   */
  const {
    data: legacyMember,
  } = await supabaseAdmin
    .from('team_members')
    .select(
      'id, team_id'
    )
    .ilike(
      'riot_id',
      player.riot_id
    )
    .maybeSingle();

  if (legacyMember) {
    return fail(
      'Ce joueur apparaît déjà dans un roster.',
      409
    );
  }

  const { data: inserted, error } =
    await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: teamId,
        player_id:
          player.id,
        riot_id:
          player.riot_id,
        role,
      })
      .select(
        'id, team_id, player_id, riot_id, role'
      )
      .single();

  if (error) {
    console.error(
      '[ADMIN ADD TEAM MEMBER]',
      error
    );

    return fail(
      'Impossible d’ajouter le joueur.',
      500
    );
  }

  invalidateResults();

  return NextResponse.json({
    success: true,
    member: inserted,
    riot_id:
      player.riot_id,
  });
}