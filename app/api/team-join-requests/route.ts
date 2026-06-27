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
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    team_id,
    riot_id,
    role,
    profile_id,
    player_id,
  } = body;

  const { data: existingMember } = await supabase
    .from('team_members')
    .select('*')
    .eq('riot_id', riot_id)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json({
      success: false,
      message: 'Tu es déjà dans une équipe.',
    });
  }

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

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', team_id);

  if (members && members.length >= 5) {
    return NextResponse.json({
      success: false,
      message: "L'équipe est déjà complète.",
    });
  }

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
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const { request_id, action } = body;

  const { data: joinRequest, error: requestError } =
    await supabase
      .from('team_join_requests')
      .select('*')
      .eq('id', request_id)
      .single();

  if (requestError || !joinRequest) {
    return NextResponse.json(
      {
        success: false,
        message: 'Demande introuvable.',
      },
      { status: 404 }
    );
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('team_join_requests')
      .update({ status: 'rejected' })
      .eq('id', request_id);

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Demande refusée.',
    });
  }

  if (action === 'accept') {
    const { data: alreadyInTeam } = await supabase
      .from('team_members')
      .select('*')
      .eq('riot_id', joinRequest.riot_id)
      .maybeSingle();

    if (alreadyInTeam) {
      return NextResponse.json({
        success: false,
        message: 'Ce joueur est déjà dans une équipe.',
      });
    }

    const { data: roleTaken } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', joinRequest.team_id)
      .eq('role', joinRequest.role)
      .maybeSingle();

    if (roleTaken) {
      return NextResponse.json({
        success: false,
        message: `Le poste ${joinRequest.role} est déjà occupé.`,
      });
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', joinRequest.team_id);

    if (members && members.length >= 5) {
      return NextResponse.json({
        success: false,
        message: "L'équipe est déjà complète.",
      });
    }

    const { error: insertError } = await supabase
      .from('team_members')
      .insert([
        {
          team_id: joinRequest.team_id,
          riot_id: joinRequest.riot_id,
          role: joinRequest.role,
        },
      ]);

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError },
        { status: 500 }
      );
    }

    await supabase
      .from('team_join_requests')
      .update({ status: 'accepted' })
      .eq('id', request_id);

    await supabase
      .from('team_join_requests')
      .delete()
      .eq('player_id', joinRequest.player_id)
      .neq('id', request_id);

    return NextResponse.json({
      success: true,
      message: 'Joueur accepté.',
    });
  }

  return NextResponse.json(
    {
      success: false,
      message: 'Action inconnue.',
    },
    { status: 400 }
  );
}