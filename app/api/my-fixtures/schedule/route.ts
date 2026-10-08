
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return fail('Configuration Supabase manquante.', 500);
    }

    const admin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Vérification de la session Supabase.
    const authorization = request.headers.get('authorization');

    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;

    if (!token) {
      return fail('Tu dois être connecté.', 401);
    }

    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return fail('Session invalide ou expirée.', 401);
    }

    // Lire uniquement les données attendues.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail('Requête JSON invalide.', 400);
    }

    if (!body || typeof body !== 'object') {
      return fail('Données invalides.', 400);
    }

    const payload = body as Record<string, unknown>;

    const fixtureId = payload.fixtureId;
    const scheduledAt = payload.scheduledAt;

    if (
      typeof fixtureId !== 'number' ||
      !Number.isSafeInteger(fixtureId) ||
      fixtureId <= 0
    ) {
      return fail('Identifiant de rencontre invalide.', 400);
    }

    if (
      scheduledAt !== null &&
      typeof scheduledAt !== 'string'
    ) {
      return fail('Date invalide.', 400);
    }

    let normalizedDate: string | null = null;

    if (typeof scheduledAt === 'string') {
      // Le frontend envoie une date ISO avec fuseau UTC.
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
          scheduledAt
        )
      ) {
        return fail('Format de date incorrect.', 400);
      }

      const parsed = new Date(scheduledAt);

      if (Number.isNaN(parsed.getTime())) {
        return fail('Date invalide.', 400);
      }

      if (parsed.getTime() < Date.now()) {
        return fail(
          'La date programmée doit être dans le futur.',
          400
        );
      }

      normalizedDate = parsed.toISOString();
    }

    // Identifier le joueur connecté.
    const { data: player, error: playerError } =
      await admin
        .from('players')
        .select('id')
        .eq('profile_id', authData.user.id)
        .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return fail('Aucun profil joueur associé.', 403);
    }

    // Vérifier que le joueur est capitaine d'une équipe.
    const { data: captainTeams, error: captainError } =
      await admin
        .from('teams')
        .select('id')
        .eq('captain_player_id', player.id);

    if (captainError) throw captainError;

    const captainTeamIds = new Set(
      (captainTeams ?? []).map((team) => Number(team.id))
    );

    if (captainTeamIds.size === 0) {
      return fail(
        'Seul un capitaine peut programmer une rencontre.',
        403
      );
    }

    // Récupérer la rencontre.
    const { data: fixture, error: fixtureError } =
      await admin
        .from('czf_fixtures')
        .select(
          'id, season_id, division, stage, team1_id, team2_id, status, match_id'
        )
        .eq('id', fixtureId)
        .maybeSingle();

    if (fixtureError) throw fixtureError;

    if (!fixture) {
      return fail('Rencontre introuvable.', 404);
    }

    // Le capitaine doit appartenir à l'une des 2 équipes.
    if (
      !captainTeamIds.has(Number(fixture.team1_id)) &&
      !captainTeamIds.has(Number(fixture.team2_id))
    ) {
      return fail(
        "Tu ne peux pas modifier la rencontre d'autres équipes.",
        403
      );
    }

    // Vérifier que la saison est active.
    const { data: season, error: seasonError } =
      await admin
        .from('czf_seasons')
        .select('id, status')
        .eq('id', fixture.season_id)
        .maybeSingle();

    if (seasonError) throw seasonError;

    if (!season || season.status !== 'active') {
      return fail(
        "Cette édition n'accepte plus de programmation.",
        409
      );
    }

    // Vérifier que les 2 équipes sont bien inscrites.
    const { data: seasonTeams, error: seasonTeamsError } =
      await admin
        .from('czf_season_teams')
        .select('team_id')
        .eq('season_id', fixture.season_id)
        .eq('division', fixture.division)
        .in('team_id', [fixture.team1_id, fixture.team2_id]);

    if (seasonTeamsError) throw seasonTeamsError;

    const registered = new Set(
      (seasonTeams ?? []).map((team) => Number(team.team_id))
    );

    if (
      !registered.has(Number(fixture.team1_id)) ||
      !registered.has(Number(fixture.team2_id))
    ) {
      return fail(
        "Une équipe n'est plus inscrite dans cette division.",
        409
      );
    }

    // On protège les rencontres déjà terminées.
    if (fixture.match_id !== null) {
      return fail(
        'Cette rencontre possède déjà un résultat.',
        409
      );
    }

    if (!['pending', 'scheduled'].includes(fixture.status)) {
      return fail(
        'Cette rencontre ne peut plus être programmée.',
        409
      );
    }

    const newStatus = normalizedDate ? 'scheduled' : 'pending';

    // Mise à jour conditionnelle : une rencontre devenue
    // terminée entre-temps ne doit pas être modifiée.
    const { data: updated, error: updateError } =
      await admin
        .from('czf_fixtures')
        .update({
          scheduled_at: normalizedDate,
          status: newStatus,
        })
        .eq('id', fixtureId)
        .eq('season_id', fixture.season_id)
        .is('match_id', null)
        .in('status', ['pending', 'scheduled'])
        .select('id, scheduled_at, status')
        .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return fail(
        'La rencontre a changé entre-temps. Actualise la page.',
        409
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: normalizedDate
          ? 'Date enregistrée.'
          : 'Date remise à définir.',
        fixture: updated,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('[SCHEDULE FIXTURE]', error);

    return fail(
      'Impossible de modifier la programmation.',
      500
    );
  }
}
