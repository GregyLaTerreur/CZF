import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateResults } from '@/lib/results/cache';

export async function PATCH(request: Request) {
  try {
    const {
      team_id,
      validated,
      validated_points,
      division,
    } = await request.json();

    if (!team_id) {
      return NextResponse.json(
        {
          success: false,
          message: 'team_id manquant',
        },
        { status: 400 }
      );
    }

    const updateData = validated
      ? {
          validated_by_admin: true,
          validated_points,
          division,
        }
      : {
          validated_by_admin: false,
          validated_points: null,
          division: null,
        };

    const { data, error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', team_id)
      .select();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error,
          message: error.message,
        },
        { status: 500 }
      );
    }

    invalidateResults();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}