'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import { ROLES, splitRiotId } from '@/app/components/ds/lol';
import styles from './results.module.css';

/* =========================================================
   TYPES (réponse de /api/resultats)
========================================================= */

type Role = 'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  wins: number;
  losses: number;
};

type MatchSide = {
  id: number;
  name: string;
  shortName: string;
  logo: string | null;
  score: number;
};

type HistoryMatch = {
  id: number;
  stage: 'pool' | 'playoff';
  bestOf: number;
  playedAt: string;
  mvpRiotId: string | null;
  // null quand l'équipe n'est plus validée par un admin.
  team1: MatchSide | null;
  team2: MatchSide | null;
  winner: { id: number } | null;
};

type GamePlayer = {
  playerId: number | null;
  riotId: string;
  isSub?: boolean;
  teamId: number;
  role: string | null;
  championName: string;
  championImage: string | null;
  kills: number;
  deaths: number;
  assists: number;
};

type Game = {
  id: number;
  gameNumber: number;
  durationSeconds: number;
  winnerTeamId: number;
  winnerName: string | null;
  players: GamePlayer[];
};

type PlayerStats = {
  playerId: number;
  role: Role;
  riotId: string;
  teamShortName: string;
  teamLogo: string | null;
  kda: number;
  goldPerMin: number;
  dpm: number;
  csPerMin: number;
  visionScore: number;
  mvp: number;
};

type ChampionStat = {
  championId: string;
  name: string;
  image: string | null;
  picks: number;
  pickRate: number;
  winRate: number;
};

type DivisionData = {
  teams: Team[];
  history: HistoryMatch[];
  playerStats: Record<Role, PlayerStats[]>;
  champions: Record<Role, ChampionStat[]>;
};

type StatKey = 'kda' | 'goldPerMin' | 'dpm' | 'csPerMin' | 'visionScore';

/* =========================================================
   CHARGEMENT
========================================================= */

const QUALIFIED = 8;
const HISTORY_PREVIEW = 5;

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Impossible de charger les résultats.');
  }

  return json;
}

// Une requête par division (et par BO ouvert), partagée entre chargement et préchargement.
const divisionRequests = new Map<DivisionName, Promise<DivisionData>>();
const gameRequests = new Map<number, Promise<Game[]>>();

function loadDivision(division: DivisionName): Promise<DivisionData> {
  let request = divisionRequests.get(division);

  if (!request) {
    request = getJson(`/api/resultats?division=${division}`).catch((error) => {
      divisionRequests.delete(division);
      throw error;
    });

    divisionRequests.set(division, request);
  }

  return request;
}

function loadGames(matchId: number): Promise<Game[]> {
  let request = gameRequests.get(matchId);

  if (!request) {
    request = getJson(`/api/historique/${matchId}`)
      .then((json) => json.match.games as Game[])
      .catch((error) => {
        gameRequests.delete(matchId);
        throw error;
      });

    gameRequests.set(matchId, request);
  }

  return request;
}

function readDivisionFromUrl(): DivisionName {
  const value = new URLSearchParams(window.location.search).get('division');
  const match = DIVISIONS.find((division) => division.toLowerCase() === value?.toLowerCase());

  return match ?? 'Yordle';
}

/* =========================================================
   ICONES
========================================================= */

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2.2" fill="none" />
    </svg>
  );
}

/* =========================================================
   VUE
========================================================= */

export default function ResultsView() {
  const [division, setDivision] = useState<DivisionName>('Yordle');
  const [role, setRole] = useState<Role>('Top');
  const [cache, setCache] = useState<Partial<Record<DivisionName, DivisionData>>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    // Données fraîches à chaque arrivée sur la page.
    divisionRequests.clear();
    gameRequests.clear();
    setDivision(readDivisionFromUrl());
  }, []);

  // Lien partageable : /results?division=Ixtal.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('division', division);
    window.history.replaceState(null, '', url.toString());
  }, [division]);

  useEffect(() => {
    if (cache[division]) return;

    let active = true;
    setError('');

    loadDivision(division)
      .then((data) => {
        if (!active) return;

        setCache((previous) => ({ ...previous, [division]: data }));

        // Précharge les autres divisions pour un changement d'onglet instantané.
        for (const other of DIVISIONS) {
          if (other === division) continue;

          loadDivision(other)
            .then((otherData) => setCache((previous) => ({ ...previous, [other]: otherData })))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Erreur de chargement.');
      });

    return () => {
      active = false;
    };
  }, [division, cache]);

  const data = cache[division] ?? null;
  const loading = !data && !error;

  const counts = useMemo(() => {
    // Mêmes BO que l'historique : sans ceux d'une équipe qui n'est plus validée.
    const history = (data?.history ?? []).filter((match) => match.team1 && match.team2);

    return {
      matches: history.length,
      games: history.reduce(
        (total, match) => total + (match.team1?.score ?? 0) + (match.team2?.score ?? 0),
        0
      ),
      teams: data?.teams.length ?? 0,
    };
  }, [data]);

  return (
    <div style={{ '--division-color': DIVISION_COLORS[division] } as React.CSSProperties}>
      {/* =================================================
          EN-TÊTE
      ================================================= */}

      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Saison 1 · Résultats</div>
          <h1 className={ds.h1}>Résultats</h1>

          <div className={ds.counters}>
            <div className={ds.counter}>
              <strong>{loading ? '—' : counts.matches}</strong>
              <span>BO joués</span>
            </div>
            <div className={ds.counter}>
              <strong>{loading ? '—' : counts.games}</strong>
              <span>Games</span>
            </div>
            <div className={ds.counter}>
              <strong>{loading ? '—' : counts.teams}</strong>
              <span>Équipes</span>
            </div>
          </div>
        </div>
      </header>

      <section className={ds.section}>
        <div className={ds.container}>
          <div className={`${ds.tabs} ${ds.filterRowLast}`}>
            {DIVISIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={division === item ? ds.tabActive : ds.tab}
                onClick={() => {
                  setDivision(item);
                  setRole('Top');
                }}
              >
                <span className={ds.dot} style={{ background: DIVISION_COLORS[item] }} />
                {item}
              </button>
            ))}
          </div>

          {error && <div className={`${ds.card} ${ds.empty}`}>{error}</div>}
          {loading && <div className={`${ds.card} ${ds.empty}`}>Chargement des résultats…</div>}

          {data && (
            <>
              <div className={styles.mainGrid}>
                <Standings teams={data.teams} />
                <Bracket teams={data.teams} />
              </div>

              <History key={division} history={data.history} />

              <PlayerSection
                role={role}
                onRoleChange={setRole}
                playerStats={data.playerStats}
                champions={data.champions[role] ?? []}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   BLOCS COMMUNS
========================================================= */

function BlockHead({ label, title, aside }: { label: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className={styles.blockHead}>
      <div>
        <div className={ds.sectionLabel}>{label}</div>
        <h2 className={styles.blockTitle}>{title}</h2>
      </div>
      {aside && <span className={styles.blockAside}>{aside}</span>}
    </div>
  );
}

function TeamLogo({ logo, size = 'md' }: { logo: string | null; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? styles.logoSm : styles.logo;

  return logo ? (
    <img src={logo} alt="" className={className} loading="lazy" />
  ) : (
    <span className={`${className} ${styles.logoEmpty}`} />
  );
}

/* =========================================================
   CLASSEMENT
========================================================= */

const Standings = memo(function Standings({ teams }: { teams: Team[] }) {
  return (
    <div className={`${ds.card} ${styles.standings}`}>
      <BlockHead label="Phase de poule" title="Classement" />

      <div className={styles.standingHeader}>
        <span>#</span>
        <span>Équipe</span>
        <span>V - D</span>
      </div>

      {teams.length === 0 && <div className={ds.empty}>Aucune équipe validée pour le moment.</div>}

      {teams.map((team, index) => (
        <div
          key={team.id}
          className={`${styles.standingRow} ${index < QUALIFIED ? styles.qualified : styles.eliminated}`}
        >
          <span className={styles.standingRank}>{index + 1}</span>

          <span className={styles.standingTeam}>
            <TeamLogo logo={team.logo} size="sm" />
            <span className={styles.standingName}>
              <strong>{team.shortName}</strong>
              <small>{team.name}</small>
            </span>
          </span>

          <span className={styles.standingScore}>
            {team.wins} - {team.losses}
          </span>
        </div>
      ))}

    </div>
  );
});

/* =========================================================
   PHASE FINALE (double élimination, placeholders)
========================================================= */

function seed(teams: Team[], rank: number) {
  return { seed: rank, name: teams[rank - 1]?.shortName ?? 'À définir' };
}

function BracketMatch({
  top,
  bottom,
  final = false,
}: {
  top: { seed?: number; name: string };
  bottom: { seed?: number; name: string };
  final?: boolean;
}) {
  return (
    <div className={`${styles.bracketMatch} ${final ? styles.bracketFinal : ''}`}>
      {[top, bottom].map((side, index) => (
        <div key={index} className={styles.bracketSide}>
          <span className={styles.bracketSeed}>{side.seed ?? ''}</span>
          <span className={styles.bracketName}>{side.name}</span>
          <span className={styles.bracketScore}>-</span>
        </div>
      ))}
    </div>
  );
}

function BracketRound({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.bracketRound}>
      <h3>{title}</h3>
      <div className={styles.bracketMatches}>{children}</div>
    </div>
  );
}

const TBD = { name: 'À définir' };

const Bracket = memo(function Bracket({ teams }: { teams: Team[] }) {
  return (
    <div className={`${ds.card} ${styles.bracket}`}>
      <BlockHead label="Phase finale" title="Double élimination" aside={`Top ${QUALIFIED}`} />

      <div className={styles.bracketScroller}>
        <div className={styles.bracketInner}>
          <div className={styles.laneTitle}>Winner bracket</div>
          <div className={styles.bracketLane}>
            <BracketRound title="Quarts">
              <BracketMatch top={seed(teams, 1)} bottom={seed(teams, 8)} />
              <BracketMatch top={seed(teams, 4)} bottom={seed(teams, 5)} />
              <BracketMatch top={seed(teams, 2)} bottom={seed(teams, 7)} />
              <BracketMatch top={seed(teams, 3)} bottom={seed(teams, 6)} />
            </BracketRound>
            <BracketRound title="Demi-finales">
              <BracketMatch top={TBD} bottom={TBD} />
              <BracketMatch top={TBD} bottom={TBD} />
            </BracketRound>
            <BracketRound title="Finale winner">
              <BracketMatch top={TBD} bottom={TBD} final />
            </BracketRound>
            <BracketRound title="Grande finale">
              <BracketMatch top={{ name: 'Vainqueur WB' }} bottom={{ name: 'Vainqueur LB' }} final />
            </BracketRound>
          </div>

          <div className={styles.bracketDrop}>Les perdants du winner bracket descendent dans le loser bracket</div>

          <div className={`${styles.laneTitle} ${styles.laneLoser}`}>Loser bracket</div>
          <div className={styles.bracketLane}>
            <BracketRound title="Round 1">
              <BracketMatch top={{ name: 'Perdant QF' }} bottom={{ name: 'Perdant QF' }} />
              <BracketMatch top={{ name: 'Perdant QF' }} bottom={{ name: 'Perdant QF' }} />
            </BracketRound>
            <BracketRound title="Round 2">
              <BracketMatch top={TBD} bottom={{ name: 'Perdant DF' }} />
              <BracketMatch top={TBD} bottom={{ name: 'Perdant DF' }} />
            </BracketRound>
            <BracketRound title="Round 3">
              <BracketMatch top={TBD} bottom={TBD} />
            </BracketRound>
            <BracketRound title="Finale loser">
              <BracketMatch top={TBD} bottom={{ name: 'Perdant WB' }} final />
            </BracketRound>
          </div>
        </div>
      </div>
    </div>
  );
});

/* =========================================================
   HISTORIQUE
========================================================= */

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function roleIndex(role: string | null) {
  const index = ROLES.findIndex((item) => item.name === role);
  return index === -1 ? 99 : index;
}

function History({ history }: { history: HistoryMatch[] }) {
  const [showAll, setShowAll] = useState(false);
  const matches = history.filter((match) => match.team1 && match.team2);
  const visible = showAll ? matches : matches.slice(0, HISTORY_PREVIEW);

  return (
    <div className={`${ds.card} ${styles.history}`}>
      <BlockHead
        label="Matchs terminés"
        title="Historique"
        aside={`${matches.length} match${matches.length > 1 ? 's' : ''}`}
      />

      {matches.length === 0 ? (
        <div className={ds.empty}>Aucun match enregistré pour le moment.</div>
      ) : (
        visible.map((match) => <HistoryRow key={match.id} match={match} />)
      )}

      {matches.length > HISTORY_PREVIEW && (
        <button type="button" className={ds.cardFooter} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Réduire' : `Voir les ${matches.length} matchs`}
        </button>
      )}
    </div>
  );
}

function HistoryRow({ match }: { match: HistoryMatch }) {
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<Game[] | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const team1 = match.team1!;
  const team2 = match.team2!;

  function toggle() {
    if (!open && !games) {
      setDetailsError('');
      loadGames(match.id)
        .then(setGames)
        .catch((err) => setDetailsError(err?.message || 'Impossible de charger le match.'));
    }

    setOpen(!open);
  }

  const scoreClass = (teamId: number) =>
    match.winner?.id === teamId ? styles.scoreWin : match.winner ? styles.scoreLoss : '';

  return (
    <div className={styles.historyItem}>
      <button
        type="button"
        className={styles.historyRow}
        onClick={toggle}
        // Précharge le détail au survol : l'ouverture paraît instantanée.
        onMouseEnter={() => loadGames(match.id).catch(() => {})}
        aria-expanded={open}
      >
        <span className={styles.historyMeta}>
          <span className={match.stage === 'pool' ? styles.stageChip : styles.stageChipPlayoff}>
            {match.stage === 'pool' ? 'Poule' : 'Playoff'}
          </span>
          <small>{formatDate(match.playedAt)}</small>
        </span>

        <span className={styles.historyTeam}>
          <span className={styles.historyTeamName}>
            <strong>{team1.shortName}</strong>
            <small>{team1.name}</small>
          </span>
          <TeamLogo logo={team1.logo} />
        </span>

        <span className={styles.historyScore}>
          <span className={scoreClass(team1.id)}>{team1.score}</span>
          <i>-</i>
          <span className={scoreClass(team2.id)}>{team2.score}</span>
        </span>

        <span className={`${styles.historyTeam} ${styles.historyTeamRight}`}>
          <TeamLogo logo={team2.logo} />
          <span className={styles.historyTeamName}>
            <strong>{team2.shortName}</strong>
            <small>{team2.name}</small>
          </span>
        </span>

        <span className={styles.historyToggle}>
          {open ? 'Fermer' : 'Détails'} <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className={`${ds.onDark} ${styles.historyDetails}`}>
          {detailsError && <p className={styles.detailsState}>{detailsError}</p>}
          {!games && !detailsError && <p className={styles.detailsState}>Chargement…</p>}

          {games?.map((game) => (
            <GameDetails key={game.id} game={game} team1={team1} team2={team2} />
          ))}

          {games && (
            <div className={styles.mvpLine}>
              <span>MVP du BO</span>
              <strong>{match.mvpRiotId ? splitRiotId(match.mvpRiotId).name : '—'}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameDetails({ game, team1, team2 }: { game: Game; team1: MatchSide; team2: MatchSide }) {
  const sidePlayers = (teamId: number) =>
    game.players
      .filter((player) => player.teamId === teamId)
      .sort((a, b) => roleIndex(a.role) - roleIndex(b.role));

  return (
    <div className={styles.game}>
      <div className={styles.gameHead}>
        <strong>Game {game.gameNumber}</strong>
        <span>{formatDuration(game.durationSeconds)}</span>
        <em>Victoire {game.winnerName ?? '—'}</em>
      </div>

      <div className={styles.gameTeams}>
        {[team1, team2].map((team) => (
          <div
            key={team.id}
            className={`${styles.gameTeam} ${game.winnerTeamId === team.id ? styles.gameTeamWin : ''}`}
          >
            <div className={styles.gameTeamName}>{team.shortName}</div>

            {sidePlayers(team.id).map((player, index) => (
              <div key={`${player.playerId ?? 'sub'}-${index}`} className={styles.gamePlayer}>
                {player.championImage ? (
                  <img src={player.championImage} alt="" loading="lazy" />
                ) : (
                  <span className={styles.championEmpty} />
                )}

                <span className={styles.gamePlayerName}>
                  {player.isSub ? <em className={styles.subChip}>Sub</em> : splitRiotId(player.riotId).name}
                  <small>{player.championName}</small>
                </span>

                <span className={styles.gameKda}>
                  {player.kills}/{player.deaths}/{player.assists}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   STATISTIQUES JOUEURS
========================================================= */

const STAT_CARDS: { statKey: StatKey; title: string; format: (value: number) => string }[] = [
  { statKey: 'kda', title: 'KDA', format: (value) => value.toFixed(2) },
  { statKey: 'goldPerMin', title: 'Gold / min', format: (value) => String(Math.round(value)) },
  { statKey: 'dpm', title: 'Dégâts / min', format: (value) => String(Math.round(value)) },
  { statKey: 'csPerMin', title: 'CS / min', format: (value) => value.toFixed(1) },
];

const VISION_CARD = {
  statKey: 'visionScore' as StatKey,
  title: 'Vision / min',
  format: (value: number) => value.toFixed(2),
};

function PlayerSection({
  role,
  onRoleChange,
  playerStats,
  champions,
}: {
  role: Role;
  onRoleChange: (role: Role) => void;
  playerStats: Record<Role, PlayerStats[]>;
  champions: ChampionStat[];
}) {
  const players = playerStats[role] ?? [];
  // Le support est classé à la vision plutôt qu'aux CS.
  const cards = role === 'Support' ? [...STAT_CARDS.slice(0, 3), VISION_CARD] : STAT_CARDS;

  // MVP tous rôles : un joueur peut apparaître dans plusieurs rôles.
  const mvpRanking = useMemo(() => {
    const byPlayer = new Map<number, PlayerStats & { roles: Role[] }>();

    for (const player of Object.values(playerStats).flat()) {
      const existing = byPlayer.get(player.playerId);

      if (existing) {
        existing.mvp += player.mvp;
        if (player.mvp > 0) existing.roles.push(player.role);
      } else {
        byPlayer.set(player.playerId, { ...player, roles: player.mvp > 0 ? [player.role] : [] });
      }
    }

    return [...byPlayer.values()].filter((player) => player.mvp > 0).sort((a, b) => b.mvp - a.mvp);
  }, [playerStats]);

  return (
    <div className={styles.playerSection}>
      <BlockHead label="Performances" title="Statistiques joueurs" />

      <div className={`${ds.tabs} ${ds.filterRowLast}`}>
        {ROLES.map((item) => (
          <button
            key={item.name}
            type="button"
            className={role === item.name ? ds.tabActive : ds.tab}
            onClick={() => onRoleChange(item.name as Role)}
          >
            <img src={item.image} alt="" className={ds.tabRoleIcon} />
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.rankingGrid}>
        {cards.map((card) => (
          <RankingCard key={`${role}-${card.statKey}`} players={players} {...card} />
        ))}
      </div>

      <div className={styles.subHead}>
        <h3>Champions les plus joués</h3>
        <span>{ROLES.find((item) => item.name === role)?.label} · Top 5</span>
      </div>

      {champions.length === 0 ? (
        <div className={`${ds.card} ${ds.empty}`}>Aucun champion enregistré pour le moment.</div>
      ) : (
        <div className={styles.championGrid}>
          {champions.slice(0, 5).map((champion, index) => (
            <div key={champion.championId} className={`${ds.card} ${styles.championCard}`}>
              <span className={styles.championRank}>#{index + 1}</span>
              {champion.image ? (
                <img src={champion.image} alt="" loading="lazy" />
              ) : (
                <span className={styles.championEmpty} />
              )}
              <strong>{champion.name}</strong>
              <small>
                {champion.picks} pick{champion.picks > 1 ? 's' : ''}
              </small>
              <div className={styles.championStats}>
                <span>
                  <small>Pick</small>
                  {champion.pickRate}%
                </span>
                <span>
                  <small>Win</small>
                  {champion.winRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.subHead}>
        <h3>Classement MVP</h3>
        <span>Tous rôles</span>
      </div>

      {mvpRanking.length === 0 ? (
        <div className={`${ds.card} ${ds.empty}`}>Aucun MVP attribué pour le moment.</div>
      ) : (
        <div className={`${ds.card} ${styles.mvpGrid}`}>
          {mvpRanking.map((player, index) => (
            <div key={player.playerId} className={styles.mvpRow}>
              <span className={styles.rankNumber}>{index + 1}</span>
              <TeamLogo logo={player.teamLogo} size="sm" />
              <span className={styles.playerName}>
                {splitRiotId(player.riotId).name}
                <small>{player.teamShortName}</small>
              </span>
              <span className={styles.mvpRoles}>
                {player.roles.map((playerRole) => {
                  const info = ROLES.find((item) => item.name === playerRole);

                  return (
                    info && (
                      <span key={playerRole} className={styles.mvpRole}>
                        <img src={info.image} alt="" />
                        {info.label}
                      </span>
                    )
                  );
                })}
              </span>
              <span className={styles.bar}>
                <span style={{ width: `${(player.mvp / mvpRanking[0].mvp) * 100}%` }} />
              </span>
              <strong className={styles.rankValue}>{player.mvp}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingCard({
  title,
  players,
  statKey,
  format,
}: {
  title: string;
  players: PlayerStats[];
  statKey: StatKey;
  format: (value: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const ranking = useMemo(
    () =>
      players
        .filter((player) => Number(player[statKey]) > 0)
        .sort((a, b) => Number(b[statKey]) - Number(a[statKey])),
    [players, statKey]
  );

  const max = Number(ranking[0]?.[statKey] ?? 0);
  const visible = ranking.slice(0, expanded ? 10 : 5);

  return (
    <div className={`${ds.card} ${styles.rankingCard}`}>
      <div className={styles.rankingHead}>
        <strong>{title}</strong>
        <span>Top {expanded ? 10 : 5}</span>
      </div>

      {visible.length === 0 ? (
        <div className={ds.empty}>Aucune donnée</div>
      ) : (
        <div className={styles.rankingRows}>
          {visible.map((player, index) => {
            const value = Number(player[statKey]);

            return (
              <div key={player.playerId} className={styles.rankingRow}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <TeamLogo logo={player.teamLogo} size="sm" />
                <span className={styles.playerName}>
                  {splitRiotId(player.riotId).name}
                  <small>{player.teamShortName}</small>
                </span>
                <strong className={styles.rankValue}>{format(value)}</strong>
                <span className={`${styles.bar} ${styles.barFull}`}>
                  <span style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {ranking.length > 5 && (
        <button type="button" className={ds.cardFooter} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Réduire' : 'Voir le top 10'}
        </button>
      )}
    </div>
  );
}
