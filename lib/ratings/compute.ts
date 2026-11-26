// Calcul de la note des joueurs (IPI) pour une saison et enregistrement dans czf_player_rating.
// Serveur uniquement. Quand le lancer (bouton, cron…) reste à décider : voir /api/admin/ratings.
import { groupBy, type Role } from '@/lib/results/core';
import { loadResultsDataset } from '@/lib/results/load';
import { buildGamePlayers, loadTeamNames } from '@/lib/ext/games';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { IPI_MIN_PARTICIPATION, calculateIpi, ipiToNote, type IpiRole, type IpiStat } from './ipi';

type Line = {
  playerId: number;
  teamId: number;
  division: string;
  role: Role | null;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  gold: number;
  cs: number;
  vision: number;
  teamKills: number;
  seconds: number;
  playedAt: string;
};

export type PlayerRating = {
  playerId: number;
  riotId: string | null;
  division: string;
  role: IpiRole;
  games: number;
  teamGames: number;
  stats: Partial<Record<IpiStat, number | null>>;
  scores: Record<string, number> | null;
  ipi: number | null;
  note: number | null;
  // Pourquoi pas de note : participation trop faible ou stat manquante.
  reason: string | null;
};

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

// Calcule l'IPI de chaque joueur officiel de la saison (mêmes formules que /api/ext/joueurs).
export async function computeRatings(seasonId: number): Promise<PlayerRating[]> {
  const [dataset, teamNames] = await Promise.all([loadResultsDataset(), loadTeamNames()]);
  const matchMap = new Map(dataset.matches.map((match) => [Number(match.id), match]));
  const statsByGame = groupBy(dataset.stats, (stat) => Number(stat.game_id));
  const playerNames = new Map(dataset.playerNames);

  const lines: Line[] = [];
  // Parties jouées par équipe et par division (pour la participation).
  const teamGames = new Map<string, number>();

  for (const game of dataset.games) {
    const match = matchMap.get(Number(game.match_id));
    if (!match || Number(match.season_id) !== seasonId) continue;
    const { players, teamKills } = buildGamePlayers(game, statsByGame.get(Number(game.id)) || [], playerNames, teamNames);
    if (!players.length) continue;

    for (const teamId of new Set(players.map((p) => p.id_team))) {
      const key = `${match.division}:${teamId}`;
      teamGames.set(key, (teamGames.get(key) ?? 0) + 1);
    }

    for (const p of players) {
      if (p.isSub || !p.id_player) continue;
      lines.push({
        playerId: p.id_player,
        teamId: p.id_team,
        division: match.division,
        role: p.role as Role | null,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        damage: p.damage ?? 0,
        gold: p.gold ?? 0,
        cs: p.cs ?? 0,
        vision: p.visionScore ?? 0,
        teamKills: teamKills.get(p.id_team) ?? 0,
        seconds: Number(game.duration_seconds) || 0,
        playedAt: String(match.played_at ?? ''),
      });
    }
  }

  const ratings: PlayerRating[] = [];
  for (const [playerId, rows] of groupBy(lines, (line) => line.playerId)) {
    // Équipe et division de la game la plus récente ; rôle le plus joué.
    const last = rows.reduce((a, b) => (b.playedAt > a.playedAt ? b : a));
    const roleCount = new Map<string, number>();
    for (const row of rows) if (row.role) roleCount.set(row.role, (roleCount.get(row.role) ?? 0) + 1);
    const role = [...roleCount].sort((a, b) => b[1] - a[1])[0]?.[0] as IpiRole | undefined;
    if (!role) continue;

    const sum = (pick: (row: Line) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const minutes = sum((row) => row.seconds) / 60;
    const perMin = (value: number) => (minutes > 0 ? value / minutes : null);
    // Vision à 0 = non saisie : seulement les games où elle est renseignée.
    const visionRows = rows.filter((row) => row.vision > 0);
    const visionMinutes = visionRows.reduce((total, row) => total + row.seconds, 0) / 60;
    const teamKillsTotal = sum((row) => row.teamKills);

    const stats: Partial<Record<IpiStat, number | null>> = {
      KDA: round(sum((row) => (row.kills + row.assists) / Math.max(1, row.deaths)) / rows.length),
      GPM: perMin(sum((row) => row.gold)),
      DPM: perMin(sum((row) => row.damage)),
      'CS/min': perMin(sum((row) => row.cs)),
      'KP %': teamKillsTotal > 0 ? (100 * sum((row) => row.kills + row.assists)) / teamKillsTotal : null,
      'Score de vision/min': visionMinutes > 0 ? visionRows.reduce((t, row) => t + row.vision, 0) / visionMinutes : null,
    };
    for (const key of Object.keys(stats) as IpiStat[]) if (stats[key] != null) stats[key] = round(stats[key] as number);

    const games = rows.filter((row) => row.teamId === last.teamId && row.division === last.division).length;
    const total = teamGames.get(`${last.division}:${last.teamId}`) ?? 0;
    const eligible = total > 0 && games >= total * IPI_MIN_PARTICIPATION;
    const result = eligible ? calculateIpi(role, last.division, stats) : null;

    ratings.push({
      playerId,
      riotId: playerNames.get(playerId) ?? null,
      division: last.division,
      role,
      games,
      teamGames: total,
      stats,
      scores: result?.scores ?? null,
      ipi: result ? round(result.ipi, 1) : null,
      note: result ? ipiToNote(result.ipi) : null,
      reason: !eligible ? `Participation ${games}/${total} (< 45 %)` : !result ? 'Stat manquante' : null,
    });
  }

  return ratings.sort((a, b) => (b.ipi ?? -1) - (a.ipi ?? -1));
}

// Recalcule et enregistre les notes de la saison. Les joueurs sans note calculable gardent leur note actuelle.
export async function updateRatings(seasonId: number): Promise<{ updated: number; skipped: PlayerRating[]; ratings: PlayerRating[] }> {
  const ratings = await computeRatings(seasonId);
  const now = new Date().toISOString();
  const score = (r: PlayerRating, stat: IpiStat) => (r.scores?.[stat] == null ? null : round(r.scores[stat]));
  const rows = ratings
    .filter((r) => r.note !== null)
    .map((r) => ({
      season_id: seasonId,
      player_id: r.playerId,
      note: r.note as number,
      // Détail (SQL czf-import/joueur-note-2-detail-ipi.sql) : IPI brut et note de chaque stat sur 100.
      ipi: r.ipi,
      score_kda: score(r, 'KDA'),
      score_gpm: score(r, 'GPM'),
      score_dpm: score(r, 'DPM'),
      score_cs: score(r, 'CS/min'),
      score_kp: score(r, 'KP %'),
      score_vision: score(r, 'Score de vision/min'),
      computed_at: now,
    }));

  if (rows.length) {
    const { error } = await supabaseAdmin.from('czf_player_rating').upsert(rows, { onConflict: 'season_id,player_id' });
    if (error) throw new Error('Impossible d’enregistrer les notes (table czf_player_rating ?).');
  }
  return { updated: rows.length, skipped: ratings.filter((r) => r.note === null), ratings };
}
