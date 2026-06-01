import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('players')
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

  const { riot_id, main_role, secondary_role, description } = body;

  const { data, error } = await supabase
    .from('players')
    .insert([
      {
        riot_id,
        main_role,
        secondary_role,
        description,
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