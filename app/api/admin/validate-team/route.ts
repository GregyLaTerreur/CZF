import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { invalidateResults } from '@/lib/results/cache';

const DIVISIONS = ['Targon', 'Ixtal', 'Yordle'];

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

// Un admin valide (points + division) ou dévalide une équipe.
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { team_id, validated, validated_points, division } = await request.json();

    const teamId = Number(team_id);
    if (!Number.isInteger(teamId) || teamId <= 0) return fail('team_id manquant', 400);

    let updateData;

    if (validated === true) {
      const points = Number(validated_points);
      if (!Number.isFinite(points) || points < 0) return fail('Points invalides.', 400);
      if (!DIVISIONS.includes(division)) return fail('Division invalide.', 400);

      updateData = { validated_by_admin: true, validated_points: points, division };
    } else {
      updateData = { validated_by_admin: false, validated_points: null, division: null };
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select();

    if (error) {
      console.error('[validate-team]', error);
      return fail('Erreur lors de la mise à jour de l’équipe.', 500);
    }

    if (!data?.length) return fail('Équipe introuvable.', 404);

    invalidateResults();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[validate-team]', error);
    return fail('Erreur serveur', 500);
  }
}
