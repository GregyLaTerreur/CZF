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

const normalizeRiotId = (
  value: any
) =>
  String(value || '')
    .trim()
    .toLowerCase();

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
  };
}

/* =========================================================
   MODIFIER ROLE / CAPITAINE
========================================================= */

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const admin =
    await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } =
    await params;

  const memberId =
    Number(id);

  if (
    !Number.isFinite(memberId)
  ) {
    return fail(
      'Membre invalide.',
      400
    );
  }

  const body =
    await request
      .json()
      .catch(() => ({}));

  const { data: member } =
    await supabaseAdmin
      .from('team_members')
      .select(
        'id, team_id, player_id, riot_id, role'
      )
      .eq(
        'id',
        memberId
      )
      .maybeSingle();

  if (!member) {
    return fail(
      'Membre introuvable.',
      404
    );
  }

  /*
   * CHANGEMENT DE ROLE
   */
  if (
    body.role !== undefined
  ) {
    const role =
      String(body.role)
        .trim();

    if (
      !ROLES.includes(role)
    ) {
      return fail(
        'Rôle invalide.',
        400
      );
    }

    const { error } =
      await supabaseAdmin
        .from('team_members')
        .update({
          role,
        })
        .eq(
          'id',
          member.id
        );

    if (error) {
      console.error(
        '[ADMIN MEMBER ROLE]',
        error
      );

      return fail(
        'Impossible de modifier le rôle.',
        500
      );
    }
  }

  /*
   * CHANGEMENT DE CAPITAINE
   */
  if (
    body.make_captain ===
    true
  ) {
    if (
      member.player_id ===
        null ||
      member.player_id ===
        undefined
    ) {
      return fail(
        'Ce membre n’est pas relié à un player_id.',
        400
      );
    }

    const { data: player } =
      await supabaseAdmin
        .from('players')
        .select(
          'id, riot_id, profile_id'
        )
        .eq(
          'id',
          member.player_id
        )
        .maybeSingle();

    if (!player) {
      return fail(
        'Joueur introuvable.',
        404
      );
    }

    const {
      error: captainError,
    } = await supabaseAdmin
      .from('teams')
      .update({
        captain_player_id:
          player.id,

        captain_riot_id:
          player.riot_id,

        captain_profile_id:
          player.profile_id ||
          null,
      })
      .eq(
        'id',
        member.team_id
      );

    if (captainError) {
      console.error(
        '[ADMIN CHANGE CAPTAIN]',
        captainError
      );

      return fail(
        'Impossible de modifier le capitaine.',
        500
      );
    }
  }

  invalidateResults();

  const { data: updated } =
    await supabaseAdmin
      .from('team_members')
      .select(
        'id, team_id, player_id, riot_id, role'
      )
      .eq(
        'id',
        member.id
      )
      .maybeSingle();

  return NextResponse.json({
    success: true,
    member: updated,
    riot_id:
      updated?.riot_id ||
      member.riot_id,
  });
}

/* =========================================================
   RETIRER MEMBRE
========================================================= */

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const admin =
    await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } =
    await params;

  const { data: member } =
    await supabaseAdmin
      .from('team_members')
      .select(
        'id, team_id, player_id, riot_id'
      )
      .eq(
        'id',
        Number(id)
      )
      .maybeSingle();

  if (!member) {
    return fail(
      'Membre introuvable.',
      404
    );
  }

  const { data: team } =
    await supabaseAdmin
      .from('teams')
      .select(
        'captain_player_id, captain_riot_id'
      )
      .eq(
        'id',
        member.team_id
      )
      .maybeSingle();

  const isCaptain =
    team &&
    (
      (
        member.player_id &&
        Number(
          member.player_id
        ) ===
          Number(
            team.captain_player_id
          )
      ) ||
      normalizeRiotId(
        member.riot_id
      ) ===
        normalizeRiotId(
          team.captain_riot_id
        )
    );

  if (isCaptain) {
    return fail(
      'Impossible de retirer le capitaine. Désigne d’abord un nouveau capitaine.',
      400
    );
  }

  const { error } =
    await supabaseAdmin
      .from('team_members')
      .delete()
      .eq(
        'id',
        member.id
      );

  if (error) {
    console.error(
      '[ADMIN REMOVE MEMBER]',
      error
    );

    return fail(
      'Impossible de retirer le joueur.',
      500
    );
  }

  invalidateResults();

  return NextResponse.json({
    success: true,
    riot_id:
      member.riot_id,
  });
}