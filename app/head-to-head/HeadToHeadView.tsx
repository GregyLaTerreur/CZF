'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { logoSrc } from '@/lib/logo';
import ds from '@/app/components/ds/ds.module.css';
import {
  DIVISION_COLORS,
  type DivisionName,
} from '@/app/components/home/divisions';
import { TIERS, formatRank, roleInfo, splitRiotId } from '@/app/components/ds/lol';

import styles from './head-to-head.module.css';

const DIVISIONS: DivisionName[] = ['Yordle', 'Ixtal', 'Targon'];
const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] as const;

type Role = (typeof ROLES)[number];

type StandingTeam = {
  id: number;
  name: string;
  shortName?: string;
  logo?: string | null;
  division: DivisionName;
  wins: number;
  losses: number;
  gameDiff: number;
  points: number;
  rank?: number;
};

type MatchTeam = {
  id: number;
  name: string;
  shortName?: string;
  logo?: string | null;
  score: number;
};

type Match = {
  id: number;
  division: DivisionName;
  stage?: string;
  playedAt?: string | null;
  team1: MatchTeam;
  team2: MatchTeam;
  // Vainqueur de chaque game, dans l'ordre joué.
  gameWinners?: number[];
};

const FORM_GAMES = 7;

type Member = {
  id: number;
  team_id: number;
  player_id?: number | null;
  riot_id: string;
  role?: string | null;
};

type Player = {
  id: number;
  riot_id: string;
  main_role?: string | null;
  secondary_role?: string | null;
  czf_points?: number | null;
  soloq_tier?: string | null;
  soloq_rank?: string | null;
  soloq_lp?: number | null;
  soloq_wins?: number | null;
  soloq_losses?: number | null;
  flex_tier?: string | null;
  flex_rank?: string | null;
  flex_lp?: number | null;
  peak_tier?: string | null;
  peak_rank?: string | null;
  peak_lp?: number | null;
  top_champions?: {
    champion_id: number;
    champion_name: string;
    champion_level?: number;
    champion_points?: number;
  }[];
  [key: string]: any;
};

type PlayerStat = {
  playerId: number;
  riotId: string;
  teamId?: number;
  teamShortName?: string;
  teamLogo?: string | null;
  role: Role;
  division?: DivisionName;
  games?: number;
  wins?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  kda?: number;
  goldPerMin?: number;
  dpm?: number;
  csPerMin?: number;
  visionScore?: number;
  killParticipation?: number;
  goldShare?: number;
  damageShare?: number;
  mvp?: number;
  qualified?: boolean;
};

type TournamentChampion = {
  championId: string;
  name: string;
  image?: string | null;
  division: DivisionName;
  role: string;
  players: {
    playerId: number;
    games: number;
    [key: string]: any;
  }[];
};

type RosterItem = {
  member: Member;
  player: Player | null;
  playerId: number | null;
  riotId: string;
  role: string;
  points: number;
};

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatNumber(value: number | undefined, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(decimals);
}

function formatInteger(value: number | undefined) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return String(Math.round(number));
}

function getPlayerRank(player: Player | null) {
  return formatRank(player?.soloq_tier, player?.soloq_rank, player?.soloq_lp) ?? 'Non classé';
}

function PlayerRank({ player }: { player: Player | null }) {
  const icon = player?.soloq_tier ? TIERS[player.soloq_tier]?.icon : null;

  return (
    <small className={styles.playerRank}>
      {icon && <img src={icon} alt="" className={ds.rankIcon} />}
      {getPlayerRank(player)}
    </small>
  );
}

// Pseudo en gras, #TAG atténué, comme dans le design system.
function RiotName({ riotId }: { riotId: string }) {
  const { name, tag } = splitRiotId(riotId);

  return (
    <>
      {name}
      {tag && <span className={styles.riotTag}>#{tag}</span>}
    </>
  );
}

function roleLabel(role?: string | null) {
  return roleInfo(role)?.label ?? role ?? '';
}

export default function HeadToHeadView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<StandingTeam[]>([]);
  const [history, setHistory] = useState<Match[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [tournamentChampions, setTournamentChampions] = useState<TournamentChampion[]>([]);
  const [team1Id, setTeam1Id] = useState<number | null>(null);
  const [team2Id, setTeam2Id] = useState<number | null>(null);
  const [player1Id, setPlayer1Id] = useState<number | null>(null);
  const [player2Id, setPlayer2Id] = useState<number | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const resultRequests = DIVISIONS.map(async (division) => {
        const res = await fetch(
          `/api/resultats?division=${division}&view=resultats`,
          { cache: 'no-store' }
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || `Impossible de charger ${division}.`);
        }

        return json;
      });

      const statsRequests = DIVISIONS.map(async (division) => {
        const res = await fetch(
          `/api/resultats?division=${division}&view=stats`,
          { cache: 'no-store' }
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(
            json.error || `Impossible de charger les stats ${division}.`
          );
        }

        return json;
      });

      const [resultData, statsData, membersResponse, playersResponse] =
        await Promise.all([
          Promise.all(resultRequests),
          Promise.all(statsRequests),
          fetch('/api/team-members', { cache: 'no-store' }).then((res) => res.json()),
          fetch('/api/players', { cache: 'no-store' }).then((res) => res.json()),
        ]);

      setTeams(resultData.flatMap((data) => data.teams || []));
      setHistory(resultData.flatMap((data) => data.history || []));

      const allStats: PlayerStat[] = statsData.flatMap((data, divisionIndex) => {
        const division = DIVISIONS[divisionIndex];

        return Object.entries(data.playerStats || {}).flatMap(
          ([role, rolePlayers]) =>
            (rolePlayers as PlayerStat[]).map((stat) => ({
              ...stat,
              role: role as Role,
              division,
            }))
        );
      });

      setPlayerStats(allStats);

      const allChampions: TournamentChampion[] = statsData.flatMap(
        (data, divisionIndex) => {
          const division = DIVISIONS[divisionIndex];
          const championSource = data.championStats || data.champions || {};

          return Object.entries(championSource).flatMap(([role, champions]) =>
            (champions as any[]).map((champion) => ({
              championId: String(champion.championId),
              name: String(champion.name || champion.championId),
              image: champion.image || null,
              division,
              role,
              players: Array.isArray(champion.players) ? champion.players : [],
            }))
          );
        }
      );

      setTournamentChampions(allChampions);
      setMembers(
        membersResponse.data ||
          membersResponse.members ||
          membersResponse.team_members ||
          []
      );
      setPlayers(playersResponse.data || playersResponse.players || []);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger le Head to Head.');
    } finally {
      setLoading(false);
    }
  }

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [teams]
  );

  const team1 = useMemo(
    () => teams.find((team) => Number(team.id) === Number(team1Id)) || null,
    [teams, team1Id]
  );

  const team2 = useMemo(
    () => teams.find((team) => Number(team.id) === Number(team2Id)) || null,
    [teams, team2Id]
  );

  // 7 dernières games de l'équipe, de la plus ancienne à la plus récente.
  function formOf(teamId: number) {
    return history
      .filter(
        (match) =>
          match.team1 &&
          match.team2 &&
          (Number(match.team1.id) === Number(teamId) ||
            Number(match.team2.id) === Number(teamId))
      )
      .sort(
        (a, b) =>
          new Date(a.playedAt || 0).getTime() -
          new Date(b.playedAt || 0).getTime()
      )
      .flatMap((match) => match.gameWinners || [])
      .slice(-FORM_GAMES)
      .map((winnerId) => Number(winnerId) === Number(teamId));
  }

  useEffect(() => setPlayer1Id(null), [team1Id]);
  useEffect(() => setPlayer2Id(null), [team2Id]);

  function getPlayerForMember(member: Member) {
    if (member.player_id !== null && member.player_id !== undefined) {
      const byId = players.find(
        (player) => Number(player.id) === Number(member.player_id)
      );
      if (byId) return byId;
    }

    return (
      players.find(
        (player) => normalize(player.riot_id) === normalize(member.riot_id)
      ) || null
    );
  }

  function getRoster(teamId: number): RosterItem[] {
    return members
      .filter((member) => Number(member.team_id) === Number(teamId))
      .map((member) => {
        const player = getPlayerForMember(member);

        return {
          member,
          player,
          playerId: player?.id ?? member.player_id ?? null,
          riotId: player?.riot_id || member.riot_id,
          role: member.role || player?.main_role || '-',
          points: Number(player?.czf_points || 0),
        };
      })
      .sort(
        (a, b) =>
          ROLES.indexOf(a.role as Role) - ROLES.indexOf(b.role as Role)
      );
  }

  const roster1 = useMemo(
    () => (team1 ? getRoster(team1.id) : []),
    [team1, members, players]
  );

  const roster2 = useMemo(
    () => (team2 ? getRoster(team2.id) : []),
    [team2, members, players]
  );

  const selectedPlayer1 = useMemo(
    () =>
      roster1.find((item) => Number(item.playerId) === Number(player1Id)) ||
      null,
    [roster1, player1Id]
  );

  const selectedPlayer2 = useMemo(
    () =>
      roster2.find((item) => Number(item.playerId) === Number(player2Id)) ||
      null,
    [roster2, player2Id]
  );

  function findStat(playerId: number | null, role?: string) {
    if (!playerId) return null;

    const stats = playerStats.filter(
      (stat) => Number(stat.playerId) === Number(playerId)
    );

    if (!stats.length) return null;

    const currentRole = stats.find(
      (stat) => normalize(stat.role) === normalize(role)
    );

    if (currentRole) return currentRole;

    return [...stats].sort(
      (a, b) => Number(b.games || 0) - Number(a.games || 0)
    )[0];
  }

  const stat1 = useMemo(
    () => findStat(player1Id, selectedPlayer1?.role),
    [player1Id, selectedPlayer1, playerStats]
  );

  const stat2 = useMemo(
    () => findStat(player2Id, selectedPlayer2?.role),
    [player2Id, selectedPlayer2, playerStats]
  );

  function getStatRank(
    stat: PlayerStat | null,
    key:
      | 'kda'
      | 'goldPerMin'
      | 'dpm'
      | 'csPerMin'
      | 'visionScore'
      | 'killParticipation'
      | 'goldShare'
      | 'damageShare'
  ) {
    if (!stat || !stat.division) return null;

    const value = Number(stat[key]);
    if (!Number.isFinite(value) || value <= 0) return null;

    const ranking = playerStats
      .filter(
        (item) =>
          item.division === stat.division &&
          normalize(item.role) === normalize(stat.role) &&
          item.qualified !== false &&
          Number(item[key]) > 0
      )
      .sort((a, b) => Number(b[key]) - Number(a[key]));

    const index = ranking.findIndex(
      (item) => Number(item.playerId) === Number(stat.playerId)
    );

    return index >= 0 ? index + 1 : null;
  }

  function getTopTournamentChampions(
    playerId: number | null,
    division: DivisionName,
    role: string
  ) {
    if (!playerId) return [];

    return tournamentChampions
      .filter(
        (champion) =>
          champion.division === division &&
          normalize(champion.role) === normalize(role)
      )
      .map((champion) => {
        const player = champion.players.find(
          (item) => Number(item.playerId) === Number(playerId)
        );

        return {
          ...champion,
          games: Number(player?.games) || 0,
        };
      })
      .filter((champion) => champion.games > 0)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  }

  const topChampions1 = useMemo(
    () =>
      team1 && selectedPlayer1
        ? getTopTournamentChampions(
            selectedPlayer1.playerId,
            team1.division,
            selectedPlayer1.role
          )
        : [],
    [team1, selectedPlayer1, tournamentChampions]
  );

  const topChampions2 = useMemo(
    () =>
      team2 && selectedPlayer2
        ? getTopTournamentChampions(
            selectedPlayer2.playerId,
            team2.division,
            selectedPlayer2.role
          )
        : [],
    [team2, selectedPlayer2, tournamentChampions]
  );

  const directMatches = useMemo(() => {
    if (!team1 || !team2) return [];

    return history
      .filter((match) => {
        const ids = [Number(match.team1?.id), Number(match.team2?.id)];
        return ids.includes(Number(team1.id)) && ids.includes(Number(team2.id));
      })
      .sort((a, b) => {
        const aDate = a.playedAt ? new Date(a.playedAt).getTime() : 0;
        const bDate = b.playedAt ? new Date(b.playedAt).getTime() : 0;
        return bDate - aDate;
      });
  }, [history, team1, team2]);

  const directScore = useMemo(() => {
    if (!team1 || !team2) return { left: 0, right: 0 };

    let left = 0;
    let right = 0;

    for (const match of directMatches) {
      if (Number(match.team1.id) === Number(team1.id)) {
        left += Number(match.team1.score) || 0;
        right += Number(match.team2.score) || 0;
      } else {
        left += Number(match.team2.score) || 0;
        right += Number(match.team1.score) || 0;
      }
    }

    return { left, right };
  }, [directMatches, team1, team2]);

  const showVision =
    normalize(selectedPlayer1?.role) === 'support' ||
    normalize(selectedPlayer2?.role) === 'support';

  if (loading) {
    return (
      <section className={ds.section}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Comparateur</div>
          <h1 className={ds.h1}>Head to Head</h1>
          <p className={ds.body}>Chargement...</p>
        </div>
      </section>
    );
  }

  const supportOnly = (role: string | undefined, value: number | undefined) =>
    normalize(role) === 'support' ? value : undefined;

  return (
    <>
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Comparateur CZF</div>
          <h1 className={ds.h1}>Head to Head</h1>

          {error && <div className={ds.formError}>{error}</div>}
        </div>
      </header>

      <section className={ds.section}>
        <div className={ds.container}>
          {/* Un seul bloc : sélection, équipes, rosters, duel et historique. */}
          <div className={styles.board}>
            <div className={styles.selectorRow}>
              <TeamPicker
                teams={sortedTeams}
                selectedId={team1Id}
                blockedId={team2Id}
                onSelect={setTeam1Id}
                placeholder="Équipe 1"
              />

              <div className={styles.vs}><span>VS</span></div>

              <TeamPicker
                teams={sortedTeams}
                selectedId={team2Id}
                blockedId={team1Id}
                onSelect={setTeam2Id}
                placeholder="Équipe 2"
              />
            </div>

            {!team1 || !team2 ? (
              <div className={styles.emptyState}>
                Sélectionne deux équipes pour lancer la comparaison.
              </div>
            ) : (
              <>
                <div className={styles.faceoff}>
                  <TeamIdentity team={team1} side="left" form={formOf(team1.id)} />
                  <div className={styles.vs}><span>VS</span></div>
                  <TeamIdentity team={team2} side="right" form={formOf(team2.id)} />
                </div>

                <Band>Équipes</Band>

                <div className={styles.lines}>
                  <StatLine
                    label="Classement"
                    left={team1.rank}
                    right={team2.rank}
                    format={(value) => (value === undefined ? '—' : `#${value}`)}
                    compare
                    lowerIsBetter
                    bar={false}
                  />
                  <StatLine
                    label="Points"
                    left={team1.points}
                    right={team2.points}
                    format={formatInteger}
                    compare
                  />
                  <TextLine
                    label="V - D"
                    left={<WinLoss wins={team1.wins} losses={team1.losses} />}
                    right={<WinLoss wins={team2.wins} losses={team2.losses} />}
                  />
                </div>

                <Band>Choisis ton duel</Band>

                <div className={styles.rosterGrid}>
                  <RosterColumn
                    roster={roster1}
                    selectedId={player1Id}
                    onSelect={setPlayer1Id}
                    side="left"
                  />
                  <RosterColumn
                    roster={roster2}
                    selectedId={player2Id}
                    onSelect={setPlayer2Id}
                    side="right"
                  />
                </div>

                {selectedPlayer1 && selectedPlayer2 && (
                  <>
                    <Band>Duel joueurs</Band>

                    <div className={styles.playerHead}>
                      <div>
                        <span>{roleLabel(selectedPlayer1.role)}</span>
                        <strong>
                          {selectedPlayer1.player ? (
                            <Link href={`/players/${selectedPlayer1.player.id}`} className={styles.playerLink}>
                              <RiotName riotId={selectedPlayer1.riotId} />
                            </Link>
                          ) : (
                            <RiotName riotId={selectedPlayer1.riotId} />
                          )}
                        </strong>
                        <PlayerRank player={selectedPlayer1.player} />
                        <ChampionMiniList champions={topChampions1} />
                      </div>

                      <div className={styles.vs}><span>VS</span></div>

                      <div>
                        <span>{roleLabel(selectedPlayer2.role)}</span>
                        <strong>
                          {selectedPlayer2.player ? (
                            <Link href={`/players/${selectedPlayer2.player.id}`} className={styles.playerLink}>
                              <RiotName riotId={selectedPlayer2.riotId} />
                            </Link>
                          ) : (
                            <RiotName riotId={selectedPlayer2.riotId} />
                          )}
                        </strong>
                        <PlayerRank player={selectedPlayer2.player} />
                        <ChampionMiniList champions={topChampions2} />
                      </div>
                    </div>

                    {!stat1 && !stat2 ? (
                      <div className={styles.emptyState}>
                        Pas encore de statistiques disponibles pour ces joueurs.
                      </div>
                    ) : (
                      <div className={styles.lines}>
                        <StatLine
                          label="Games"
                          left={stat1?.games}
                          right={stat2?.games}
                          format={formatInteger}
                          bar={false}
                        />
                        <StatLine
                          label="KDA"
                          left={stat1?.kda}
                          right={stat2?.kda}
                          leftRank={getStatRank(stat1, 'kda')}
                          rightRank={getStatRank(stat2, 'kda')}
                          format={(value) => formatNumber(value, 2)}
                          compare
                        />
                        <StatLine
                          label="KP %"
                          left={stat1?.killParticipation}
                          right={stat2?.killParticipation}
                          leftRank={getStatRank(stat1, 'killParticipation')}
                          rightRank={getStatRank(stat2, 'killParticipation')}
                          format={formatPercent}
                          compare
                        />
                        <StatLine
                          label="Dégâts / min"
                          left={stat1?.dpm}
                          right={stat2?.dpm}
                          leftRank={getStatRank(stat1, 'dpm')}
                          rightRank={getStatRank(stat2, 'dpm')}
                          format={formatInteger}
                          compare
                        />
                        <StatLine
                          label="DMG Team %"
                          left={stat1?.damageShare}
                          right={stat2?.damageShare}
                          leftRank={getStatRank(stat1, 'damageShare')}
                          rightRank={getStatRank(stat2, 'damageShare')}
                          format={formatPercent}
                          compare
                        />
                        <StatLine
                          label="Gold / min"
                          left={stat1?.goldPerMin}
                          right={stat2?.goldPerMin}
                          leftRank={getStatRank(stat1, 'goldPerMin')}
                          rightRank={getStatRank(stat2, 'goldPerMin')}
                          format={formatInteger}
                          compare
                        />
                        <StatLine
                          label="Gold Team %"
                          left={stat1?.goldShare}
                          right={stat2?.goldShare}
                          leftRank={getStatRank(stat1, 'goldShare')}
                          rightRank={getStatRank(stat2, 'goldShare')}
                          format={formatPercent}
                          compare
                        />
                        <StatLine
                          label="CS / min"
                          left={stat1?.csPerMin}
                          right={stat2?.csPerMin}
                          leftRank={getStatRank(stat1, 'csPerMin')}
                          rightRank={getStatRank(stat2, 'csPerMin')}
                          format={(value) => formatNumber(value, 1)}
                          compare
                        />
                        {showVision && (
                          <StatLine
                            label="Vision / min"
                            left={supportOnly(selectedPlayer1.role, stat1?.visionScore)}
                            right={supportOnly(selectedPlayer2.role, stat2?.visionScore)}
                            leftRank={
                              supportOnly(selectedPlayer1.role, 1)
                                ? getStatRank(stat1, 'visionScore')
                                : null
                            }
                            rightRank={
                              supportOnly(selectedPlayer2.role, 1)
                                ? getStatRank(stat2, 'visionScore')
                                : null
                            }
                            format={(value) => formatNumber(value, 2)}
                            compare
                          />
                        )}
                        <StatLine
                          label="MVP"
                          left={stat1?.mvp}
                          right={stat2?.mvp}
                          format={formatInteger}
                          compare
                          bar={false}
                        />
                      </div>
                    )}
                  </>
                )}

                <Band
                  hint={
                    <span className={styles.h2hScore}>
                      <b className={scoreClass(directScore.left, directScore.right)}>
                        {directScore.left}
                      </b>
                      {' - '}
                      <b className={scoreClass(directScore.right, directScore.left)}>
                        {directScore.right}
                      </b>
                    </span>
                  }
                >
                  Historique direct
                </Band>

                {directMatches.length === 0 ? (
                  <div className={styles.emptyState}>
                    Ces deux équipes ne se sont pas encore affrontées.
                  </div>
                ) : (
                  <div className={styles.history}>
                    {directMatches.map((match) => {
                      const leftIsTeam1 = Number(match.team1.id) === Number(team1.id);
                      const left = leftIsTeam1 ? match.team1 : match.team2;
                      const right = leftIsTeam1 ? match.team2 : match.team1;

                      return (
                        <div key={match.id} className={styles.historyRow}>
                          <strong>{left.name}</strong>
                          <div>
                            <b>
                              <span className={scoreClass(left.score, right.score)}>{left.score}</span>
                              {' - '}
                              <span className={scoreClass(right.score, left.score)}>{right.score}</span>
                            </b>
                            <small>{formatDate(match.playedAt)}</small>
                          </div>
                          <strong>{right.name}</strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

// Bandeau de section du bloc, comme les intertitres de dpm.lol.
function Band({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className={styles.band}>
      <span>{children}</span>
      {hint && <div className={styles.bandHint}>{hint}</div>}
    </div>
  );
}

function formatPercent(value: number | undefined) {
  return value === undefined ? '—' : `${formatNumber(value, 1)}%`;
}

function TeamPicker({
  teams,
  selectedId,
  blockedId,
  onSelect,
  placeholder,
}: {
  teams: StandingTeam[];
  selectedId: number | null;
  blockedId: number | null;
  onSelect: (id: number | null) => void;
  placeholder: string;
}) {
  const selectedTeam =
    teams.find((team) => Number(team.id) === Number(selectedId)) || null;
  const [query, setQuery] = useState(selectedTeam?.name || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedTeam?.name || '');
  }, [selectedTeam?.id, selectedTeam?.name]);

  const results = useMemo(() => {
    const search = normalizeSearch(query);

    return teams
      .filter((team) => Number(team.id) !== Number(blockedId))
      .filter((team) => {
        if (!search) return true;
        return normalizeSearch(
          `${team.name} ${team.shortName || ''} ${team.division}`
        ).includes(search);
      })
      .slice(0, 10);
  }, [teams, query, blockedId]);

  return (
    <div className={styles.teamPicker}>
      <input
        type="search"
        className={styles.teamSearch}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (selectedId) onSelect(null);
        }}
      />

      {open && (
        <div className={styles.teamSuggestions}>
          {results.length === 0 ? (
            <div className={styles.teamNoResult}>Aucune équipe</div>
          ) : (
            results.map((team) => (
              <button
                key={team.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(Number(team.id));
                  setQuery(team.name);
                  setOpen(false);
                }}
              >
                <strong>{team.name}</strong>
                <span>
                  <i style={{ background: DIVISION_COLORS[team.division] }} />
                  {team.division}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TeamIdentity({
  team,
  side,
  form,
}: {
  team: StandingTeam;
  side: 'left' | 'right';
  form: boolean[];
}) {
  return (
    <div
      className={`${styles.teamIdentity} ${
        side === 'right' ? styles.teamIdentityRight : ''
      }`}
    >
      <div className={styles.teamLogo}>
        {team.logo ? (
          <img src={logoSrc(team.logo)} alt="" />
        ) : (
          <span>{team.shortName || team.name.slice(0, 2)}</span>
        )}
      </div>

      <div>
        <div className={styles.teamDivision}>
          <span style={{ background: DIVISION_COLORS[team.division] }} />
          {team.division}
        </div>
        <h2>{team.name}</h2>
        {form.length > 0 && (
          <div className={styles.form} title={`${form.length} dernières games`}>
            {form.map((won, index) => (
              <span key={index} className={won ? styles.formWin : styles.formLoss}>
                {won ? 'V' : 'D'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextLine({
  label,
  left,
  right,
}: {
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={styles.statLine}>
      <div className={styles.statSide}>{left}</div>
      <div className={styles.statCenter}>
        <span className={styles.statLabel}>{label}</span>
      </div>
      <div className={`${styles.statSide} ${styles.statSideRight}`}>{right}</div>
    </div>
  );
}

function RosterColumn({
  roster,
  selectedId,
  onSelect,
  side,
}: {
  roster: RosterItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  side: 'left' | 'right';
}) {
  return (
    <div className={styles.rosterColumn}>
      {roster.map((item) => (
        <button
          key={item.member.id}
          type="button"
          disabled={!item.playerId}
          className={`${styles.rosterRow} ${
            side === 'right' ? styles.rosterRowRight : ''
          } ${
            Number(selectedId) === Number(item.playerId)
              ? styles.rosterRowActive
              : ''
          }`}
          onClick={() => onSelect(item.playerId)}
        >
          <span className={styles.rosterRole}>{roleLabel(item.role)}</span>
          <strong><RiotName riotId={item.riotId} /></strong>
          <small>{item.points} pts</small>
        </button>
      ))}
    </div>
  );
}

function WinLoss({ wins, losses }: { wins: number; losses: number }) {
  return (
    <span className={styles.winLoss}>
      <b className={ds.win}>{wins}</b> – <b className={ds.loss}>{losses}</b>
    </span>
  );
}

function scoreClass(score: number, other: number) {
  if (score === other) return '';
  return score > other ? ds.win : ds.loss;
}

function ChampionMiniList({
  champions,
}: {
  champions: {
    championId: string;
    name: string;
    image?: string | null;
    games: number;
  }[];
}) {
  if (!champions.length) {
    return (
      <div className={styles.championMiniEmpty}>Aucun champion enregistré</div>
    );
  }

  return (
    <div className={styles.championMiniList}>
      {champions.map((champion) => (
        <div
          key={champion.championId}
          className={styles.championMini}
          title={`${champion.name} · ${champion.games} game${
            champion.games > 1 ? 's' : ''
          }`}
        >
          {champion.image ? (
            <img src={champion.image} alt="" />
          ) : (
            <span className={styles.championMiniFallback} />
          )}
          <span className={styles.championMiniName}>{champion.name}</span>
          <b>{champion.games}</b>
        </div>
      ))}
    </div>
  );
}

// Valeur / libellé + barre de répartition / valeur ; la meilleure valeur passe en badge.
function StatLine({
  label,
  left,
  right,
  format,
  compare = false,
  lowerIsBetter = false,
  bar = true,
  leftRank,
  rightRank,
}: {
  label: string;
  left?: number;
  right?: number;
  format: (value: number | undefined) => string;
  compare?: boolean;
  lowerIsBetter?: boolean;
  bar?: boolean;
  leftRank?: number | null;
  rightRank?: number | null;
}) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const validLeft = left !== undefined && left !== null && Number.isFinite(leftNumber);
  const validRight = right !== undefined && right !== null && Number.isFinite(rightNumber);
  const canCompare = compare && validLeft && validRight && leftNumber !== rightNumber;
  const leftWins = canCompare && (lowerIsBetter ? leftNumber < rightNumber : leftNumber > rightNumber);
  const rightWins = canCompare && !leftWins;

  const total = leftNumber + rightNumber;
  const showBar = bar && validLeft && validRight && total > 0;
  const leftShare = showBar ? (leftNumber / total) * 100 : 50;

  const side = (value: number | undefined, rank: number | null | undefined, best: boolean) => (
    <>
      <span className={best ? styles.statBest : styles.statValue}>{format(value)}</span>
      {rank ? <small className={styles.statRank}>#{rank}</small> : null}
    </>
  );

  return (
    <div className={styles.statLine}>
      <div className={styles.statSide}>{side(left, leftRank, leftWins)}</div>

      <div className={styles.statCenter}>
        <span className={styles.statLabel}>{label}</span>
        {showBar && (
          <div className={styles.statBar}>
            <i style={{ width: `${leftShare}%` }} />
          </div>
        )}
      </div>

      <div className={`${styles.statSide} ${styles.statSideRight}`}>
        {side(right, rightRank, rightWins)}
      </div>
    </div>
  );
}
