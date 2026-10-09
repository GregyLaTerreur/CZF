
import type { CzFGame } from './build-czf-game';

export type CzFBoResult = {
  bestOf: 2 | 3 | 5;
  completed: boolean;
  team1Score: number;
  team2Score: number;
  winnerTeamId: number | null;
  gamesPlayed: number;
  nextGameNumber: number | null;
};

type BuildBoOptions = {
  bestOf: 2 | 3 | 5;
  team1Id: number;
  team2Id: number;
  games: CzFGame[];
};

export function buildCzfBo({
  bestOf,
  team1Id,
  team2Id,
  games,
}: BuildBoOptions): CzFBoResult {
  if (![2, 3, 5].includes(bestOf)) {
    throw new Error('Format BO invalide.');
  }

  if (
    !Number.isSafeInteger(team1Id) ||
    !Number.isSafeInteger(team2Id) ||
    team1Id <= 0 ||
    team2Id <= 0 ||
    team1Id === team2Id
  ) {
    throw new Error('Équipes invalides.');
  }

  if (!Array.isArray(games) || games.length > bestOf) {
    throw new Error('Nombre de games invalide.');
  }

  const sortedGames = [...games].sort(
    (a, b) => a.gameNumber - b.gameNumber
  );

  let team1Score = 0;
  let team2Score = 0;

  const victoriesRequired =
    bestOf === 2 ? 2 : Math.floor(bestOf / 2) + 1;

  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i];

    if (game.gameNumber !== i + 1) {
      throw new Error(
        'Les numéros de games doivent être consécutifs.'
      );
    }

    if (
      game.winnerTeamId !== team1Id &&
      game.winnerTeamId !== team2Id
    ) {
      throw new Error(
        `Vainqueur invalide pour la game ${game.gameNumber}.`
      );
    }

    // On interdit toute game supplémentaire après
    // qu'une équipe a remporté un BO3 ou BO5.
    if (
      bestOf !== 2 &&
      (team1Score >= victoriesRequired ||
        team2Score >= victoriesRequired)
    ) {
      throw new Error(
        'Une game a été jouée après la fin du BO.'
      );
    }

    if (game.winnerTeamId === team1Id) {
      team1Score++;
    } else {
      team2Score++;
    }
  }

  // BO2 : les deux games sont toujours obligatoires.
  const completed =
    bestOf === 2
      ? sortedGames.length === 2
      : team1Score >= victoriesRequired ||
        team2Score >= victoriesRequired;

  let winnerTeamId: number | null = null;

  if (completed) {
    if (team1Score > team2Score) {
      winnerTeamId = team1Id;
    } else if (team2Score > team1Score) {
      winnerTeamId = team2Id;
    }
  }

  return {
    bestOf,
    completed,
    team1Score,
    team2Score,
    winnerTeamId,
    gamesPlayed: sortedGames.length,
    nextGameNumber: completed
      ? null
      : sortedGames.length + 1,
  };
}
