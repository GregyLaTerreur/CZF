import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const maxDuration = 300;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getRetryDelay(response: Response) {
  const retryAfter = response.headers.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      return Math.max(
        seconds * 1000,
        10000
      );
    }
  }

  return 15000;
}

export async function PATCH(request: Request) {
  try {
    /* =====================================================
       AUTH ADMIN
    ===================================================== */

    const authHeader =
      request.headers.get('authorization');

    const token =
      authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Non connecté.',
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session invalide.',
        },
        { status: 401 }
      );
    }

    const { data: adminProfile } =
      await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!adminProfile?.is_admin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Accès admin requis.',
        },
        { status: 403 }
      );
    }

    if (!process.env.RIOT_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: 'RIOT_API_KEY manquante.',
        },
        { status: 500 }
      );
    }

    /* =====================================================
       PARAMÈTRES DU LOT
    ===================================================== */

    const body = await request.json();

    const offset =
      Number(body.offset) || 0;

    const requestedLimit =
      Number(body.limit) || 10;

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      10
    );

    const playerIds: number[] =
      Array.isArray(body.player_ids)
        ? body.player_ids
            .map((id: any) => Number(id))
            .filter((id: number) =>
              Number.isFinite(id)
            )
        : [];

    /* =====================================================
       TOTAL JOUEURS
    ===================================================== */

    const {
      count: totalPlayers,
      error: countError,
    } = await supabaseAdmin
      .from('players')
      .select('id', {
        count: 'exact',
        head: true,
      });

    if (countError) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Impossible de compter les joueurs.',
          error: countError,
        },
        { status: 500 }
      );
    }

    /* =====================================================
       RÉCUPÉRATION DU LOT
    ===================================================== */

    let playersQuery =
      supabaseAdmin
        .from('players')
        .select('*')
        .order('id', {
          ascending: true,
        });

    if (playerIds.length > 0) {
      playersQuery =
        playersQuery.in(
          'id',
          playerIds
        );
    } else {
      playersQuery =
        playersQuery.range(
          offset,
          offset + limit - 1
        );
    }

    const {
      data: players,
      error: playersError,
    } = await playersQuery;

    if (playersError) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Impossible de récupérer les joueurs.',
          error: playersError,
        },
        { status: 500 }
      );
    }

    const origin =
      new URL(request.url).origin;

    const results: any[] = [];

    /* =====================================================
       UPDATE D'UN JOUEUR
    ===================================================== */

    async function updateOnePlayer(
      player: any
    ) {
      const maxAttempts = 3;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
      ) {
        try {
          const oldRiotId =
            String(
              player.riot_id || ''
            ).trim();

          let currentRiotId =
            oldRiotId;

          /* ===============================================
             1. PSEUDO ACTUEL VIA PUUID
          =============================================== */

          if (player.puuid) {
            const accountRes =
              await fetchWithTimeout(
                `https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(
                  player.puuid
                )}`,
                {
                  headers: {
                    'X-Riot-Token':
                      process.env
                        .RIOT_API_KEY!,
                  },
                },
                20000
              );

            if (
              accountRes.status === 429
            ) {
              const delay =
                getRetryDelay(
                  accountRes
                );

              console.log(
                `Rate limit Riot pour ${oldRiotId}. Attente ${Math.round(
                  delay / 1000
                )} secondes.`
              );

              if (
                attempt ===
                maxAttempts
              ) {
                throw new Error(
                  'Riot rate limit'
                );
              }

              await wait(delay);

              continue;
            }

            if (
              accountRes.status >= 500
            ) {
              throw new Error(
                `Riot indisponible (${accountRes.status})`
              );
            }

            if (accountRes.ok) {
              const account =
                await accountRes.json();

              if (
                account?.gameName &&
                account?.tagLine
              ) {
                currentRiotId =
                  `${account.gameName}#${account.tagLine}`;
              }
            }
          }

          if (!currentRiotId) {
            throw new Error(
              'Riot ID manquant'
            );
          }

          /* ===============================================
             2. RANK / LP / WR / POINTS
          =============================================== */

          const riotRes =
            await fetchWithTimeout(
              `${origin}/api/riot/player`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify({
                    riot_id:
                      currentRiotId,

                    peak_tier:
                      player.peak_tier,

                    peak_rank:
                      player.peak_rank,

                    peak_lp:
                      player.peak_lp,

                    skip_top_champions:
                      true,
                  }),
              },
              30000
            );

          if (
            riotRes.status === 429
          ) {
            const delay =
              getRetryDelay(
                riotRes
              );

            console.log(
              `Rate limit Riot pendant le refresh de ${currentRiotId}. Attente ${Math.round(
                delay / 1000
              )} secondes.`
            );

            if (
              attempt ===
              maxAttempts
            ) {
              throw new Error(
                'Riot rate limit'
              );
            }

            await wait(delay);

            continue;
          }

          const raw =
            await riotRes.text();

          let riotData: any;

          try {
            riotData =
              JSON.parse(raw);
          } catch {
            throw new Error(
              `Réponse Riot invalide (${riotRes.status})`
            );
          }

          if (
            !riotRes.ok ||
            !riotData.success
          ) {
            throw new Error(
              riotData.message ||
                riotData.error ||
                `Erreur Riot (${riotRes.status})`
            );
          }

          const data =
            riotData.data;

          /* ===============================================
             3. UPDATE PLAYERS
          =============================================== */

          const {
            error: updateError,
          } = await supabaseAdmin
            .from('players')
            .update({
              riot_id:
                currentRiotId,

              puuid:
                data.puuid ||
                player.puuid,

              summoner_level:
                data.summoner_level,

              profile_icon_id:
                data.profile_icon_id,

              soloq_tier:
                data.soloq_tier,

              soloq_rank:
                data.soloq_rank,

              soloq_lp:
                data.soloq_lp,

              soloq_wins:
                data.soloq_wins,

              soloq_losses:
                data.soloq_losses,

              flex_tier:
                data.flex_tier,

              flex_rank:
                data.flex_rank,

              flex_lp:
                data.flex_lp,

              peak_tier:
                data.peak_tier,

              peak_rank:
                data.peak_rank,

              peak_lp:
                data.peak_lp,

              czf_points:
                data.czf_points,
            })
            .eq(
              'id',
              player.id
            );

          if (updateError) {
            throw updateError;
          }

          /* ===============================================
             4. CHANGEMENT DE PSEUDO
          =============================================== */

          const renamed =
            oldRiotId !==
            currentRiotId;

          if (
            renamed &&
            oldRiotId
          ) {
            const {
              error:
                memberError,
            } =
              await supabaseAdmin
                .from(
                  'team_members'
                )
                .update({
                  riot_id:
                    currentRiotId,
                })
                .eq(
                  'riot_id',
                  oldRiotId
                );

            if (memberError) {
              console.error(
                'TEAM MEMBERS UPDATE:',
                memberError
              );
            }

            const {
              error:
                captainError,
            } =
              await supabaseAdmin
                .from('teams')
                .update({
                  captain_riot_id:
                    currentRiotId,
                })
                .eq(
                  'captain_player_id',
                  player.id
                );

            if (captainError) {
              console.error(
                'CAPTAIN UPDATE:',
                captainError
              );
            }
          }

          return {
            success: true,

            player_id:
              player.id,

            old_riot_id:
              oldRiotId,

            new_riot_id:
              currentRiotId,

            renamed,

            attempts:
              attempt,
          };
        } catch (error: any) {
          console.error(
            `PLAYER ${player.id} ATTEMPT ${attempt}:`,
            error
          );

          if (
            attempt ===
            maxAttempts
          ) {
            return {
              success: false,

              player_id:
                player.id,

              riot_id:
                player.riot_id,

              error:
                error?.message ||
                'Erreur inconnue',

              attempts:
                attempt,
            };
          }

          /*
            Petite attente pour les erreurs normales.
            Les 429 sont déjà gérés plus haut.
          */

          await wait(
            attempt * 3000
          );
        }
      }

      return {
        success: false,
        player_id:
          player.id,
        riot_id:
          player.riot_id,
        error:
          'Erreur inconnue',
      };
    }

    /* =====================================================
       TRAITEMENT

       IMPORTANT :
       1 seul joueur à la fois.
    ===================================================== */

    for (
      let i = 0;
      i < (players || []).length;
      i++
    ) {
      const player =
        players![i];

      const result =
        await updateOnePlayer(
          player
        );

      results.push(result);

      /*
        On laisse Riot respirer entre deux joueurs.

        5 secondes volontairement.
      */

      if (
        i <
        (players || []).length -
          1
      ) {
        await wait(5000);
      }
    }

    /* =====================================================
       RÉSUMÉ DU LOT
    ===================================================== */

    const successful =
      results.filter(
        (r) => r.success
      );

    const failed =
      results.filter(
        (r) => !r.success
      );

    const renamed =
      successful.filter(
        (r) => r.renamed
      );

    return NextResponse.json({
      success: true,

      total:
        totalPlayers || 0,

      batch_count:
        players?.length || 0,

      offset,

      updated:
        successful.length,

      failed:
        failed.length,

      renamed:
        renamed.length,

      results,

      failed_players:
        failed,

      renamed_players:
        renamed,
    });
  } catch (error: any) {
    console.error(
      'ADMIN REFRESH RIOT ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          'Erreur mise à jour Riot.',
      },
      { status: 500 }
    );
  }
}