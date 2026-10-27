import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateResults } from '@/lib/results/cache';

export async function GET() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });

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
    name,
    captain_riot_id,
    captain_profile_id,
    captain_player_id,
    description,
    logo_url,
    multigg_url,
  } = body;

  const { data, error } = await supabase
    .from('teams')
    .insert([
      {
        name,
        captain_riot_id,
        captain_profile_id,
        captain_player_id,
        description,
        logo_url,
        multigg_url,
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

  const {
    team_id,
    name,
    description,
    logo_url,
    multigg_url,
    tag,
  } = body;

  // Absent = on ne touche pas au tag (l'admin ne l'envoie pas) ; vide = on l'efface.
  let cleanTag: string | null | undefined;

  if (tag !== undefined) {
    cleanTag = String(tag || '').trim().toUpperCase() || null;

    if (cleanTag && !/^[A-Z0-9]{2,5}$/.test(cleanTag)) {
      return NextResponse.json(
        { success: false, message: 'Le tag doit faire 2 à 5 lettres ou chiffres.' },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('teams')
    .update({
      name,
      description,
      logo_url,
      multigg_url,
      tag: cleanTag,
    })
    .eq('id', team_id)
    .select();

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  invalidateResults();

  return NextResponse.json({
    success: true,
    data,
  });
}