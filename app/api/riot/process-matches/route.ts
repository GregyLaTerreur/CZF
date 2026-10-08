
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGION_HOSTS: Record<string, string> = {
  EUW1: 'europe',
  EUN1: 'europe',
  TR1: 'europe',
  RU: 'europe',
  NA1: 'americas',
  BR1: 'americas',
  LA1: 'americas',
  LA2: 'americas',
  KR: 'asia',
  JP1: 'asia',
  OC1: 'sea',
  PH2: 'sea',
  SG2: 'sea',
  TH2: 'sea',
  TW2: 'sea',
  VN2: 'sea',
};

type MatchParticipant = {
  puuid?: string;
  teamId?: number;
  win?: boolean;
};

type RiotMatch = {
  metadata?: {
    matchId?: string;
  };
  info?: {
    gameId?: number;
    gameDuration?: number;
    gameEndedInEarlySurrender?: boolean;
    participants?: MatchParticipant[];
  };
};

function json(
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

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      return json(
        { success: false, error: 'CRON_SECRET manquant.' },
        503
      );
    }

    if (
      request.headers.get('authorization') !==
      `Bearer ${secret}`
    ) {
      return json(
        { success: false, error: 'Accès refusé.' },
        401
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const riotKey = process.env.RIOT_API_KEY;

    if (!supabaseUrl || !serviceKey || !riotKey) {
      return json(
        {
          success: false,
          error: 'Configuration Supabase ou Riot manquante.',
        },
        503
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const now = new Date();

    // On traite uniquement les parties dont Riot
    // a déjà signalé la fin via le callback.
    const { data: slots, error: slotsError } = await admin
      .from('czf_tournament_game_slots')
      .select('id, riot_match_id, status')
      .eq('status', 'processing')
      .not('riot_match_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(10);

    if (slotsError) throw slotsError;

    const results: Array<{
      slotId: number;
      status: string;
      message?: string;
    }> = [];

    for (const slot of slots || []) {
      const slotId = Number(slot.id);
      const matchId = String(slot.riot_match_id || '');

      const matchIdParts = /^([A-Z0-9]+)_([0-9]+)$/.exec(
        matchId
      );

      const platform = matchIdParts?.[1] || '';
      const regionalHost = REGION_HOSTS[platform];

      const { data: existing, error: existingError } =
        await admin
          .from('czf_riot_match_imports')
          .select(
            'id, attempts, status, next_retry_at, riot_match_id'
          )
          .eq('slot_id', slotId)
          .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.status === 'fetched') {
        results.push({
          slotId,
          status: 'already_fetched',
        });
        continue;
      }

      if (
        existing?.next_retry_at &&
        new Date(existing.next_retry_at).getTime() >
          now.getTime()
      ) {
        continue;
      }

      // Le résultat ne peut pas être récupéré avec
      // un identifiant de partie incohérent.
      if (
        !regionalHost ||
        !matchIdParts ||
        (existing &&
          existing.riot_match_id !== matchId)
      ) {
        await admin
          .from('czf_tournament_game_slots')
          .update({
            status: 'pending_review',
            validation_error:
              'Identifiant Riot invalide ou incohérent.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', slotId)
          .eq('status', 'processing');

        results.push({
          slotId,
          status: 'pending_review',
          message: 'Identifiant Riot invalide.',
        });

        continue;
      }

      const attempts = Number(existing?.attempts || 0) + 1;
      let matchData: RiotMatch | null = null;
      let errorMessage = '';
      let retrySeconds = Math.min(
        30 * Math.pow(2, Math.min(attempts - 1, 5)),
        900
      );

      try {
        const endpoint =
          `https://${regionalHost}.api.riotgames.com` +
          `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;

        const riotResponse = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'X-Riot-Token': riotKey,
            Accept: 'application/json',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });

        if (!riotResponse.ok) {
          const retryAfter = Number(
            riotResponse.headers.get('retry-after')
          );

          if (
            riotResponse.status === 429 &&
            Number.isFinite(retryAfter) &&
            retryAfter > 0
          ) {
            retrySeconds = Math.max(
              retrySeconds,
              Math.ceil(retryAfter)
            );
          }

          if (
            riotResponse.status === 401 ||
            riotResponse.status === 403
          ) {
            errorMessage =
              `Clé Riot refusée (HTTP ${riotResponse.status}).`;
          } else {
            errorMessage =
              `Riot Match-V5 : HTTP ${riotResponse.status}.`;
          }
        } else {
          matchData = (await riotResponse.json()) as RiotMatch;
        }
      } catch (error) {
        errorMessage =
          error instanceof Error
            ? error.message.slice(0, 200)
            : 'Erreur réseau Riot.';
      }

      if (matchData) {
        const participants =
          matchData.info?.participants || [];

        const matchIdValid =
          matchData.metadata?.matchId === matchId;

        const durationValid =
          typeof matchData.info?.gameDuration === 'number' &&
          matchData.info.gameDuration > 0;

        const teamsValid =
          participants.length === 10 &&
          participants.filter((p) => p.teamId === 100)
            .length === 5 &&
          participants.filter((p) => p.teamId === 200)
            .length === 5;

        const puuidsValid =
          participants.length === 10 &&
          participants.every(
            (p) =>
              typeof p.puuid === 'string' &&
              p.puuid.length > 0
          ) &&
          new Set(participants.map((p) => p.puuid)).size === 10;

        if (
          !matchIdValid ||
          !durationValid ||
          !teamsValid ||
          !puuidsValid
        ) {
          errorMessage =
            'Données Riot incohérentes ou incomplètes.';

          const { error: saveReviewError } = await admin
            .from('czf_riot_match_imports')
            .upsert(
              {
                slot_id: slotId,
                riot_match_id: matchId,
                status: 'pending_review',
                match_data: matchData,
                attempts,
                last_error: errorMessage,
                last_attempt_at: new Date().toISOString(),
                next_retry_at: null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'slot_id' }
            );

          if (saveReviewError) throw saveReviewError;

          const { error: slotReviewError } = await admin
            .from('czf_tournament_game_slots')
            .update({
              status: 'pending_review',
              validation_error: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', slotId)
            .eq('status', 'processing');

          if (slotReviewError) throw slotReviewError;

          results.push({
            slotId,
            status: 'pending_review',
            message: errorMessage,
          });

          continue;
        }

        // Données récupérées, mais pas encore publiées.
        // La vérification du roster vient ensuite.
        const { error: saveError } = await admin
          .from('czf_riot_match_imports')
          .upsert(
            {
              slot_id: slotId,
              riot_match_id: matchId,
              status: 'fetched',
              match_data: matchData,
              attempts,
              last_error: null,
              last_attempt_at: new Date().toISOString(),
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'slot_id' }
          );

        if (saveError) throw saveError;

        const { error: updateError } = await admin
          .from('czf_tournament_game_slots')
          .update({
            status: 'pending_review',
            validation_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', slotId)
          .eq('status', 'processing');

        if (updateError) throw updateError;

        results.push({
          slotId,
          status: 'fetched',
        });

        continue;
      }

      const permanentAuthFailure =
        errorMessage.includes('Clé Riot refusée');

      // En cas de 404, 429 ou d'erreur temporaire,
      // on conserve la partie et on réessaiera.
      const shouldReview =
        permanentAuthFailure || attempts >= 12;

      const { error: retryError } = await admin
        .from('czf_riot_match_imports')
        .upsert(
          {
            slot_id: slotId,
            riot_match_id: matchId,
            status: shouldReview
              ? 'pending_review'
              : 'waiting',
            attempts,
            last_error: errorMessage || 'Riot indisponible.',
            last_attempt_at: new Date().toISOString(),
            next_retry_at: shouldReview
              ? null
              : new Date(
                  Date.now() + retrySeconds * 1000
                ).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'slot_id' }
        );

      if (retryError) throw retryError;

      if (shouldReview) {
        const { error: reviewError } = await admin
          .from('czf_tournament_game_slots')
          .update({
            status: 'pending_review',
            validation_error:
              errorMessage || 'Riot indisponible.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', slotId)
          .eq('status', 'processing');

        if (reviewError) throw reviewError;
      }

      results.push({
        slotId,
        status: shouldReview
          ? 'pending_review'
          : 'retry_later',
        message: errorMessage,
      });
    }

    return json({
      success: true,
      checked: results.length,
      results,
    });
  } catch (error) {
    console.error('[RIOT PROCESS MATCHES]', error);

    return json(
      {
        success: false,
        error: 'Traitement Riot impossible.',
      },
      500
    );
  }
}
