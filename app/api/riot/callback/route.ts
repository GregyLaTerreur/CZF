
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RiotCallback = {
  shortCode?: unknown;
  gameId?: unknown;
  region?: unknown;
  startTime?: unknown;
  metaData?: unknown;
  gameName?: unknown;
  gameType?: unknown;
  gameMap?: unknown;
  gameMode?: unknown;
};

function response(message: string, status: number) {
  return NextResponse.json(
    { success: status === 200, message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

function secureEquals(a: string, b: string) {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();

  return timingSafeEqual(aHash, bHash);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const callbackSecret =
      process.env.RIOT_CALLBACK_SECRET;

    if (
      !supabaseUrl ||
      !serviceKey ||
      !callbackSecret ||
      callbackSecret.length < 32
    ) {
      console.error(
        '[RIOT CALLBACK] Configuration manquante.'
      );

      return response(
        'Service indisponible.',
        503
      );
    }

    // Riot utilisera l'URL enregistrée pour le provider.
    // Le secret n'est jamais communiqué au navigateur.
    const receivedSecret =
      request.nextUrl.searchParams.get('token') || '';

    if (
      !secureEquals(receivedSecret, callbackSecret)
    ) {
      return response('Accès refusé.', 401);
    }

    const rawBody = await request.text();

    if (rawBody.length > 32000) {
      return response('Notification trop volumineuse.', 413);
    }

    let payload: RiotCallback;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return response('JSON invalide.', 400);
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      return response('Notification invalide.', 400);
    }

    const shortCode = payload.shortCode;

    const gameId =
      typeof payload.gameId === 'number' &&
      Number.isSafeInteger(payload.gameId)
        ? String(payload.gameId)
        : payload.gameId;

    const region = payload.region;

    if (
      typeof shortCode !== 'string' ||
      shortCode.length === 0 ||
      shortCode.length > 256 ||
      typeof gameId !== 'string' ||
      !/^[0-9]{1,20}$/.test(gameId) ||
      typeof region !== 'string' ||
      !/^[A-Za-z0-9]{2,8}$/.test(region)
    ) {
      return response(
        'Champs Riot invalides.',
        400
      );
    }

    const normalizedRegion = region.toUpperCase();

    const admin = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // On ne fait confiance qu'aux codes que CZF
    // a préalablement enregistrés en base.
    const { data: slot, error: slotError } =
      await admin
        .from('czf_tournament_game_slots')
        .select(
          'id, fixture_id, game_number, status, riot_match_id'
        )
        .eq('tournament_code', shortCode)
        .maybeSingle();

    if (slotError) {
      console.error(
        '[RIOT CALLBACK] Lecture du slot :',
        slotError
      );

      return response(
        'Erreur de lecture.',
        500
      );
    }

    if (!slot) {
      console.warn(
        '[RIOT CALLBACK] Code inconnu.'
      );

      return response(
        'Tournament Code inconnu.',
        404
      );
    }

    const matchIdentifier =
      `${normalizedRegion}_${gameId}`;

    // Un slot ne doit jamais recevoir deux parties
    // différentes sans intervention administrative.
    if (
      slot.riot_match_id &&
      slot.riot_match_id !== matchIdentifier
    ) {
      console.error(
        '[RIOT CALLBACK] Conflit de partie sur slot',
        slot.id
      );

      return response(
        'Conflit de partie.',
        409
      );
    }

    // Conserver le callback brut pour audit,
    // débogage et traitement ultérieur.
    const { error: insertError } =
      await admin
        .from('czf_riot_callbacks')
        .insert({
          slot_id: slot.id,
          short_code: shortCode,
          game_id: gameId,
          region: normalizedRegion,
          payload,
        });

    // 23505 = doublon PostgreSQL.
    // Un callback peut être renvoyé par Riot.
    if (
      insertError &&
      insertError.code !== '23505'
    ) {
      console.error(
        '[RIOT CALLBACK] Enregistrement :',
        insertError
      );

      return response(
        "Impossible d'enregistrer la notification.",
        500
      );
    }

    // Ne pas revenir en arrière sur une game
    // déjà terminée ou annulée.
    if (
      slot.status === 'completed' ||
      slot.status === 'cancelled'
    ) {
      return response(
        'Notification reçue.',
        200
      );
    }

    if (
      ![
        'pending',
        'code_ready',
        'in_progress',
        'processing',
        'pending_review',
      ].includes(slot.status)
    ) {
      return response(
        'Statut de game incompatible.',
        409
      );
    }

    // Passage en analyse seulement.
    // Aucun résultat n'est publié ici.
    const { data: updated, error: updateError } =
      await admin
        .from('czf_tournament_game_slots')
        .update({
          riot_match_id: matchIdentifier,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', slot.id)
        .eq('tournament_code', shortCode)
        .in('status', [
          'pending',
          'code_ready',
          'in_progress',
          'processing',
        ])
        .or(
          `riot_match_id.is.null,riot_match_id.eq.${matchIdentifier}`
        )
        .select('id')
        .maybeSingle();

    if (updateError) {
      console.error(
        '[RIOT CALLBACK] Mise à jour :',
        updateError
      );

      return response(
        'Erreur de mise à jour.',
        500
      );
    }

    // Une game passée en validation manuelle
    // ne doit pas être écrasée par un callback tardif.
    if (!updated) {
      const { data: current, error: currentError } =
        await admin
          .from('czf_tournament_game_slots')
          .select('status, riot_match_id')
          .eq('id', slot.id)
          .maybeSingle();

      if (currentError || !current) {
        return response(
          'Impossible de confirmer le statut.',
          500
        );
      }

      if (
        current.riot_match_id &&
        current.riot_match_id !== matchIdentifier
      ) {
        return response(
          'Conflit de partie.',
          409
        );
      }

      if (
        current.status === 'pending_review' ||
        current.status === 'completed' ||
        current.status === 'cancelled'
      ) {
        return response(
          'Notification déjà prise en compte.',
          200
        );
      }

      return response(
        'Mise à jour concurrente, réessayer.',
        503
      );
    }

    console.info(
      '[RIOT CALLBACK] Game reçue :',
      {
        slotId: slot.id,
        fixtureId: slot.fixture_id,
        gameNumber: slot.game_number,
        region: normalizedRegion,
      }
    );

    return response(
      'Notification enregistrée.',
      200
    );
  } catch (error) {
    console.error(
      '[RIOT CALLBACK] Erreur inattendue :',
      error
    );

    return response(
      'Erreur du serveur.',
      500
    );
  }
}
