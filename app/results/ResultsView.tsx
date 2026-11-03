'use client';

import { memo, useMemo, useState } from 'react';
import { DIVISION_COLORS } from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import { ROLES, splitRiotId } from '@/app/components/ds/lol';
import {
  BlockHead,
  ChevronIcon,
  DivisionTabs,
  LastUpdate,
  loadGames,
  TeamLogo,
  useDivisionData,
  type Game,
  type HistoryMatch,
  type MatchSide,
  type Team,
} from './shared';
import { buildBracket, QUALIFIED, type BracketNode, type BracketRoundData, type BracketTree } from './bracket';
import styles from './results.module.css';

const HISTORY_PREVIEW = 5;

/* =========================================================
   VUE
========================================================= */

export default function ResultsView() {
  const { division, setDivision, data, error, loading } = useDivisionData();
  const tree = useMemo(() => (data ? buildBracket(data.teams, data.history) : null), [data]);

  return (
    <div style={{ '--division-color': DIVISION_COLORS[division] } as React.CSSProperties}>
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Saison 1 · Résultats</div>
          <h1 className={ds.h1}>Résultats</h1>
        </div>
      </header>

      <section className={ds.section}>
        <div className={ds.container}>
          <DivisionTabs division={division} onChange={setDivision} />

          {error && <div className={`${ds.card} ${ds.empty}`}>{error}</div>}
          {loading && <div className={`${ds.card} ${ds.empty}`}>Chargement des résultats…</div>}

          {data && tree && (
            <>
              <LastUpdate date={data.lastUpdate} />

              <div className={styles.mainGrid}>
                <Standings teams={data.teams} />
                <Bracket tree={tree} />
              </div>

              <History key={division} history={data.history} roundNames={tree.roundNames} />
            </>
          )}
        </div>
      </section>
    </div>
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
   PHASE FINALE (double élimination, calculée depuis les matchs saisis)
========================================================= */

function BracketMatch({ match, final = false }: { match: BracketNode; final?: boolean }) {
  return (
    <div className={`${styles.bracketMatch} ${final ? styles.bracketFinal : ''}`}>
      {[match.top, match.bottom].map((side, index) => (
        <div
          key={index}
          className={`${styles.bracketSide} ${
            match.played ? (side.won ? styles.bracketWin : styles.bracketLoss) : ''
          }`}
          title={side.team?.name}
        >
          <span className={styles.bracketSeed}>{side.seed ?? ''}</span>
          {side.team ? (
            <>
              <TeamLogo logo={side.team.logo} size="xs" />
              <span className={styles.bracketName}>{side.team.shortName}</span>
            </>
          ) : (
            <span className={styles.bracketPlaceholder}>{side.placeholder}</span>
          )}
          <span className={styles.bracketScore}>{side.score ?? '-'}</span>
        </div>
      ))}
    </div>
  );
}

function BracketLane({ rounds }: { rounds: BracketRoundData[] }) {
  return (
    <div className={styles.bracketLane}>
      {rounds.map((round, roundIndex) => (
        <div key={round.title} className={styles.bracketRound}>
          <h3>{round.title}</h3>
          <div className={styles.bracketMatches}>
            {round.matches.map((match) => (
              <BracketMatch key={match.id} match={match} final={roundIndex === rounds.length - 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const Bracket = memo(function Bracket({ tree }: { tree: BracketTree }) {
  return (
    <div className={`${ds.card} ${styles.bracket}`}>
      <BlockHead label="Phase finale" title="Double élimination" aside={`Top ${QUALIFIED}`} />

      <div className={styles.bracketScroller}>
        <div className={styles.bracketInner}>
          <div className={styles.laneTitle}>Winner bracket</div>
          <BracketLane rounds={tree.winner} />

          <div className={styles.bracketDrop}>Les perdants du winner bracket descendent dans le loser bracket</div>

          <div className={`${styles.laneTitle} ${styles.laneLoser}`}>Loser bracket</div>
          <BracketLane rounds={tree.loser} />
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

function History({ history, roundNames }: { history: HistoryMatch[]; roundNames: Map<number, string> }) {
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
        visible.map((match) => (
          <HistoryRow key={match.id} match={match} roundName={roundNames.get(match.id)} />
        ))
      )}

      {matches.length > HISTORY_PREVIEW && (
        <button type="button" className={ds.cardFooter} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Réduire' : `Voir les ${matches.length} matchs`}
        </button>
      )}
    </div>
  );
}

function HistoryRow({ match, roundName }: { match: HistoryMatch; roundName?: string }) {
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
            {match.stage === 'pool' ? 'Poule' : roundName ?? 'Playoff'}
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
