'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import { DIVISION_COLORS } from '@/app/components/home/divisions';
import { ChevronIcon } from '@/app/components/ds/LolUi';
import { ChampionRowsModal } from '@/app/results/shared';
import {
  divisionFromPoints,
  findMemberPlayer,
  formatRank,
  normalizeRiotId,
  roleInfo,
  ROLES,
  splitRiotId,
  teamDivision,
  TIERS,
} from '@/app/components/ds/lol';
import FixtureCard, { type Fixture, type GameSlot, type MvpFixture } from './FixtureCard';
import styles from './my-team.module.css';

const TEAM_SIZE = 5;
const FIXTURES_OPEN_KEY = 'czf-my-team-fixtures-open';

type Season = { id: number; name: string; status: string };

// Réponse de /api/stats-equipe/[id].
type CzfChampion = {
  championId: string;
  name: string;
  image: string | null;
  roles: string[];
  games: number;
  winRate: number;
  kda: number;
};
type TeamChampions = {
  team: CzfChampion[];
  byRole: Record<string, CzfChampion[]>;
  players: Record<number, CzfChampion[]>;
};

// Champions affichés au bout de chaque ligne du roster, et dans le bloc équipe.
const ROSTER_CHAMPIONS = 5;
const TEAM_TOP_CHAMPIONS = 10;
type Feedback = { text: string; error: boolean } | null;

async function authFetch(url: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('Connexion nécessaire.');

  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();

  if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de chargement.');

  return json;
}

export default function MyTeamView() {
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [leaving, setLeaving] = useState(false);

  const [season, setSeason] = useState<Season | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState('');
  const [gameSlots, setGameSlots] = useState<GameSlot[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [mvpFixtures, setMvpFixtures] = useState<MvpFixture[]>([]);
  const [mvpLoading, setMvpLoading] = useState(false);
  const [mvpError, setMvpError] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [fixturesOpen, setFixturesOpen] = useState(true);

  // Bloc rencontres réduit ou non : retenu dans ce navigateur.
  useEffect(() => {
    try {
      if (localStorage.getItem(FIXTURES_OPEN_KEY) === 'false') setFixturesOpen(false);
    } catch {}
  }, []);

  function toggleFixtures() {
    const next = !fixturesOpen;

    setFixturesOpen(next);
    try {
      localStorage.setItem(FIXTURES_OPEN_KEY, String(next));
    } catch {}
  }

  async function loadData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      if (!session?.user) return;

      const [teamsRes, membersRes, playersRes] = await Promise.all([
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
        fetch('/api/players?view=list').then((res) => res.json()),
      ]);

      setTeams(teamsRes.success ? teamsRes.data || [] : []);
      setMembers(membersRes.success ? membersRes.data || [] : []);
      setPlayers(playersRes.success ? playersRes.data || [] : []);
    } catch (error) {
      console.error('[MY TEAM]', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const player = useMemo(
    () => (user ? players.find((p) => p.profile_id === user.id) || null : null),
    [players, user]
  );

  // Équipe du joueur : capitaine, sinon membre (par player_id ou Riot ID).
  const team = useMemo(() => {
    if (!player) return null;

    const riotId = normalizeRiotId(player.riot_id);
    const membership = members.find((m) =>
      m.player_id !== null && m.player_id !== undefined
        ? Number(m.player_id) === Number(player.id)
        : normalizeRiotId(m.riot_id) === riotId
    );

    return (
      teams.find((t) => Number(t.captain_player_id) === Number(player.id)) ||
      teams.find((t) => Number(t.id) === Number(membership?.team_id)) ||
      null
    );
  }, [player, members, teams]);

  const teamId = team?.id ?? null;

  // Champions joués en CZF par l'équipe et ses joueurs ; null tant que non chargés.
  const [teamChampions, setTeamChampions] = useState<TeamChampions | null>(null);
  const [allChampionsOpen, setAllChampionsOpen] = useState(false);
  const closeAllChampions = useCallback(() => setAllChampionsOpen(false), []);
  // null : tous les rôles.
  const [championRole, setChampionRole] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;

    let active = true;

    fetch(`/api/stats-equipe/${teamId}`)
      .then((res) => res.json())
      .then((json) => {
        if (active) setTeamChampions(json.success ? json : { team: [], byRole: {}, players: {} });
      })
      .catch(() => {
        if (active) setTeamChampions({ team: [], byRole: {}, players: {} });
      });

    return () => {
      active = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (teamId === null) return;
    void Promise.all([loadFixtures(), loadGames(), loadMvp()]);
  }, [teamId]);

  async function loadFixtures() {
    setFixturesLoading(true);
    setFixturesError('');

    try {
      const json = await authFetch('/api/my-fixtures');
      setFixtures(json.fixtures || []);
      setSeason(json.season || null);
    } catch (error: any) {
      setFixturesError(error?.message || 'Impossible de charger les rencontres.');
      setFixtures([]);
    } finally {
      setFixturesLoading(false);
    }
  }

  async function loadGames() {
    setGamesLoading(true);

    try {
      const json = await authFetch('/api/my-fixtures/games');
      setGameSlots(json.slots || []);
    } catch (error) {
      console.error('[MY GAMES]', error);
      setGameSlots([]);
    } finally {
      setGamesLoading(false);
    }
  }

  async function prepareGames(fixtureId: number) {
    await authFetch('/api/my-fixtures/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureId }),
    });
    await loadGames();
  }

  async function loadMvp() {
    setMvpLoading(true);
    setMvpError('');

    try {
      const json = await authFetch('/api/mvp');
      setMvpFixtures(Array.isArray(json.fixtures) ? json.fixtures : []);
    } catch (error: any) {
      setMvpError(error?.message || 'Impossible de charger les MVP.');
      setMvpFixtures([]);
    } finally {
      setMvpLoading(false);
    }
  }

  const isCaptain = !!team && !!player && Number(team.captain_player_id) === Number(player.id);

  const roster = useMemo(() => {
    const teamMembers = members.filter((m) => Number(m.team_id) === Number(teamId));
    const slots = ROLES.map((role) => {
      const member = teamMembers.find((m) => m.role === role.name) || null;
      return { role, member, player: findMemberPlayer(member, players) };
    });
    const points = teamMembers.reduce(
      (total, m) => total + (findMemberPlayer(m, players)?.czf_points || 0),
      0
    );

    return { slots, count: teamMembers.length, points };
  }, [members, players, teamId]);

  async function leaveTeam() {
    if (!team || !player || isCaptain) return;
    if (!window.confirm(`Quitter l'équipe ${team.name} ?`)) return;

    setLeaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/team-members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.id, riot_id: player.riot_id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error();

      setFeedback({ text: 'Tu as quitté l’équipe.', error: false });
      await loadData();
    } catch {
      setFeedback({ text: 'Impossible de quitter l’équipe.', error: true });
    } finally {
      setLeaving(false);
    }
  }

  const pendingFixtures = fixtures
    .filter((f) => f.status !== 'completed' && f.status !== 'cancelled')
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return a.id - b.id;
    });

  const completedFixtures = fixtures.filter((f) => f.status === 'completed').sort((a, b) => b.id - a.id);

  function renderFixture(fixture: Fixture) {
    const involved =
      Number(team?.id) === Number(fixture.team1.id) || Number(team?.id) === Number(fixture.team2.id);

    return (
      <FixtureCard
        key={fixture.id}
        fixture={fixture}
        slots={gameSlots.filter((slot) => Number(slot.fixtureId) === Number(fixture.id))}
        gamesLoading={gamesLoading}
        mvp={mvpFixtures.find((item) => Number(item.fixtureId) === Number(fixture.id)) || null}
        mvpLoading={mvpLoading}
        canManage={isCaptain && involved}
        onSaved={loadFixtures}
        onPrepare={prepareGames}
        onMvpChanged={loadMvp}
      />
    );
  }

  if (loading) {
    return (
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={`${ds.card} ${ds.empty}`}>Chargement de ton équipe…</div>
        </div>
      </header>
    );
  }

  if (!user || !player || !team) {
    return (
      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Mon équipe</div>
            <h1 className={ds.h1}>Mon équipe</h1>
            <p className={ds.body}>
              Ton roster, tes rencontres à programmer et les MVP de tes matchs.
            </p>
            {feedback && (
              <p className={`${feedback.error ? ds.formError : ds.formInfo} ${styles.feedback}`}>
                {feedback.text}
              </p>
            )}
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            {!user ? (
              <>
                <div className={ds.cardTitle}>Non connecté</div>
                <p className={styles.text}>Connecte-toi avec Discord pour voir ton équipe.</p>
                <Link href="/login" className={ds.btnPrimary}>
                  Se connecter
                </Link>
              </>
            ) : !player ? (
              <>
                <div className={ds.cardTitle}>Pas encore de profil</div>
                <p className={styles.text}>Crée d’abord ton profil joueur avec ton Riot ID.</p>
                <Link href="/players" className={ds.btnPrimary}>
                  Créer mon profil
                </Link>
              </>
            ) : (
              <>
                <div className={ds.cardTitle}>Pas encore d’équipe</div>
                <p className={styles.text}>
                  Crée ton équipe et deviens capitaine, ou postule dans une équipe qui recrute.
                </p>
                <Link href="/teams" className={ds.btnPrimary}>
                  Créer mon équipe
                </Link>
                <Link href="/teams" className={ds.btnOutline}>
                  Voir les équipes
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  const official = teamDivision(team);
  const complete = roster.count >= TEAM_SIZE;
  // Sans division officielle, on l'estime pour une équipe complète.
  const division = official ?? (complete ? divisionFromPoints(roster.points) : null);

  // Champions de l'équipe, tous rôles ou pour le rôle filtré.
  const shownChampions = championRole
    ? teamChampions?.byRole[championRole] ?? []
    : teamChampions?.team ?? [];
  const championRoleLabel = championRole ? roleInfo(championRole)?.label ?? championRole : null;

  return (
    <>
      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>{season?.name || 'Saison 1'} · Mon équipe</div>

            <div className={styles.teamHead}>
              {team.logo_url && <img src={team.logo_url} alt="" className={styles.teamLogo} />}
              <h1 className={`${ds.h1} ${styles.teamName}`}>{team.name}</h1>
            </div>

            <div className={styles.teamMeta}>
              <span>Capitaine · {team.captain_riot_id || '—'}</span>
              {!team.validated_by_admin && <span>En attente de validation</span>}
            </div>

            {team.description && <p className={`${ds.body} ${styles.description}`}>{team.description}</p>}
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            <div className={styles.stats}>
              <div>
                <span>Division</span>
                <strong>
                  {division ? (
                    <>
                      <span className={ds.teamDot} style={{ background: DIVISION_COLORS[division] }} />
                      {division}
                      {!official && <small>estimée</small>}
                    </>
                  ) : (
                    'À définir'
                  )}
                </strong>
              </div>
              <div>
                <span>Total CZF</span>
                <strong>{roster.points} pts</strong>
              </div>
              <div>
                <span>Effectif</span>
                <strong>
                  {roster.count}/{TEAM_SIZE}
                </strong>
              </div>
            </div>

            <div className={styles.sideActions}>
              {isCaptain && (
                <Link href={`/teams?team=${team.id}`} className={ds.btnPrimary}>
                  Gérer l’équipe
                </Link>
              )}
              {team.multigg_url && (
                <a href={team.multigg_url} target="_blank" rel="noreferrer" className={ds.btnOutline}>
                  MultiGG
                </a>
              )}
              {!isCaptain && (
                <button type="button" className={ds.btnDanger} onClick={leaveTeam} disabled={leaving}>
                  {leaving ? 'Départ…' : 'Quitter l’équipe'}
                </button>
              )}
            </div>

            {feedback && <p className={feedback.error ? ds.formError : ds.formInfo}>{feedback.text}</p>}
          </div>
        </div>
      </header>

      {/* ROSTER */}
      <section className={styles.section}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Roster</div>
          <h2 className={styles.h2}>Les joueurs</h2>

          <div className={`${ds.card} ${styles.roster}`}>
            {roster.slots.map(({ role, member, player: rosterPlayer }) => {
              const riotId = rosterPlayer?.riot_id || member?.riot_id || '';
              const { name, tag } = splitRiotId(riotId);
              const rank = formatRank(rosterPlayer?.soloq_tier, rosterPlayer?.soloq_rank, rosterPlayer?.soloq_lp);
              const captain = rosterPlayer && Number(rosterPlayer.id) === Number(team.captain_player_id);
              const me = rosterPlayer && Number(rosterPlayer.id) === Number(player.id);

              return (
                <div key={role.name} className={styles.rosterRow}>
                  <span className={styles.rosterRole}>
                    <img src={role.image} alt="" className={ds.roleIcon} />
                    {role.label}
                  </span>

                  {member ? (
                    <>
                      <span className={styles.rosterPlayer}>
                        {rosterPlayer ? (
                          <Link href={`/players/${rosterPlayer.id}`} className={`${styles.rosterName} ${styles.rosterLink}`}>
                            {name}
                            {tag && <small>#{tag}</small>}
                            {me && <span className={ds.meChip}>Moi</span>}
                          </Link>
                        ) : (
                          <span className={styles.rosterName}>
                            {name}
                            {tag && <small>#{tag}</small>}
                          </span>
                        )}
                        <span className={styles.rosterSub}>
                          {captain && <span className={styles.captain}>Capitaine</span>}
                          {rosterPlayer?.profiles?.discord_name}
                        </span>
                      </span>

                      <span className={styles.rosterRank}>
                        {rank ? (
                          <>
                            <img src={TIERS[rosterPlayer.soloq_tier]?.icon} alt="" className={ds.rankIcon} />
                            {rank}
                          </>
                        ) : (
                          <span className={ds.muted}>Non classé</span>
                        )}
                      </span>

                      <span className={styles.rosterPoints}>
                        {rosterPlayer?.czf_points ?? '—'}
                        <small>pts</small>
                      </span>

                      <span className={styles.rosterPool}>
                        <PlayedChampions
                          champions={
                            teamChampions && rosterPlayer
                              ? teamChampions.players[Number(rosterPlayer.id)] ?? []
                              : null
                          }
                        />
                      </span>
                    </>
                  ) : (
                    <span className={`${styles.rosterPlayer} ${ds.muted}`}>Place libre</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* CHAMPIONS DE L'ÉQUIPE */}
          <div className={styles.teamChampionsHead}>
            <div>
              <div className={ds.sectionLabel}>Draft</div>
              <h2 className={styles.h2}>Champions de l’équipe</h2>
            </div>
            {shownChampions.length > TEAM_TOP_CHAMPIONS && (
              <button
                type="button"
                className={`${ds.btnOutline} ${ds.btnSmall}`}
                onClick={() => setAllChampionsOpen(true)}
              >
                Voir plus ({shownChampions.length})
              </button>
            )}
          </div>

          {teamChampions && teamChampions.team.length > 0 && (
            <div className={`${ds.tabs} ${ds.filterRowLast}`}>
              <button
                type="button"
                className={championRole === null ? ds.tabActive : ds.tab}
                onClick={() => setChampionRole(null)}
              >
                Tous
              </button>
              {ROLES.map((role) => (
                <button
                  key={role.name}
                  type="button"
                  className={championRole === role.name ? ds.tabActive : ds.tab}
                  onClick={() => setChampionRole(role.name)}
                >
                  <img src={role.image} alt="" className={ds.tabRoleIcon} />
                  {role.label}
                </button>
              ))}
            </div>
          )}

          {teamChampions === null ? (
            <div className={`${ds.card} ${ds.empty}`}>Chargement des champions…</div>
          ) : teamChampions.team.length === 0 ? (
            <div className={`${ds.card} ${ds.empty}`}>Aucune game CZF jouée pour le moment.</div>
          ) : shownChampions.length === 0 ? (
            <div className={`${ds.card} ${ds.empty}`}>Aucun champion joué en {championRoleLabel}.</div>
          ) : (
            <div className={styles.teamChampions}>
              {shownChampions.slice(0, TEAM_TOP_CHAMPIONS).map((champion, index) => (
                <div key={champion.championId} className={`${ds.card} ${styles.teamChampion}`}>
                  <span className={styles.teamChampionRank}>#{index + 1}</span>
                  {champion.image ? (
                    <img src={champion.image} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.championEmpty} />
                  )}
                  <strong>{champion.name}</strong>
                  <small>
                    {champion.games} game{champion.games > 1 ? 's' : ''}
                  </small>
                  <div className={styles.teamChampionStats}>
                    <span>
                      <small>Win</small>
                      {Math.round(champion.winRate)}%
                    </span>
                    <span>
                      <small>KDA</small>
                      {champion.kda.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {allChampionsOpen && teamChampions && (
            <ChampionRowsModal
              title={team.name}
              image={team.logo_url || null}
              meta={`${shownChampions.length} champions joués en CZF${
                championRoleLabel ? ` · ${championRoleLabel}` : ''
              }`}
              label="Champion"
              rowImage="champion"
              rows={shownChampions.map((champion) => ({
                key: champion.championId,
                image: champion.image,
                name: champion.name,
                sub: champion.roles.map((role) => roleInfo(role)?.label ?? role).join(' · '),
                games: champion.games,
                winRate: champion.winRate,
                kda: champion.kda,
              }))}
              onClose={closeAllChampions}
            />
          )}
        </div>
      </section>

      {/* RENCONTRES */}
      <section className={styles.section}>
        <div className={ds.container}>
          <div className={styles.fixturesHead}>
            <div>
              <div className={ds.sectionLabel}>{season?.name || 'Saison 1'} · Calendrier</div>
              <h2 className={styles.h2}>Mes rencontres</h2>
            </div>
            <div className={styles.fixturesTools}>
              <span className={styles.counter}>
                <strong>{pendingFixtures.length}</strong> à jouer
              </span>
              <button
                type="button"
                className={`${ds.btnOutline} ${ds.btnSmall}`}
                onClick={toggleFixtures}
                aria-expanded={fixturesOpen}
              >
                {fixturesOpen ? 'Réduire' : 'Afficher'}
                <ChevronIcon open={fixturesOpen} />
              </button>
            </div>
          </div>

          {fixturesOpen && fixturesError && (
            <p className={`${ds.formError} ${styles.feedback}`}>{fixturesError}</p>
          )}

          {!fixturesOpen ? null : fixturesLoading ? (
            <div className={`${ds.card} ${ds.empty}`}>Chargement des rencontres…</div>
          ) : (
            <>
              {pendingFixtures.length === 0 ? (
                <div className={`${ds.card} ${ds.empty}`}>Aucune rencontre à organiser.</div>
              ) : (
                <div className={styles.fixtures}>{pendingFixtures.map(renderFixture)}</div>
              )}

              {completedFixtures.length > 0 && (
                <div className={styles.completed}>
                  <button
                    type="button"
                    className={ds.btnOutline}
                    onClick={() => setShowCompleted((value) => !value)}
                    aria-expanded={showCompleted}
                  >
                    Matchs terminés ({completedFixtures.length})
                    <ChevronIcon open={showCompleted} />
                  </button>

                  {showCompleted && (
                    <>
                      {mvpError && (
                        <p className={`${ds.formError} ${styles.feedback}`}>
                          Informations MVP indisponibles : {mvpError}
                        </p>
                      )}
                      <div className={styles.fixtures}>{completedFixtures.map(renderFixture)}</div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

// Champions les plus joués en CZF par un joueur de l'équipe, avec le nombre de games.
function PlayedChampions({ champions }: { champions: CzfChampion[] | null }) {
  if (champions === null) return null;
  if (champions.length === 0) return <span className={`${styles.playedEmpty} ${ds.muted}`}>Aucune game</span>;

  return (
    <span className={styles.played}>
      {champions.slice(0, ROSTER_CHAMPIONS).map((champion) => (
        <span
          key={champion.championId}
          className={styles.playedChampion}
          title={`${champion.name} · ${champion.games} game${champion.games > 1 ? 's' : ''}`}
        >
          {champion.image ? <img src={champion.image} alt={champion.name} loading="lazy" /> : <span />}
          <b>{champion.games}</b>
        </span>
      ))}
    </span>
  );
}
