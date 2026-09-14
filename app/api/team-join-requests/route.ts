import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('team_join_requests')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}


/* =========================================================
   CRÉER UNE DEMANDE
========================================================= */

export async function POST(request: Request) {
  const body = await request.json();

  const {
    team_id,
    riot_id,
    role,
    profile_id,
    player_id,
  } = body;

  if (!player_id) {
    return NextResponse.json(
      {
        success: false,
        message: 'Profil joueur introuvable.',
      },
      { status: 400 }
    );
  }

  /* =====================================================
     VÉRIFIER SI LE JOUEUR EST DÉJÀ DANS UNE ÉQUIPE

     Nouveau système :
     on vérifie d'abord avec player_id.
  ===================================================== */

  const { data: existingMemberByPlayerId } =
    await supabase
      .from('team_members')
      .select('*')
      .eq('player_id', player_id)
      .maybeSingle();

  if (existingMemberByPlayerId) {
    return NextResponse.json({
      success: false,
      message: 'Tu es déjà dans une équipe.',
    });
  }

  /*
    Fallback ancien système pour d'éventuelles
    anciennes lignes sans player_id.
  */

  const { data: existingMemberByRiotId } =
    await supabase
      .from('team_members')
      .select('*')
      .eq('riot_id', riot_id)
      .maybeSingle();

  if (existingMemberByRiotId) {
    return NextResponse.json({
      success: false,
      message: 'Tu es déjà dans une équipe.',
    });
  }

  /* =====================================================
     POSTE DÉJÀ PRIS
  ===================================================== */

  const { data: roleTaken } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', team_id)
    .eq('role', role)
    .maybeSingle();

  if (roleTaken) {
    return NextResponse.json({
      success: false,
      message: `Le poste ${role} est déjà occupé.`,
    });
  }

  /* =====================================================
     ÉQUIPE COMPLÈTE
  ===================================================== */

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', team_id);

  if (
    members &&
    members.length >= 5
  ) {
    return NextResponse.json({
      success: false,
      message: "L'équipe est déjà complète.",
    });
  }

  /* =====================================================
     DEMANDE DÉJÀ EXISTANTE
  ===================================================== */

  const { data: existingRequest } = await supabase
    .from('team_join_requests')
    .select('*')
    .eq('team_id', team_id)
    .eq('player_id', player_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingRequest) {
    return NextResponse.json({
      success: false,
      message: 'Tu as déjà postulé à cette équipe.',
    });
  }

  /* =====================================================
     CRÉER LA DEMANDE
  ===================================================== */

  const { data, error } = await supabase
    .from('team_join_requests')
    .insert([
      {
        team_id,
        riot_id,
        role,
        profile_id,
        player_id,
        status: 'pending',
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}


/* =========================================================
   ACCEPTER / REFUSER UNE DEMANDE
========================================================= */

export async function PATCH(request: Request) {
  const body = await request.json();

  const {
    request_id,
    action,
  } = body;

  /* =====================================================
     RÉCUPÉRER LA DEMANDE
  ===================================================== */

  const {
    data: joinRequest,
    error: requestError,
  } = await supabase
    .from('team_join_requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (
    requestError ||
    !joinRequest
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'Demande introuvable.',
      },
      { status: 404 }
    );
  }

  /* =====================================================
     REFUSER
  ===================================================== */

  if (action === 'reject') {
    const { error } = await supabase
      .from('team_join_requests')
      .update({
        status: 'rejected',
      })
      .eq('id', request_id);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Demande refusée.',
    });
  }

  /* =====================================================
     ACCEPTER
  ===================================================== */

  if (action === 'accept') {
    if (!joinRequest.player_id) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Cette demande ne possède pas de player_id.',
        },
        { status: 400 }
      );
    }

    /* ===================================================
       RÉCUPÉRER LE JOUEUR ACTUEL

       Comme ça, même s'il a changé de Riot ID
       depuis sa demande, on utilise son pseudo actuel.
    =================================================== */

    const {
      data: currentPlayer,
      error: playerError,
    } = await supabase
      .from('players')
      .select('id, riot_id')
      .eq(
        'id',
        joinRequest.player_id
      )
      .single();

    if (
      playerError ||
      !currentPlayer
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Profil joueur introuvable.',
        },
        { status: 404 }
      );
    }

    /* ===================================================
       DÉJÀ DANS UNE ÉQUIPE
    =================================================== */

    const {
      data:
        alreadyInTeamByPlayerId,
    } = await supabase
      .from('team_members')
      .select('*')
      .eq(
        'player_id',
        joinRequest.player_id
      )
      .maybeSingle();

    if (
      alreadyInTeamByPlayerId
    ) {
      return NextResponse.json({
        success: false,
        message:
          'Ce joueur est déjà dans une équipe.',
      });
    }

    /*
      Fallback ancien système.
    */

    const {
      data:
        alreadyInTeamByRiotId,
    } = await supabase
      .from('team_members')
      .select('*')
      .eq(
        'riot_id',
        currentPlayer.riot_id
      )
      .maybeSingle();

    if (
      alreadyInTeamByRiotId
    ) {
      return NextResponse.json({
        success: false,
        message:
          'Ce joueur est déjà dans une équipe.',
      });
    }

    /* ===================================================
       POSTE DÉJÀ PRIS
    =================================================== */

    const {
      data: roleTaken,
    } = await supabase
      .from('team_members')
      .select('*')
      .eq(
        'team_id',
        joinRequest.team_id
      )
      .eq(
        'role',
        joinRequest.role
      )
      .maybeSingle();

    if (roleTaken) {
      return NextResponse.json({
        success: false,
        message:
          `Le poste ${joinRequest.role} est déjà occupé.`,
      });
    }

    /* ===================================================
       ÉQUIPE COMPLÈTE
    =================================================== */

    const {
      data: members,
    } = await supabase
      .from('team_members')
      .select('*')
      .eq(
        'team_id',
        joinRequest.team_id
      );

    if (
      members &&
      members.length >= 5
    ) {
      return NextResponse.json({
        success: false,
        message:
          "L'équipe est déjà complète.",
      });
    }

    /* ===================================================
       AJOUTER LE JOUEUR

       IMPORTANT :
       player_id est maintenant enregistré.
    =================================================== */

    const {
      error: insertError,
    } = await supabase
      .from('team_members')
      .insert([
        {
          team_id:
            joinRequest.team_id,

          player_id:
            joinRequest.player_id,

          riot_id:
            currentPlayer.riot_id,

          role:
            joinRequest.role,
        },
      ]);

    if (insertError) {
      return NextResponse.json(
        {
          success: false,
          error: insertError,
        },
        { status: 500 }
      );
    }

    /* ===================================================
       MARQUER COMME ACCEPTÉE
    =================================================== */

    const {
      error: acceptError,
    } = await supabase
      .from('team_join_requests')
      .update({
        status: 'accepted',
        riot_id:
          currentPlayer.riot_id,
      })
      .eq(
        'id',
        request_id
      );

    if (acceptError) {
      console.error(
        'Erreur update request:',
        acceptError
      );
    }

    /* ===================================================
       SUPPRIMER LES AUTRES DEMANDES DU JOUEUR
    =================================================== */

    await supabase
      .from('team_join_requests')
      .delete()
      .eq(
        'player_id',
        joinRequest.player_id
      )
      .neq(
        'id',
        request_id
      );

    return NextResponse.json({
      success: true,
      message: 'Joueur accepté.',
    });
  }

  /* =====================================================
     ACTION INCONNUE
  ===================================================== */

  return NextResponse.json(
    {
      success: false,
      message: 'Action inconnue.',
    },
    { status: 400 }
  );
}                     