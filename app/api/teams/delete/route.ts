import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { invalidateResults } from '@/lib/results/cache';

export async function DELETE(request: Request) {
  const { team_id } = await request.json();

  await supabase
    .from("team_members")
    .delete()
    .eq("team_id", team_id);

  await supabase
    .from("team_join_requests")
    .delete()
    .eq("team_id", team_id);

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", team_id);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      {
        status: 500,
      }
    );
  }

  invalidateResults();

  return NextResponse.json({
    success: true,
  });
}