import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireUser } from '@/lib/auth';
import { loadManageableTeam } from '@/lib/teams/permissions';
import { invalidateResults } from '@/lib/results/cache';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const TEAM_SIZE = 5;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

const normalize = (riotId: unknown) => String(riotId ?? '').trim().toLowerCase();

// En prod, service_role n'a pas encore les droits sur team_join_requests : repli sur le client anon
// (permission refusée = code 42501). Les droits de l'utilisateur sont vérifiés avant tout appel.
async function onRequests<T extends { error: { code?: string } | null }>(
  query: (db: SupabaseClient) => PromiseLike<T>
): Promise<T> {
  const result = await query(supabaseAdmin);
  if (result.error?.code === '42501') return query(supabase);
  return result;
}

// Le joueur est-il déjà dans une équipe (membre ou capitaine) ?
async function hasTeam(player: { id: number; riot_id: string }) {
  const [{ data: byId }, { data: all }, { data: captainOf }] = await Promise.all([
    supabaseAdmin.from('team_members').select('id').eq('player_id', player.id).limit(1),
    // Anciennes lignes sans player_id : comparaison sur le Riot ID.
    supabaseAdmin.from('team_members').select('riot_id').is('player_id', null),
    supabaseAdmin.from('teams').select('id').eq('captain_player_id', player.id).limit(1),
  ]);

  return (
    !!byId?.length ||
    !!captainOf?.length ||
    (all || []).some((m) => normalize(m.riot_id) === normalize(player.riot_id))
  );
}

export async function GET() {
  const { data, error } = await onRequests((db) =>
    db.from('team_join_requests').select('*').order('created_at', { ascending: false })
  );

  if (error) {
    console.error('[team-join-requests GET]', error);
    return fail('Impossible de charger les candidatures.', 500);
  }

  return NextResponse.json({ success: true, data });
}

/* =========================================================
   CRÉER UNE DEMANDE (le joueur connecté postule)
========================================================= */

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = Number(body.team_id);
  if (!Number.isInteger(teamId) || teamId <= 0) return fail('team_id manquant', 400);

  // Le candidat est toujours le joueur du compte connecté.
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id, riot_id, main_role')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (!player) return fail('Profil joueur introuvable.', 400);

  const role = body.role ?? player.main_role;
  if (!ROLES.includes(role)) return fail('Poste invalide.', 400);

  const { data: team } = await supabaseAdmin.from('teams').select('id').eq('id', teamId).maybeSingle();
  if (!team) return fail('Équipe introuvable.', 404);

  if (await hasTeam(player)) return fail('Tu es déjà dans une équipe.', 409);

  const { data: members } = await supabaseAdmin.from('team_members').select('role').eq('team_id', teamId);

  if ((members || []).some((m) => m.role === role)) return fail(`Le poste ${role} est déjà occupé.`, 409);
  if ((members || []).length >= TEAM_SIZE) return fail("L'équipe est déjà complète.", 409);

  const { data: existing } = await onRequests((db) =>
    db
      .from('team_join_requests')
      .select('id')
      .eq('team_id', teamId)
      .eq('player_id', player.id)
      .eq('status', 'pending')
      .limit(1)
  );

  if (existing?.length) return fail('Tu as déjà postulé à cette équipe.', 409);

  const { data, error } = await onRequests((db) =>
    db
      .from('team_join_requests')
      .insert([
        {
          team_id: teamId,
          riot_id: player.riot_id,
          role,
          profile_id: auth.user.id,
          player_id: player.id,
          status: 'pending',
        },
      ])
      .select()
  );

  if (error) {
    console.error('[team-join-requests POST]', error);
    return fail("Erreur lors de l'envoi de la candidature.", 500);
  }

  return NextResponse.json({ success: true, data });
}

/* =========================================================
   ACCEPTER / REFUSER (capitaine de l'équipe ou admin)
========================================================= */

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const requestId = Number(body.request_id);
  const action = body.action;

  if (!Number.isInteger(requestId) || requestId <= 0) return fail('request_id manquant', 400);
  if (action !== 'accept' && action !== 'reject') return fail('Action inconnue.', 400);

  const { data: joinRequest } = await onRequests((db) =>
    db.from('team_join_requests').select('*').eq('id', requestId).maybeSingle()
  );

  if (!joinRequest) return fail('Demande introuvable.', 404);
  if (joinRequest.status !== 'pending') return fail('Cette demande a déjà été traitée.', 409);

  const { allowed } = await loadManageableTeam(Number(joinRequest.team_id), auth.user, auth.isAdmin);
  if (!allowed) return fail("Seul le capitaine de l'équipe ou un admin peut répondre.", 403);

  if (action === 'reject') {
    const { error } = await onRequests((db) =>
      db.from('team_join_requests').update({ status: 'rejected' }).eq('id', requestId)
    );

    if (error) {
      console.error('[team-join-requests PATCH reject]', error);
      return fail('Erreur lors du refus.', 500);
    }

    return NextResponse.json({ success: true, message: 'Demande refusée.' });
  }

  if (!joinRequest.player_id) return fail('Cette demande ne possède pas de player_id.', 400);

  // Riot ID actuel du joueur, même s'il a changé depuis sa demande.
  const { data: currentPlayer } = await supabaseAdmin
    .from('players')
    .select('id, riot_id')
    .eq('id', joinRequest.player_id)
    .maybeSingle();

  if (!currentPlayer) return fail('Profil joueur introuvable.', 404);
  if (await hasTeam(currentPlayer)) return fail('Ce joueur est déjà dans une équipe.', 409);

  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('team_id', joinRequest.team_id);

  if ((members || []).some((m) => m.role === joinRequest.role)) {
    return fail(`Le poste ${joinRequest.role} est déjà occupé.`, 409);
  }
  if ((members || []).length >= TEAM_SIZE) return fail("L'équipe est déjà complète.", 409);

  const { error: insertError } = await supabaseAdmin.from('team_members').insert([
    {
      team_id: joinRequest.team_id,
      player_id: joinRequest.player_id,
      riot_id: currentPlayer.riot_id,
      role: joinRequest.role,
    },
  ]);

  if (insertError) {
    console.error('[team-join-requests PATCH accept]', insertError);
    return fail("Erreur lors de l'ajout du joueur.", 500);
  }

  const { error: acceptError } = await onRequests((db) =>
    db.from('team_join_requests').update({ status: 'accepted', riot_id: currentPlayer.riot_id }).eq('id', requestId)
  );
  if (acceptError) console.error('[team-join-requests PATCH accept]', acceptError);

  // Ses autres candidatures n'ont plus lieu d'être.
  await onRequests((db) =>
    db.from('team_join_requests').delete().eq('player_id', joinRequest.player_id).neq('id', requestId)
  );

  invalidateResults();

  return NextResponse.json({ success: true, message: 'Joueur accepté.' });
}
