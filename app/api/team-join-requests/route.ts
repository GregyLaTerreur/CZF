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
  } = body;

  const { data, error } = await supabase
    .from('team_join_requests')
    .insert([
      {
        team_id,
        riot_id,
        role,
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