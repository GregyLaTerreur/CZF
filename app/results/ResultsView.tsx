'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { useIsAdmin } from '@/app/components/Nav';
import {
  forgetUpcoming,
  formatMatchDate,
  matchDay,
  sideLabel,
  useUpcomingMatches,
} from '@/app/components/upcoming';
import { supabase } from '@/lib/supabase';

import {
  DIVISION_COLORS,
  displayRank,
} from '@/app/components/home/divisions';

import ds from '@/app/components/ds/ds.module.css';

import {
  ROLES,
  splitRiotId,
} from '@/app/components/ds/lol';

import {
  BlockHead,
  ChevronIcon,
  DivisionTabs,
  forgetDivisionData,
  LastUpdate,
  loadGames,
  TeamLogo,
  useDivisionData,
  type BracketScheduleEntry,
  type Game,
  type HistoryMatch,
  type MatchSide,
  type Team,
} from './shared';

import {
  buildBracket,
  QUALIFIED,
  type BracketNode,
  type BracketRoundData,
  type BracketTree,
} from './bracket';

import styles from './results.module.css';

const HISTORY_PREVIEW = 5;

/* =========================================================
   TYPES
========================================================= */

type StandingTeam = Team & {
  points?: number;
  gameDiff?: number;
  wins: number;
  losses: number;
};

/* =========================================================
   VUE
========================================================= */

export default function ResultsView() {
  const {
    division,
    setDivision,
    data,
    error,
    loading,
  } = useDivisionData('resultats');

  const isAdmin = useIsAdmin();

  // Saisies admin de la visite, par « division:match » : affichées sans attendre un rechargement.
  const [planned, setPlanned] = useState<
    Record<string, BracketScheduleEntry>
  >({});

  const tree = useMemo(() => {
    if (!data) return null;

    const schedule = new Map(
      (data.schedule ?? []).map((entry) => [entry.key, entry])
    );

    for (const [id, entry] of Object.entries(planned)) {
      if (id.startsWith(`${division}:`)) schedule.set(entry.key, entry);
    }

    return buildBracket(data.teams, data.history, [...schedule.values()]);
  }, [data, planned, division]);

  const savePlanned = (entry: BracketScheduleEntry) => {
    forgetDivisionData();
    forgetUpcoming();
    setPlanned((previous) => ({
      ...previous,
      [`${division}:${entry.key}`]: entry,
    }));
  };

  return (
    <div
      style={
        {
          '--division-color':
            DIVISION_COLORS[division],
        } as React.CSSProperties
      }
    >
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>
            Saison 1 · Résultats
          </div>

          <h1 className={ds.h1}>
            Résultats
          </h1>
        </div>
      </header>

      <section className={ds.section}>
        <div className={ds.container}>
          <DivisionTabs
            division={division}
            onChange={setDivision}
          />

          {error && (
            <div
              className={`${ds.card} ${ds.empty}`}
            >
              {error}
            </div>
          )}

          {loading && (
            <div
              className={`${ds.card} ${ds.empty}`}
            >
              Chargement des résultats…
            </div>
          )}

          {data && tree && (
            <>
              <LastUpdate
                date={data.lastUpdate}
              />

              <NextMatchBanner tree={tree} />

              <div
                className={styles.mainGrid}
              >
                <Standings
                  teams={data.teams}
                />

                <Bracket
                  tree={tree}
                  division={division}
                  isAdmin={isAdmin}
                  onSaved={savePlanned}
                />
              </div>

              <Agenda division={division} />

              <History
                key={division}
                history={data.history}
                roundNames={
                  tree.roundNames
                }
              />
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

const Standings = memo(
  function Standings({
    teams,
  }: {
    teams: Team[];
  }) {
    // Ordre et rangs calculés par l'API (confrontation directe comprise) :
    // un retri ici sans cette règle mettait un 3e devant des 1ers ex aequo.
    const sortedTeams = useMemo(
      () =>
        [...(teams as StandingTeam[])].sort(
          (a, b) =>
            (Number(a.rank) || 99) - (Number(b.rank) || 99) ||
            a.name.localeCompare(b.name, 'fr')
        ),
      [teams]
    );

    return (
      <div
        className={`${ds.card} ${styles.standings}`}
      >
        <BlockHead
          label="Phase de poule"
          title="Classement"
        />

        <div
          className={
            styles.standingHeader
          }
          style={{
            gridTemplateColumns:
              '42px minmax(0, 1fr) 58px 72px',
          }}
        >
          <span>#</span>

          <span>Équipe</span>

          <span
            style={{
              textAlign: 'center',
            }}
          >
            PTS
          </span>

          <span
            style={{
              textAlign: 'right',
            }}
          >
            V - D
          </span>
        </div>

        {sortedTeams.length === 0 && (
          <div className={ds.empty}>
            Aucune équipe validée pour le
            moment.
          </div>
        )}

        {sortedTeams.map(
          (team, index) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className={`${styles.standingRow} ${styles.standingLink} ${
                index < QUALIFIED
                  ? styles.qualified
                  : styles.eliminated
              }`}
              style={{
                gridTemplateColumns:
                  '42px minmax(0, 1fr) 58px 72px',
              }}
            >
              <span
                className={
                  styles.standingRank
                }
              >
                {displayRank(
                  sortedTeams,
                  index
                )}
              </span>

              <span
                className={
                  styles.standingTeam
                }
              >
                <TeamLogo
                  logo={team.logo}
                  size="sm"
                />

                <span
                  className={
                    styles.standingName
                  }
                >
                  <strong>
                    {team.shortName}
                  </strong>

                  <small>
                    {team.name}
                  </small>
                </span>
              </span>

              <span
                style={{
                  textAlign: 'center',
                  fontWeight: 900,
                }}
              >
                {Number(
                  team.points
                ) || 0}
              </span>

              <span
                className={
                  styles.standingScore
                }
              >
                {team.wins} -{' '}
                {team.losses}
              </span>
            </Link>
          )
        )}
      </div>
    );
  }
);

/* =========================================================
   PHASE FINALE
   double élimination, calculée depuis les matchs saisis
========================================================= */

// Un match reste « prochain » 4 h après son heure de début, tant que son score n'est pas saisi.
const STILL_PLAYING_MS = 4 * 60 * 60 * 1000;

function findNextMatch(tree: BracketTree) {
  const now = Date.now();

  return [...tree.winner, ...tree.loser]
    .flatMap((round) => round.matches)
    .filter(
      (match) =>
        !match.played &&
        match.scheduledAt &&
        new Date(match.scheduledAt).getTime() >= now - STILL_PLAYING_MS
    )
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
}

// Bandeau au-dessus du classement et de l'arbre : prochain match programmé de la division.
function NextMatchBanner({ tree }: { tree: BracketTree }) {
  const match = findNextMatch(tree);

  if (!match) return null;

  return (
    <div className={styles.nextMatch}>
      <div className={styles.nextWhen}>
        <small>
          Prochain match · {match.name} · {match.format}
        </small>
        {formatMatchDate(match.scheduledAt!)}
      </div>

      <div className={styles.nextTeams}>
        {[match.top, match.bottom].map((side, index) => (
          <div key={index} className={styles.nextTeam}>
            {index === 1 && <span className={styles.nextVs}>VS</span>}
            {side.team ? (
              <>
                <TeamLogo logo={side.team.logo} size="sm" />
                <span title={side.team.name}>{side.team.shortName}</span>
              </>
            ) : (
              <span className={styles.nextPlaceholder}>{side.placeholder}</span>
            )}
          </div>
        ))}
      </div>

      {match.streamUrl && (
        <a
          className={styles.nextStream}
          href={match.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PlayIcon />
          Regarder sur Twitch
        </a>
      )}
    </div>
  );
}

// Agenda des playoffs sous l'arbre : matchs programmés à venir de la division affichée, par jour.
function Agenda({ division }: { division: string }) {
  const matches = useUpcomingMatches()?.filter((match) => match.division === division);
  const hasMatches = Boolean(matches?.length);

  // Lien « Tout le programme » du bandeau : l'agenda n'existe qu'une fois chargé.
  useEffect(() => {
    if (hasMatches && window.location.hash === '#programme') {
      document.getElementById('programme')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hasMatches]);

  if (!matches?.length) return null;

  const today = matchDay(new Date().toISOString()).key;
  const byDay = new Map<string, typeof matches>();

  for (const match of matches) {
    const key = matchDay(match.scheduledAt).key;
    byDay.set(key, [...(byDay.get(key) ?? []), match]);
  }

  // Semaines complètes (lundi → dimanche), de la semaine en cours à celle du dernier match.
  const lastKey = matchDay(matches[matches.length - 1].scheduledAt).key;
  const toUtc = (key: string) => new Date(`${key}T12:00:00Z`);
  const cursor = toUtc(today);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));

  const weeks: { key: string; label: string; past: boolean }[][] = [];

  while (cursor <= toUtc(lastKey) || weeks.length === 0 || weeks[weeks.length - 1].length < 7) {
    if (!weeks.length || weeks[weeks.length - 1].length === 7) weeks.push([]);

    const key = cursor.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'UTC',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
      .format(cursor)
      .replace('.', '');

    weeks[weeks.length - 1].push({ key, label, past: key < today });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return (
    <div id="programme" className={`${ds.card} ${styles.agenda}`}>
      <BlockHead label="Phase finale" title="Programme" aside={division} />

      {weeks.map((week) => (
        <div key={week[0].key} className={styles.agendaDays}>
          {week.map((day) => {
            const dayMatches = byDay.get(day.key) ?? [];

            return (
              <div
                key={day.key}
                className={`${styles.agendaDay} ${day.key === today ? styles.agendaToday : ''} ${
                  day.past ? styles.agendaPast : ''
                }`}
              >
                <h4>
                  {day.label}
                  {day.key === today && <small>Auj.</small>}
                </h4>

                {dayMatches.length === 0 && <p className={styles.agendaEmpty}>Pas de match</p>}

                {dayMatches.map((match) => (
                  <div key={`${match.division}-${match.key}`} className={styles.agendaSlot}>
                    <div className={styles.agendaHour}>
                      {matchDay(match.scheduledAt).time}

                      {match.streamUrl && (
                        <a
                          className={styles.bracketPlay}
                          href={match.streamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Voir le stream"
                          aria-label="Voir le stream"
                        >
                          <PlayIcon />
                        </a>
                      )}
                    </div>

                    <div className={styles.agendaTeams}>
                      {sideLabel(match.top)} <span>vs</span> {sideLabel(match.bottom)}
                    </div>

                    <span className={styles.agendaTag}>
                      {match.name} · {match.format}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Valeur d'un <input type="datetime-local"> (heure du navigateur).
function toLocalInput(iso: string | null) {
  if (!iso) return '';

  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 1l7 4-7 4z" fill="currentColor" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M1 11l1-3 6-6 2 2-6 6zM8 2l2 2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}

function ScheduleForm({
  match,
  division,
  onClose,
  onSaved,
}: {
  match: BracketNode;
  division: string;
  onClose: () => void;
  onSaved: (entry: BracketScheduleEntry) => void;
}) {
  const [date, setDate] = useState(toLocalInput(match.scheduledAt));
  const [stream, setStream] = useState(match.streamUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch('/api/admin/bracket-schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          division,
          key: match.id,
          scheduledAt: date ? new Date(date).toISOString() : null,
          streamUrl: stream.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Enregistrement impossible.');
      }

      onSaved(json.entry);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.scheduleBackdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className={styles.scheduleForm} onSubmit={save}>
        <h4>
          {match.name} · {match.format}
        </h4>

        <label>
          Date et heure
          <input
            type="datetime-local"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label>
          Lien de stream (facultatif)
          <input
            type="url"
            placeholder="https://twitch.tv/…"
            value={stream}
            onChange={(event) => setStream(event.target.value)}
          />
        </label>

        {error && <p className={styles.scheduleError}>{error}</p>}

        <div className={styles.scheduleActions}>
          <button type="button" className={styles.scheduleCancel} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className={styles.scheduleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BracketMatch({
  match,
  final = false,
  division,
  isAdmin,
  onSaved,
}: {
  match: BracketNode;
  final?: boolean;
  division: string;
  isAdmin: boolean;
  onSaved: (entry: BracketScheduleEntry) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className={`${styles.bracketMatch} ${
        final
          ? styles.bracketFinal
          : ''
      }`}
    >
      <div className={styles.bracketStrip}>
        <span>
          {match.scheduledAt
            ? formatMatchDate(match.scheduledAt)
            : match.name}
        </span>

        <span className={styles.bracketStripRight}>
          <b>{match.format}</b>

          {match.streamUrl && (
            <a
              className={styles.bracketPlay}
              href={match.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Voir le stream"
              aria-label="Voir le stream"
            >
              <PlayIcon />
            </a>
          )}
        </span>
      </div>

      {isAdmin && (
        <button
          type="button"
          className={styles.bracketPen}
          onClick={() => setEditing((value) => !value)}
          title="Date et stream du match"
          aria-label="Date et stream du match"
        >
          <PenIcon />
        </button>
      )}

      {editing && (
        <ScheduleForm
          match={match}
          division={division}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}

      {[match.top, match.bottom].map(
        (side, index) => (
          <div
            key={index}
            className={`${styles.bracketSide} ${
              match.played
                ? side.won
                  ? styles.bracketWin
                  : styles.bracketLoss
                : ''
            }`}
            title={side.team?.name}
          >
            <span
              className={
                styles.bracketSeed
              }
            >
              {side.seed ?? ''}
            </span>

            {side.team ? (
              <>
                <TeamLogo
                  logo={side.team.logo}
                  size="xs"
                />

                <span
                  className={
                    styles.bracketName
                  }
                >
                  {
                    side.team
                      .shortName
                  }
                </span>
              </>
            ) : (
              <span
                className={
                  styles.bracketPlaceholder
                }
              >
                {side.placeholder}
              </span>
            )}

            <span
              className={
                styles.bracketScore
              }
            >
              {side.forfeit ? 'FF' : side.score ?? '-'}
            </span>
          </div>
        )
      )}
    </div>
  );
}

type BracketActions = {
  division: string;
  isAdmin: boolean;
  onSaved: (entry: BracketScheduleEntry) => void;
};

function BracketLane({
  rounds,
  ...actions
}: {
  rounds: BracketRoundData[];
} & BracketActions) {
  return (
    <div className={styles.bracketLane}>
      {rounds.map(
        (round, roundIndex) => (
          <div
            key={round.title}
            className={
              styles.bracketRound
            }
          >
            <h3>{round.title}</h3>

            <div
              className={
                styles.bracketMatches
              }
            >
              {round.matches.map(
                (match) => (
                  <BracketMatch
                    key={match.id}
                    match={match}
                    {...actions}
                    final={
                      roundIndex ===
                      rounds.length -
                        1
                    }
                  />
                )
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

const Bracket = memo(
  function Bracket({
    tree,
    ...actions
  }: {
    tree: BracketTree;
  } & BracketActions) {
    return (
      <div
        className={`${ds.card} ${styles.bracket}`}
      >
        <BlockHead
          label="Phase finale"
          title="Double élimination"
          aside={`Top ${QUALIFIED}`}
        />

        <div
          className={
            styles.bracketScroller
          }
        >
          <div
            className={
              styles.bracketInner
            }
          >
            <div
              className={
                styles.laneTitle
              }
            >
              Winner bracket
            </div>

            <BracketLane
              rounds={tree.winner}
              {...actions}
            />

            <div
              className={
                styles.bracketDrop
              }
            >
              Les perdants du winner
              bracket descendent dans le
              loser bracket
            </div>

            <div
              className={`${styles.laneTitle} ${styles.laneLoser}`}
            >
              Loser bracket
            </div>

            <BracketLane
              rounds={tree.loser}
              {...actions}
            />
          </div>
        </div>
      </div>
    );
  }
);

/* =========================================================
   HISTORIQUE
========================================================= */

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? ''
    : date.toLocaleDateString(
        'fr-FR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
      );
}

function formatDuration(
  seconds: number
) {
  return `${Math.floor(
    seconds / 60
  )}:${String(
    seconds % 60
  ).padStart(2, '0')}`;
}

function roleIndex(
  role: string | null
) {
  const index = ROLES.findIndex(
    (item) => item.name === role
  );

  return index === -1
    ? 99
    : index;
}

function History({
  history,
  roundNames,
}: {
  history: HistoryMatch[];
  roundNames: Map<
    number,
    string
  >;
}) {
  const [
    showAll,
    setShowAll,
  ] = useState(false);

  const matches =
    history.filter(
      (match) =>
        match.team1 &&
        match.team2
    );

  const visible = showAll
    ? matches
    : matches.slice(
        0,
        HISTORY_PREVIEW
      );

  return (
    <div
      className={`${ds.card} ${styles.history}`}
    >
      <BlockHead
        label="Matchs terminés"
        title="Historique"
        aside={`${matches.length} match${
          matches.length > 1
            ? 's'
            : ''
        }`}
      />

      {matches.length === 0 ? (
        <div className={ds.empty}>
          Aucun match enregistré pour le
          moment.
        </div>
      ) : (
        visible.map((match) => (
          <HistoryRow
            key={match.id}
            match={match}
            roundName={roundNames.get(
              match.id
            )}
          />
        ))
      )}

      {matches.length >
        HISTORY_PREVIEW && (
        <button
          type="button"
          className={ds.cardFooter}
          onClick={() =>
            setShowAll(!showAll)
          }
        >
          {showAll
            ? 'Réduire'
            : `Voir les ${matches.length} matchs`}
        </button>
      )}
    </div>
  );
}

function HistoryRow({
  match,
  roundName,
}: {
  match: HistoryMatch;
  roundName?: string;
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    games,
    setGames,
  ] = useState<
    Game[] | null
  >(null);

  const [
    detailsError,
    setDetailsError,
  ] = useState('');

  const team1 = match.team1!;
  const team2 = match.team2!;

  function toggle() {
    if (!open && !games) {
      setDetailsError('');

      loadGames(match.id)
        .then(setGames)
        .catch((err) =>
          setDetailsError(
            err?.message ||
              'Impossible de charger le match.'
          )
        );
    }

    setOpen(!open);
  }

  const forfeitId = match.forfeitTeamId ?? null;

  const scoreClass = (
    teamId: number
  ) =>
    match.winner?.id === teamId
      ? styles.scoreWin
      : match.winner
        ? styles.scoreLoss
        : '';

  return (
    <div
      className={
        styles.historyItem
      }
    >
      <button
        type="button"
        className={
          styles.historyRow
        }
        onClick={toggle}
        onMouseEnter={() =>
          loadGames(
            match.id
          ).catch(() => {})
        }
        aria-expanded={open}
      >
        <span
          className={
            styles.historyMeta
          }
        >
          <span
            className={
              match.stage ===
              'pool'
                ? styles.stageChip
                : styles.stageChipPlayoff
            }
          >
            {match.stage ===
            'pool'
              ? 'Poule'
              : roundName ??
                'Playoff'}
          </span>

          <small>
            {formatDate(
              match.playedAt
            )}
          </small>
        </span>

        <span
          className={
            styles.historyTeam
          }
        >
          <span
            className={
              styles.historyTeamName
            }
          >
            <strong>
              {
                team1.shortName
              }
            </strong>

            <small>
              {team1.name}
            </small>
          </span>

          <TeamLogo
            logo={team1.logo}
          />
        </span>

        <span
          className={
            styles.historyScore
          }
        >
          <span
            className={scoreClass(
              team1.id
            )}
          >
            {forfeitId === team1.id ? 'FF' : team1.score}
          </span>

          <i>-</i>

          <span
            className={scoreClass(
              team2.id
            )}
          >
            {forfeitId === team2.id ? 'FF' : team2.score}
          </span>
        </span>

        <span
          className={`${styles.historyTeam} ${styles.historyTeamRight}`}
        >
          <TeamLogo
            logo={team2.logo}
          />

          <span
            className={
              styles.historyTeamName
            }
          >
            <strong>
              {
                team2.shortName
              }
            </strong>

            <small>
              {team2.name}
            </small>
          </span>
        </span>

        <span
          className={
            styles.historyToggle
          }
        >
          {open
            ? 'Fermer'
            : 'Détails'}{' '}
          <ChevronIcon
            open={open}
          />
        </span>
      </button>

      {open && (
        <div
          className={`${ds.onDark} ${styles.historyDetails}`}
        >
          {detailsError && (
            <p
              className={
                styles.detailsState
              }
            >
              {detailsError}
            </p>
          )}

          {!games &&
            !detailsError && (
              <p
                className={
                  styles.detailsState
                }
              >
                Chargement…
              </p>
            )}

          {games && forfeitId !== null && (
            <p className={styles.detailsState}>
              Forfait de {forfeitId === team1.id ? team1.name : team2.name} : aucune game jouée, le BO ne compte pas dans les stats.
            </p>
          )}

          {games?.map(
            (game) => (
              <GameDetails
                key={game.id}
                game={game}
                team1={team1}
                team2={team2}
              />
            )
          )}

          {games && forfeitId === null && (
            <div
              className={
                styles.mvpLine
              }
            >
              <span>
                MVP du BO
              </span>

              <strong>
                {match.mvpRiotId
                  ? splitRiotId(
                      match.mvpRiotId
                    ).name
                  : '—'}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameDetails({
  game,
  team1,
  team2,
}: {
  game: Game;
  team1: MatchSide;
  team2: MatchSide;
}) {
  const sidePlayers = (
    teamId: number
  ) =>
    game.players
      .filter(
        (player) =>
          player.teamId ===
          teamId
      )
      .sort(
        (a, b) =>
          roleIndex(a.role) -
          roleIndex(b.role)
      );

  return (
    <div className={styles.game}>
      <div
        className={
          styles.gameHead
        }
      >
        <strong>
          Game {game.gameNumber}
        </strong>

        <span>
          {formatDuration(
            game.durationSeconds
          )}
        </span>

        <em>
          Victoire{' '}
          {game.winnerName ??
            '—'}
        </em>
      </div>

      <div
        className={
          styles.gameTeams
        }
      >
        {[team1, team2].map(
          (team) => (
            <div
              key={team.id}
              className={`${styles.gameTeam} ${
                game.winnerTeamId ===
                team.id
                  ? styles.gameTeamWin
                  : ''
              }`}
            >
              <div
                className={
                  styles.gameTeamName
                }
              >
                {
                  team.shortName
                }
              </div>

              {sidePlayers(
                team.id
              ).map(
                (
                  player,
                  index
                ) => (
                  <div
                    key={`${
                      player.playerId ??
                      'sub'
                    }-${index}`}
                    className={
                      styles.gamePlayer
                    }
                  >
                    {player.championImage ? (
                      <img
                        src={
                          player.championImage
                        }
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className={
                          styles.championEmpty
                        }
                      />
                    )}

                    <span
                      className={
                        styles.gamePlayerName
                      }
                    >
                      {player.isSub ? (
                        <em
                          className={
                            styles.subChip
                          }
                        >
                          Sub
                        </em>
                      ) : (
                        splitRiotId(
                          player.riotId
                        ).name
                      )}

                      <small>
                        {
                          player.championName
                        }
                      </small>
                    </span>

                    <span
                      className={
                        styles.gameKda
                      }
                    >
                      {
                        player.kills
                      }
                      /
                      {
                        player.deaths
                      }
                      /
                      {
                        player.assists
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}