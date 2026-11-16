// Prochains matchs de l'arbre (phase finale) qui ont une date, toutes divisions.
// Sert au bandeau défilant sous le menu et au haut de l'accueil.

import { buildBracket, type BracketSlot } from '@/app/results/bracket';
import {
  type AnyObject,
  type Division,
  DIVISIONS,
  buildMatchSummary,
  computeStandings,
  groupBy,
} from './core';
import { type ResultsDataset, toTeamMap } from './load';

// Un match reste « à venir » pendant 4 h après son heure de début, tant que son score n'est pas saisi.
const STILL_PLAYING_MS = 4 * 60 * 60 * 1000;

export type UpcomingSide = {
  name: string | null;
  shortName: string | null;
  logo: string | null;
  placeholder: string;
};

export type UpcomingMatch = {
  division: Division;
  key: string;
  name: string;
  format: string;
  scheduledAt: string;
  streamUrl: string | null;
  top: UpcomingSide;
  bottom: UpcomingSide;
};

// Classement et historique d'une division, comme /api/resultats.
export function divisionResults(dataset: ResultsDataset, division: Division) {
  const { matches: allMatches, teams, games } = dataset;
  const matches = allMatches.filter((match: AnyObject) => match.division === division);
  const teamMap = toTeamMap(teams);
  const playerNames = new Map(dataset.playerNames);
  const gamesByMatch = groupBy(games, (game) => Number(game.match_id));

  return {
    // Classement calculé comme /api/classement : poules, toutes divisions.
    teams: computeStandings(
      teams.map((team) => ({ ...team, wins: 0, losses: 0, gameDiff: 0, points: 0 })),
      allMatches,
      gamesByMatch
    ).filter((team) => team.division === division),
    history: matches.map((match: AnyObject) =>
      buildMatchSummary(match, teamMap, gamesByMatch.get(Number(match.id)) || [], playerNames)
    ),
  };
}

function toSide(slot: BracketSlot): UpcomingSide {
  return {
    name: slot.team?.name ?? null,
    shortName: slot.team?.shortName ?? null,
    logo: slot.team?.logo ?? null,
    placeholder: slot.placeholder,
  };
}

export function upcomingMatches(dataset: ResultsDataset, now = Date.now()): UpcomingMatch[] {
  const upcoming: UpcomingMatch[] = [];

  for (const division of DIVISIONS) {
    const schedule = dataset.schedule
      .filter((row) => row.division === division)
      .map((row) => ({ key: row.match_key, scheduledAt: row.scheduled_at ?? null, streamUrl: row.stream_url ?? null }));

    if (!schedule.some((entry) => entry.scheduledAt)) continue;

    const { teams, history } = divisionResults(dataset, division);
    const tree = buildBracket(teams as any, history as any, schedule);

    for (const round of [...tree.winner, ...tree.loser]) {
      for (const node of round.matches) {
        if (node.played || !node.scheduledAt) continue;
        if (new Date(node.scheduledAt).getTime() < now - STILL_PLAYING_MS) continue;

        upcoming.push({
          division,
          key: node.id,
          name: node.name,
          format: node.format,
          scheduledAt: node.scheduledAt,
          streamUrl: node.streamUrl,
          top: toSide(node.top),
          bottom: toSide(node.bottom),
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
