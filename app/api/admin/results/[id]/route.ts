import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateResults } from '@/lib/results/cache';
import { requireAdmin } from '@/lib/auth';
import { getChampions } from '@/lib/results/core';
import { GAME_COLUMNS, MATCH_COLUMNS, STAT_COLUMNS, loadPlayerNames } from '@/lib/results/load';

export const dynamic = 'force-dynamic';

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function isAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return false;

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !auth.user) return false;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', auth.user.id)
    .maybeSingle();

  return profile?.is_admin === true;
}

// Supprime un BO saisi à la main : stats des games, games, propositions MVP
// puis le match. La rencontre planifiée liée est gardée et repasse « à jouer ».
// Pas de cascade en base : on supprime dans l'ordre des clés étrangères.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(request))) {
    return reply({ success: false, error: 'Accès administrateur refusé.' }, 401);
  }

  const matchId = Number((await params).id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return reply({ success: false, error: 'Match invalide.' }, 400);
  }

  try {
    const { data: match, error: matchError } = await supabaseAdmin
      .from('czf_matches')
      .select('id')
      .eq('id', matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return reply({ success: false, error: 'Match introuvable.' }, 404);

    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from('czf_fixtures')
      .select('id')
      .eq('match_id', matchId);

    if (fixturesError) throw fixturesError;

    const fixtureIds = (fixtures || []).map((fixture) => fixture.id);

    // Un BO publié depuis Riot se gère depuis /admin/riot, pas ici.
    if (fixtureIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('czf_tournament_game_slots')
        .select('id', { count: 'exact', head: true })
        .in('fixture_id', fixtureIds)
        .not('riot_match_id', 'is', null);

      if (error) throw error;

      if (count) {
        return reply(
          { success: false, error: 'Ce BO vient du système Riot : il ne peut pas être supprimé ici.' },
          409
        );
      }
    }

    const { data: games, error: gamesError } = await supabaseAdmin
      .from('czf_games')
      .select('id')
      .eq('match_id', matchId);

    if (gamesError) throw gamesError;

    const gameIds = (games || []).map((game) => game.id);

    // Pas de transaction : les propositions MVP passent en premier, car c'est la
    // table où un droit DELETE manquant a déjà bloqué la prod à mi-chemin.
    const steps = [
      () => supabaseAdmin.from('czf_mvp_proposals').delete().eq('match_id', matchId),
      () =>
        gameIds.length > 0
          ? supabaseAdmin.from('czf_game_player_stats').delete().in('game_id', gameIds)
          : Promise.resolve({ error: null }),
      () =>
        supabaseAdmin
          .from('czf_fixtures')
          .update({ match_id: null, status: 'pending' })
          .eq('match_id', matchId),
      () => supabaseAdmin.from('czf_games').delete().eq('match_id', matchId),
      () => supabaseAdmin.from('czf_matches').delete().eq('id', matchId),
    ];

    for (const step of steps) {
      const { error } = await step();
      if (error) throw error;
    }

    invalidateResults();

    return reply({ success: true, deleted: { matchId, games: gameIds.length } });
  } catch (error: any) {
    console.error('[CZF ADMIN RESULTS DELETE]', error);
    return reply({ success: false, error: error?.message || 'Suppression impossible.' }, 500);
  }
}

async function readMatchId(params: Promise<{ id: string }>) {
  const matchId = Number((await params).id);
  return Number.isInteger(matchId) && matchId > 0 ? matchId : null;
}

// Charge un BO tel qu'il est en base (match, games, lignes de stats) pour l'édition à la main.
async function loadMatchForEdit(matchId: number) {
  const { data: match, error: matchError } = await supabaseAdmin
    .from('czf_matches')
    .select(MATCH_COLUMNS)
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) throw matchError;
  if (!match) return null;

  const { data: games, error: gamesError } = await supabaseAdmin
    .from('czf_games')
    .select(GAME_COLUMNS)
    .eq('match_id', matchId)
    .order('game_number', { ascending: true });

  if (gamesError) throw gamesError;

  const gameIds = (games || []).map((game) => Number(game.id));

  const { data: stats, error: statsError } = gameIds.length
    ? await supabaseAdmin
        .from('czf_game_player_stats')
        .select(STAT_COLUMNS)
        .in('game_id', gameIds)
        .order('id', { ascending: true })
    : { data: [], error: null };

  if (statsError) throw statsError;

  return { match, games: games || [], stats: stats || [] };
}

const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const matchId = await readMatchId(params);
  if (!matchId) return reply({ success: false, error: 'Match invalide.' }, 400);

  try {
    const [loaded, champions] = await Promise.all([loadMatchForEdit(matchId), getChampions()]);

    if (!loaded) return reply({ success: false, error: 'Match introuvable.' }, 404);

    const { match, games, stats } = loaded;

    const [{ data: teams, error: teamsError }, names] = await Promise.all([
      supabaseAdmin.from('teams').select('id, name, tag').in('id', [match.team1_id, match.team2_id]),
      loadPlayerNames(stats.map((stat) => Number(stat.player_id))),
    ]);

    if (teamsError) throw teamsError;

    const team = (id: number) => {
      const found = (teams || []).find((item) => Number(item.id) === Number(id));
      return { id: Number(id), name: found?.name ?? `Équipe ${id}`, tag: found?.tag ?? null };
    };

    return reply({
      success: true,
      match: {
        id: Number(match.id),
        division: match.division,
        stage: match.stage,
        bestOf: Number(match.best_of),
        playedAt: match.played_at,
        mvpPlayerId: match.mvp_player_id === null ? null : Number(match.mvp_player_id),
        team1: team(match.team1_id),
        team2: team(match.team2_id),
        games: games.map((game) => ({
          id: Number(game.id),
          gameNumber: Number(game.game_number),
          durationSeconds: Number(game.duration_seconds) || 0,
          winnerTeamId: Number(game.winner_team_id),
          substitutes: Array.isArray(game.substitute_stats) ? game.substitute_stats : [],
          players: stats
            .filter((stat) => Number(stat.game_id) === Number(game.id))
            .sort(
              (a, b) =>
                Number(a.team_id) - Number(b.team_id) ||
                ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
            )
            .map((stat) => ({
              statId: Number(stat.id),
              playerId: Number(stat.player_id),
              name: names.get(Number(stat.player_id)) ?? `Joueur ${stat.player_id}`,
              teamId: Number(stat.team_id),
              role: stat.role,
              championId: stat.champion_id,
              kills: Number(stat.kills) || 0,
              deaths: Number(stat.deaths) || 0,
              assists: Number(stat.assists) || 0,
              cs: Number(stat.cs) || 0,
              gold: Number(stat.gold) || 0,
              damage: Number(stat.damage) || 0,
              visionScore: Number(stat.vision_score) || 0,
            })),
        })),
      },
      champions: champions.map((champion) => ({ id: champion.id, name: champion.name })),
    });
  } catch (error: any) {
    console.error('[CZF ADMIN RESULTS GET]', error);
    return reply({ success: false, error: error?.message || 'Chargement impossible.' }, 500);
  }
}

type StatEdit = {
  statId: number;
  championId: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  visionScore: number;
};

type SubEdit = { teamId: number; role: string; championId: string; kills: number; deaths: number; assists: number };

type GameEdit = {
  id: number;
  durationSeconds: number;
  winnerTeamId: number;
  players: StatEdit[];
  substitutes?: SubEdit[];
};

type MatchEdit = {
  playedAt?: string;
  mvpPlayerId: number | null;
  games: GameEdit[];
};

function count(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

// Correction à la main d'un BO déjà enregistré : vainqueur et durée des games,
// lignes de stats, subs, MVP et date. Les équipes, joueurs, rôles et le nombre
// de games ne changent pas (pour ça : supprimer puis ressaisir le BO).
// Le score et le vainqueur du BO sont recalculés depuis les games.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const matchId = await readMatchId(params);
  if (!matchId) return reply({ success: false, error: 'Match invalide.' }, 400);

  let body: MatchEdit;

  try {
    body = await request.json();
  } catch {
    return reply({ success: false, error: 'Requête invalide.' }, 400);
  }

  try {
    const loaded = await loadMatchForEdit(matchId);
    if (!loaded) return reply({ success: false, error: 'Match introuvable.' }, 404);

    const { match, games, stats } = loaded;
    const team1Id = Number(match.team1_id);
    const team2Id = Number(match.team2_id);
    const edits = Array.isArray(body.games) ? body.games : [];

    if (edits.length !== games.length) {
      throw new Error('Le nombre de games ne peut pas changer ici.');
    }

    const gameUpdates: { id: number; values: Record<string, unknown> }[] = [];
    const statUpdates: { id: number; values: Record<string, unknown> }[] = [];
    const matchPlayerIds = new Set<number>();
    let winsTeam1 = 0;
    let winsTeam2 = 0;

    for (const game of games) {
      const edit = edits.find((item) => Number(item?.id) === Number(game.id));
      const label = `Game ${game.game_number}`;

      if (!edit) throw new Error(`${label} manquante.`);

      const winner = Number(edit.winnerTeamId);
      if (winner !== team1Id && winner !== team2Id) throw new Error(`Vainqueur invalide pour la ${label}.`);
      if (winner === team1Id) winsTeam1 += 1;
      else winsTeam2 += 1;

      const duration = count(edit.durationSeconds);
      if (!duration) throw new Error(`Durée invalide pour la ${label}.`);

      const gameStats = stats.filter((stat) => Number(stat.game_id) === Number(game.id));
      const players = Array.isArray(edit.players) ? edit.players : [];

      if (players.length !== gameStats.length) {
        throw new Error(`Les joueurs de la ${label} ne peuvent pas changer ici.`);
      }

      for (const stat of gameStats) {
        const line = players.find((item) => Number(item?.statId) === Number(stat.id));
        if (!line) throw new Error(`Une ligne de stats manque dans la ${label}.`);

        const championId = String(line.championId || '').trim();
        if (!championId) throw new Error(`Champion manquant dans la ${label}.`);

        const values = {
          champion_id: championId,
          kills: count(line.kills),
          deaths: count(line.deaths),
          assists: count(line.assists),
          cs: count(line.cs),
          gold: count(line.gold),
          damage: count(line.damage),
          vision_score: count(line.visionScore),
        };

        if (Object.values(values).some((value) => value === null)) {
          throw new Error(`Stat invalide dans la ${label} (nombres entiers positifs uniquement).`);
        }

        matchPlayerIds.add(Number(stat.player_id));
        statUpdates.push({ id: Number(stat.id), values });
      }

      const previousSubs = Array.isArray(game.substitute_stats) ? game.substitute_stats : [];
      const subs = Array.isArray(edit.substitutes) ? edit.substitutes : [];

      if (subs.length !== previousSubs.length) {
        throw new Error(`Les subs de la ${label} ne peuvent pas changer ici.`);
      }

      const substituteStats = subs.map((sub, index) => {
        const kills = count(sub.kills);
        const deaths = count(sub.deaths);
        const assists = count(sub.assists);
        const championId = String(sub.championId || '').trim();

        if (kills === null || deaths === null || assists === null || !championId) {
          throw new Error(`Sub invalide dans la ${label}.`);
        }

        // Équipe et rôle du sub repris de la base.
        return { ...previousSubs[index], championId, kills, deaths, assists };
      });

      gameUpdates.push({
        id: Number(game.id),
        values: { winner_team_id: winner, duration_seconds: duration, substitute_stats: substituteStats },
      });
    }

    let winnerTeamId: number | null = winsTeam1 > winsTeam2 ? team1Id : winsTeam2 > winsTeam1 ? team2Id : null;

    if (match.stage === 'playoff') {
      if (winnerTeamId === null) {
        throw new Error('Un match de playoffs ne peut pas terminer sur une égalité.');
      }

      const requiredWins = Math.floor(Number(match.best_of) / 2) + 1;

      if (Math.max(winsTeam1, winsTeam2) !== requiredWins) {
        throw new Error(
          `Le vainqueur doit avoir ${requiredWins} victoire(s) pour terminer ce BO${match.best_of}.`
        );
      }
    }

    const mvpPlayerId = body.mvpPlayerId === null || body.mvpPlayerId === undefined ? null : Number(body.mvpPlayerId);

    if (mvpPlayerId !== null && !matchPlayerIds.has(mvpPlayerId)) {
      throw new Error("Le MVP doit être un joueur officiel du match.");
    }

    let playedAt = match.played_at;

    if (body.playedAt) {
      const date = new Date(body.playedAt);
      if (Number.isNaN(date.getTime())) throw new Error('Date invalide.');
      playedAt = date.toISOString();
    }

    // Pas de transaction : tout est validé avant la première écriture.
    for (const update of gameUpdates) {
      const { error } = await supabaseAdmin.from('czf_games').update(update.values).eq('id', update.id);
      if (error) throw error;
    }

    for (const update of statUpdates) {
      const { error } = await supabaseAdmin
        .from('czf_game_player_stats')
        .update(update.values)
        .eq('id', update.id);
      if (error) throw error;
    }

    const { error: matchError } = await supabaseAdmin
      .from('czf_matches')
      .update({ winner_team_id: winnerTeamId, mvp_player_id: mvpPlayerId, played_at: playedAt })
      .eq('id', matchId);

    if (matchError) throw matchError;

    invalidateResults();

    return reply({
      success: true,
      matchId,
      score: { team1: winsTeam1, team2: winsTeam2 },
      winnerTeamId,
    });
  } catch (error: any) {
    console.error('[CZF ADMIN RESULTS PATCH]', error);
    return reply({ success: false, error: error?.message || 'Modification impossible.' }, 400);
  }
}
