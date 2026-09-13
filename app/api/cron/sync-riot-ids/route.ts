import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    /* =====================================================
       SÉCURITÉ CRON
    ===================================================== */

    const authHeader = request.headers.get('authorization');

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Non autorisé.',
        },
        { status: 401 }
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
       RÉCUPÈRE TOUS LES JOUEURS AVEC UN PUUID
    ===================================================== */

    const { data: players, error: playersError } =
      await supabaseAdmin
        .from('players')
        .select('id, riot_id, puuid')
        .not('puuid', 'is', null);

    if (playersError) {
      return NextResponse.json(
        {
          success: false,
          error: playersError,
        },
        { status: 500 }
      );
    }

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    const changes: any[] = [];

    /* =====================================================
       ON PARCOURT LES JOUEURS
    ===================================================== */

    for (const player of players || []) {
      try {
        if (!player.puuid) {
          continue;
        }

        const oldRiotId =
          String(player.riot_id || '').trim();

        /* =================================================
           RIOT ACCOUNT API

           Le PUUID reste stable même si le pseudo change.
        ================================================= */

        const riotResponse = await fetch(
          `https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(
            player.puuid
          )}`,
          {
            headers: {
              'X-Riot-Token':
                process.env.RIOT_API_KEY,
            },
            cache: 'no-store',
          }
        );

        if (!riotResponse.ok) {
          console.error(
            `Riot erreur joueur ${player.id}:`,
            riotResponse.status
          );

          failed++;
          continue;
        }

        const account =
          await riotResponse.json();

        if (
          !account?.gameName ||
          !account?.tagLine
        ) {
          failed++;
          continue;
        }

        const newRiotId =
          `${account.gameName}#${account.tagLine}`;

        /* =================================================
           PAS DE CHANGEMENT
        ================================================= */

        if (oldRiotId === newRiotId) {
          unchanged++;
          continue;
        }

        /* =================================================
           UPDATE PLAYERS

           ON NE CHANGE JAMAIS player.id
        ================================================= */

        const {
          error: playerUpdateError,
        } = await supabaseAdmin
          .from('players')
          .update({
            riot_id: newRiotId,
          })
          .eq('id', player.id);

        if (playerUpdateError) {
          console.error(
            'Erreur update player:',
            playerUpdateError
          );

          failed++;
          continue;
        }

        /* =================================================
           UPDATE TEAM MEMBERS

           Ton système actuel utilise encore riot_id ici.
        ================================================= */

        if (oldRiotId) {
          const {
            error: memberError,
          } = await supabaseAdmin
            .from('team_members')
            .update({
              riot_id: newRiotId,
            })
            .eq(
              'riot_id',
              oldRiotId
            );

          if (memberError) {
            console.error(
              'Erreur team_members:',
              memberError
            );
          }
        }

        /* =================================================
           UPDATE CAPITAINE

           Si le joueur est capitaine.
        ================================================= */

        const {
          error: captainError,
        } = await supabaseAdmin
          .from('teams')
          .update({
            captain_riot_id:
              newRiotId,
          })
          .eq(
            'captain_player_id',
            player.id
          );

        if (captainError) {
          console.error(
            'Erreur captain:',
            captainError
          );
        }

        /* =================================================
           IMPORTANT

           On ne touche PAS à :
           czf_game_player_stats

           Les stats sont reliées à player_id.
        ================================================= */

        updated++;

        changes.push({
          player_id: player.id,
          old_riot_id: oldRiotId,
          new_riot_id: newRiotId,
        });

        /*
          Petite pause entre les appels Riot.
        */

        await new Promise(
          (resolve) =>
            setTimeout(resolve, 150)
        );
      } catch (error) {
        console.error(
          `Erreur joueur ${player.id}:`,
          error
        );

        failed++;
      }
    }

    return NextResponse.json({
      success: true,

      total:
        players?.length || 0,

      updated,
      unchanged,
      failed,

      changes,
    });
  } catch (error: any) {
    console.error(
      'SYNC RIOT IDS ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          'Erreur synchronisation Riot.',
      },
      { status: 500 }
    );
  }
}