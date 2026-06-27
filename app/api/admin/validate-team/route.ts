import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const { team_id, validated } = await request.json();

  const { data, error } = await supabase
    .from('teams')
    .update({
      validated_by_admin: validated,
    })
    .eq('id', team_id)
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