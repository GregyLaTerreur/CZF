
/*
  CZF — Conversion Match-V5 vers statistiques CZF

  Ce fichier prépare les données d'une game.
  Il n'écrit rien dans Supabase.

  Les associations PUUID -> joueur CZF et
  côté bleu/rouge -> équipe CZF doivent avoir
  été vérifiées avant son utilisation.
*/

export type CzFRole =
  | 'Top'
  | 'Jungle'
  | 'Mid'
  | 'ADC'
  | 'Support';

export type CzFPlayerStat = {
  playerId: number;
  teamId: number;
  role: CzFRole;
  championId: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  visionScore: number;
};

export type CzFGame = {
  gameNumber: number;
  durationSeconds: number;
  winnerTeamId: number;
  players: CzFPlayerStat[];
  substitutes: [];
};

type RiotParticipant = {
  puuid?: string;
  teamId?: number;
  teamPosition?: string;
  individualPosition?: string;
  championName?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  goldEarned?: number;
  totalDamageDealtToChampions?: number;
  visionScore?: number;
  win?: boolean;
};

type RiotTeam = {
  teamId?: number;
  win?: boolean;
};

export type RiotMatchV5 = {
  metadata?: {
    matchId?: string;
  };
  info?: {
    gameDuration?: number;
    participants?: RiotParticipant[];
    teams?: RiotTeam[];
  };
};

export type GameConversionOptions = {
  riotMatchId: string;
  gameNumber: number;
  team1Id: number;
  team2Id: number;
  blueTeamId: number;
  redTeamId: number;
  playerIdsByPuuid: Map<string, number>;
};

const ROLE_ORDER: CzFRole[] = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
];

function positiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function stat(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`Stat Riot invalide : ${field}`);
  }

  return value;
}

function roleFromRiot(
  participant: RiotParticipant
): CzFRole {
  const position = String(
    participant.teamPosition ||
      participant.individualPosition ||
      ''
  ).toUpperCase();

  switch (position) {
    case 'TOP':
      return 'Top';

    case 'JUNGLE':
      return 'Jungle';

    case 'MIDDLE':
    case 'MID':
      return 'Mid';

    case 'BOTTOM':
    case 'BOT':
      return 'ADC';

    case 'UTILITY':
    case 'SUPPORT':
      return 'Support';

    default:
      throw new Error(
        `Rôle Riot non reconnu : ${position || 'vide'}`
      );
  }
}

export function buildCzfGameFromRiot(
  match: RiotMatchV5,
  options: GameConversionOptions
): CzFGame {
  const {
    riotMatchId,
    gameNumber,
    team1Id,
    team2Id,
    blueTeamId,
    redTeamId,
    playerIdsByPuuid,
  } = options;

  if (
    !positiveId(gameNumber) ||
    !positiveId(team1Id) ||
    !positiveId(team2Id) ||
    team1Id === team2Id
  ) {
    throw new Error('Paramètres de rencontre invalides.');
  }

  if (
    !(
      (blueTeamId === team1Id &&
        redTeamId === team2Id) ||
      (blueTeamId === team2Id &&
        redTeamId === team1Id)
    )
  ) {
    throw new Error(
      'Association des équipes bleu/rouge invalide.'
    );
  }

  if (match.metadata?.matchId !== riotMatchId) {
    throw new Error(
      'Identifiant Riot différent du match attendu.'
    );
  }

  const participants = match.info?.participants;
  const teams = match.info?.teams;

  if (
    !Array.isArray(participants) ||
    participants.length !== 10
  ) {
    throw new Error(
      'La game Riot ne contient pas 10 joueurs.'
    );
  }

  const duration = match.info?.gameDuration;

  if (
    typeof duration !== 'number' ||
    !positiveId(duration)
  ) {
    throw new Error('Durée de game invalide.');
  }

  const bluePlayers = participants.filter(
    (p) => p.teamId === 100
  );

  const redPlayers = participants.filter(
    (p) => p.teamId === 200
  );

  if (
    bluePlayers.length !== 5 ||
    redPlayers.length !== 5
  ) {
    throw new Error(
      'La game ne contient pas 5 joueurs par équipe.'
    );
  }

  const puuids = participants.map(
    (p) => String(p.puuid || '').trim()
  );

  if (
    puuids.some((puuid) => !puuid) ||
    new Set(puuids).size !== 10
  ) {
    throw new Error(
      'PUUID manquant ou présent en double.'
    );
  }

  if (!Array.isArray(teams) || teams.length !== 2) {
    throw new Error(
      'Résultats des équipes Riot incomplets.'
    );
  }

  const blueResult = teams.find(
    (team) => team.teamId === 100
  );

  const redResult = teams.find(
    (team) => team.teamId === 200
  );

  if (
    typeof blueResult?.win !== 'boolean' ||
    typeof redResult?.win !== 'boolean' ||
    blueResult.win === redResult.win
  ) {
    throw new Error(
      'Vainqueur Riot absent ou incohérent.'
    );
  }

  const winnerRiotTeamId = blueResult.win ? 100 : 200;

  for (const p of participants) {
    if (
      typeof p.win !== 'boolean' ||
      p.win !== (p.teamId === winnerRiotTeamId)
    ) {
      throw new Error(
        'Discordance entre les victoires Riot.'
      );
    }
  }

  const winnerTeamId =
    winnerRiotTeamId === 100
      ? blueTeamId
      : redTeamId;

  const usedPlayerIds = new Set<number>();

  const playerRows: CzFPlayerStat[] = participants.map(
    (participant) => {
      const puuid = String(participant.puuid || '');

      const playerId = playerIdsByPuuid.get(puuid);

      if (!playerId || !positiveId(playerId)) {
        throw new Error(
          'Un joueur Riot ne correspond pas au roster CZF.'
        );
      }

      if (usedPlayerIds.has(playerId)) {
        throw new Error(
          'Joueur CZF présent plusieurs fois.'
        );
      }

      usedPlayerIds.add(playerId);

      const teamId =
        participant.teamId === 100
          ? blueTeamId
          : redTeamId;

      const championId = String(
        participant.championName || ''
      ).trim();

      if (!championId) {
        throw new Error(
          'Champion manquant dans Match-V5.'
        );
      }

      return {
        playerId,
        teamId,
        role: roleFromRiot(participant),
        championId,
        kills: stat(participant.kills, 'kills'),
        deaths: stat(participant.deaths, 'deaths'),
        assists: stat(participant.assists, 'assists'),
        cs:
          stat(
            participant.totalMinionsKilled,
            'totalMinionsKilled'
          ) +
          stat(
            participant.neutralMinionsKilled,
            'neutralMinionsKilled'
          ),
        gold: stat(
          participant.goldEarned,
          'goldEarned'
        ),
        damage: stat(
          participant.totalDamageDealtToChampions,
          'totalDamageDealtToChampions'
        ),
        visionScore: stat(
          participant.visionScore,
          'visionScore'
        ),
      };
    }
  );

  // Chaque équipe doit avoir les cinq rôles.
  // Les compositions incohérentes passent en
  // vérification manuelle.
  for (const teamId of [team1Id, team2Id]) {
    const teamPlayers = playerRows.filter(
      (p) => p.teamId === teamId
    );

    const teamRoles = new Set(
      teamPlayers.map((p) => p.role)
    );

    if (
      teamPlayers.length !== 5 ||
      teamRoles.size !== 5 ||
      ROLE_ORDER.some((role) => !teamRoles.has(role))
    ) {
      throw new Error(
        `Rôles incomplets pour l'équipe ${teamId}.`
      );
    }
  }

  return {
    gameNumber,
    durationSeconds: duration,
    winnerTeamId,
    players: playerRows.sort((a, b) => {
      if (a.teamId !== b.teamId) {
        return a.teamId - b.teamId;
      }

      return (
        ROLE_ORDER.indexOf(a.role) -
        ROLE_ORDER.indexOf(b.role)
      );
    }),
    substitutes: [],
  };
}
