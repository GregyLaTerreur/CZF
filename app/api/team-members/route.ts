import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const body = await request.json();

  const { team_id, riot_id, role } = body;

  const { data, error } = await supabase
    .from('team_members')
    .insert([{ team_id, riot_id, role }])
    .select();

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request) {
  const body = await request.json();

  const { team_id, riot_id } = body;

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', team_id)
    .eq('riot_id', riot_id);

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}