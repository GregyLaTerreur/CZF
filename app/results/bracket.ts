// Arbre double élimination (top 8) calculé à partir du classement et des matchs de playoffs saisis.
// Un match de l'arbre est retrouvé par la paire d'équipes : le champ « round » saisi à la main n'est pas fiable.

import type { HistoryMatch, Team } from './shared';

export const QUALIFIED = 8;

export type BracketTeam = {
  id: number;
  shortName: string;
  name: string;
  logo: string | null;
};

export type BracketSlot = {
  team: BracketTeam | null;
  seed: number | null;
  // Texte affiché tant que l'équipe n'est pas connue.
  placeholder: string;
  score: number | null;
  won: boolean;
};

export type BracketNode = {
  id: string;
  top: BracketSlot;
  bottom: BracketSlot;
  winner: BracketTeam | null;
  loser: BracketTeam | null;
  played: boolean;
};

export type BracketRoundData = { title: string; matches: BracketNode[] };

export type BracketTree = {
  winner: BracketRoundData[];
  loser: BracketRoundData[];
};

type Source = { kind: 'seed'; rank: number } | { kind: 'winner' | 'loser'; match: string };

type Spec = {
  id: string;
  bracket: 'winner' | 'loser' | 'grand_final';
  label: string;
  top: Source;
  bottom: Source;
};

const seed = (rank: number): Source => ({ kind: 'seed', rank });
const win = (match: string): Source => ({ kind: 'winner', match });
const lose = (match: string): Source => ({ kind: 'loser', match });

// Ordre de résolution : chaque match ne dépend que de matchs listés avant lui.
// Loser round 2 croisé (perdant demi 2 contre le haut du tableau) pour éviter les revanches immédiates.
const SPECS: Spec[] = [
  { id: 'QF1', bracket: 'winner', label: 'quart 1', top: seed(1), bottom: seed(8) },
  { id: 'QF2', bracket: 'winner', label: 'quart 2', top: seed(4), bottom: seed(5) },
  { id: 'QF3', bracket: 'winner', label: 'quart 3', top: seed(2), bottom: seed(7) },
  { id: 'QF4', bracket: 'winner', label: 'quart 4', top: seed(3), bottom: seed(6) },
  { id: 'SF1', bracket: 'winner', label: 'demi 1', top: win('QF1'), bottom: win('QF2') },
  { id: 'SF2', bracket: 'winner', label: 'demi 2', top: win('QF3'), bottom: win('QF4') },
  { id: 'WF', bracket: 'winner', label: 'finale WB', top: win('SF1'), bottom: win('SF2') },
  { id: 'LR1A', bracket: 'loser', label: 'LB R1', top: lose('QF1'), bottom: lose('QF2') },
  { id: 'LR1B', bracket: 'loser', label: 'LB R1', top: lose('QF3'), bottom: lose('QF4') },
  { id: 'LR2A', bracket: 'loser', label: 'LB R2', top: win('LR1A'), bottom: lose('SF2') },
  { id: 'LR2B', bracket: 'loser', label: 'LB R2', top: win('LR1B'), bottom: lose('SF1') },
  { id: 'LR3', bracket: 'loser', label: 'LB R3', top: win('LR2A'), bottom: win('LR2B') },
  { id: 'LF', bracket: 'loser', label: 'finale LB', top: win('LR3'), bottom: lose('WF') },
  { id: 'GF', bracket: 'grand_final', label: 'grande finale', top: win('WF'), bottom: win('LF') },
];

const LABELS = new Map(SPECS.map((spec) => [spec.id, spec.label]));

function placeholderOf(source: Source) {
  if (source.kind === 'seed') return 'À définir';
  return `${source.kind === 'winner' ? 'Vainq.' : 'Perd.'} ${LABELS.get(source.match)}`;
}

function toBracketTeam(team: Team): BracketTeam {
  return { id: team.id, shortName: team.shortName, name: team.name, logo: team.logo };
}

export function buildBracket(teams: Team[], history: HistoryMatch[]): BracketTree {
  const seeds = teams.slice(0, QUALIFIED);
  const seedById = new Map(seeds.map((team, index) => [team.id, index + 1]));

  // Les plus anciens d'abord : une paire jouée deux fois (finale WB puis grande finale) se répartit dans l'ordre.
  const playoffs = history
    .filter((match) => match.stage === 'playoff' && match.team1 && match.team2 && match.winner)
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

  const used = new Set<number>();
  const nodes = new Map<string, BracketNode>();

  const resolve = (source: Source) => {
    if (source.kind === 'seed') {
      const team = seeds[source.rank - 1];
      return { team: team ? toBracketTeam(team) : null, seed: source.rank };
    }

    const node = nodes.get(source.match);
    const team = (source.kind === 'winner' ? node?.winner : node?.loser) ?? null;

    return { team, seed: team ? seedById.get(team.id) ?? null : null };
  };

  for (const spec of SPECS) {
    const top = resolve(spec.top);
    const bottom = resolve(spec.bottom);
    const node: BracketNode = {
      id: spec.id,
      top: { ...top, placeholder: placeholderOf(spec.top), score: null, won: false },
      bottom: { ...bottom, placeholder: placeholderOf(spec.bottom), score: null, won: false },
      winner: null,
      loser: null,
      played: false,
    };

    if (top.team && bottom.team) {
      const ids = [top.team.id, bottom.team.id];
      const candidates = playoffs.filter(
        (match) => !used.has(match.id) && ids.includes(match.team1!.id) && ids.includes(match.team2!.id)
      );
      const match = candidates.find((item) => item.bracket === spec.bracket) ?? candidates[0];

      if (match) {
        used.add(match.id);

        const scoreOf = (teamId: number) =>
          match.team1!.id === teamId ? match.team1!.score : match.team2!.score;

        node.played = true;
        node.top.score = scoreOf(top.team.id);
        node.bottom.score = scoreOf(bottom.team.id);
        node.top.won = match.winner!.id === top.team.id;
        node.bottom.won = !node.top.won;
        node.winner = node.top.won ? top.team : bottom.team;
        node.loser = node.top.won ? bottom.team : top.team;
      }
    }

    nodes.set(spec.id, node);
  }

  const pick = (...ids: string[]) => ids.map((id) => nodes.get(id)!);

  return {
    winner: [
      { title: 'Quarts', matches: pick('QF1', 'QF2', 'QF3', 'QF4') },
      { title: 'Demi-finales', matches: pick('SF1', 'SF2') },
      { title: 'Finale winner', matches: pick('WF') },
      { title: 'Grande finale', matches: pick('GF') },
    ],
    loser: [
      { title: 'Round 1', matches: pick('LR1A', 'LR1B') },
      { title: 'Round 2', matches: pick('LR2A', 'LR2B') },
      { title: 'Round 3', matches: pick('LR3') },
      { title: 'Finale loser', matches: pick('LF') },
    ],
  };
}
