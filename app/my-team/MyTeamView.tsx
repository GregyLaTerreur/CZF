'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import { DIVISION_COLORS } from '@/app/components/home/divisions';
import { ChevronIcon, useDdragonVersion } from '@/app/components/ds/LolUi';
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
  multiOpggUrl,
} from '@/app/components/ds/lol';
import FixtureCard, { type Fixture, type GameSlot, type MvpFixture } from './FixtureCard';
import styles from './my-team.module.css';
import { logoSrc } from '@/lib/logo';

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
// Liste en deux colonnes de 5.
const TEAM_TOP_CHAMPIONS = 10;
const CHAMPIONS_PER_COLUMN = 5;
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

  if (!res.ok || !json.success) throw new Error(json.message || json.error || 'Erreur de chargement.');

  return json;
}

// Sans teamId : l'équipe du joueur connecté (/my-team).
// Avec teamId : la page publique d'une équipe (/teams/[id]) ; gestion seulement si c'est la sienne.
export default function MyTeamView({ teamId: viewedTeamId }: { teamId?: number } = {}) {
  const router = useRouter();
  const ddragonVersion = useDdragonVersion();
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  // Riot ID modifiables, par id de ligne team_members.
  const [editRiotIds, setEditRiotIds] = useState<Record<number, string>>({});
  const [editError, setEditError] = useState('');

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
      // La page publique d'une équipe se consulte sans être connecté.
      if (!session?.user && !viewedTeamId) return;

      const [teamsRes, membersRes, playersRes, requestsRes] = await Promise.all([
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
        fetch('/api/players?view=list').then((res) => res.json()),
        fetch('/api/team-join-requests').then((res) => res.json()),
      ]);

      setTeams(teamsRes.success ? teamsRes.data || [] : []);
      setMembers(membersRes.success ? membersRes.data || [] : []);
      setPlayers(playersRes.success ? playersRes.data || [] : []);
      setJoinRequests(requestsRes.success ? requestsRes.data || [] : []);
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
  const myTeam = useMemo(() => {
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

  const team = viewedTeamId
    ? teams.find((t) => Number(t.id) === viewedTeamId) || null
    : myTeam;
  const isMine = Boolean(team && myTeam) && Number(team.id) === Number(myTeam.id);
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

  // Rencontres et MVP : seulement pour sa propre équipe (routes liées au joueur connecté).
  useEffect(() => {
    if (teamId === null || !isMine) return;
    void Promise.all([loadFixtures(), loadGames(), loadMvp()]);
  }, [teamId, isMine]);

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

  const isCaptain = isMine && !!player && Number(team.captain_player_id) === Number(player.id);

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

  const pendingRequests = joinRequests.filter(
    (request) => Number(request.team_id) === Number(teamId) && request.status === 'pending'
  );

  // Appel d'API avec message de retour, puis rechargement.
  async function run(action: () => Promise<Response>, success: string) {
    setBusy(true);
    setFeedback(null);

    try {
      const res = await action();
      const data = await res.json();

      if (!data.success) throw new Error(data.message || data.error?.message || 'Erreur.');

      setFeedback({ text: success, error: false });
      await loadData();
      return true;
    } catch (error: any) {
      setFeedback({ text: error?.message || 'Erreur.', error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function jsonRequest(url: string, method: string, body: unknown) {
    return () =>
      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
  }

  function leaveTeam() {
    if (!team || !player || isCaptain) return;
    if (!window.confirm(`Quitter l'équipe ${team.name} ?`)) return;

    void run(
      jsonRequest('/api/team-members', 'DELETE', { team_id: team.id, riot_id: player.riot_id }),
      'Tu as quitté l’équipe.'
    );
  }

  function removeMember(riotId: string) {
    if (!window.confirm(`Retirer ${riotId} de l'équipe ?`)) return;

    void run(
      jsonRequest('/api/team-members', 'DELETE', { team_id: team.id, riot_id: riotId }),
      'Joueur retiré.'
    );
  }

  function answerRequest(requestId: number, action: 'accept' | 'reject') {
    void run(
      jsonRequest('/api/team-join-requests', 'PATCH', { request_id: requestId, action }),
      action === 'accept' ? 'Joueur accepté.' : 'Demande refusée.'
    );
  }

  function requestJoin() {
    void run(
      jsonRequest('/api/team-join-requests', 'POST', {
        team_id: team.id,
        riot_id: player.riot_id,
        role: player.main_role,
        profile_id: user.id,
        player_id: player.id,
      }),
      'Demande envoyée au capitaine.'
    );
  }

  function startEditing() {
    setEditName(team.name || '');
    setEditTag(team.tag || '');
    setEditLogo(team.logo_url || '');
    setEditDescription(team.description || '');
    setEditRiotIds(
      Object.fromEntries(
        roster.slots
          .filter(({ member }) => member)
          .map(({ member, player: rosterPlayer }) => [member.id, rosterPlayer?.riot_id || member.riot_id || ''])
      )
    );
    setEditError('');
    setFeedback(null);
    setEditing(true);
  }

  const closeEditing = useCallback(() => setEditing(false), []);

  async function saveTeam(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setEditError('');

    const errors: string[] = [];

    try {
      const res = await jsonRequest('/api/teams', 'PATCH', {
        team_id: team.id,
        name: editName,
        tag: editTag,
        description: editDescription,
        logo_url: editLogo,
      })();
      const data = await res.json();

      if (!data.success) throw new Error(data.message || data.error?.message || 'Impossible de modifier l’équipe.');

      // Riot ID changés : un appel par joueur, vérifié chez Riot.
      for (const { member, player: rosterPlayer } of roster.slots) {
        if (!member) continue;

        const next = String(editRiotIds[member.id] || '').trim();
        const current = rosterPlayer?.riot_id || member.riot_id || '';
        if (!next || normalizeRiotId(next) === normalizeRiotId(current)) continue;

        try {
          await authFetch('/api/team-members/riot-id', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: member.id, riot_id: next }),
          });
        } catch (error: any) {
          errors.push(`${next} : ${error?.message || 'erreur.'}`);
        }
      }
    } catch (error: any) {
      errors.push(error?.message || 'Erreur.');
    }

    await loadData();
    setBusy(false);

    if (errors.length) {
      setEditError(errors.join(' '));
    } else {
      setEditing(false);
      setFeedback({ text: 'Équipe modifiée.', error: false });
    }
  }

  async function deleteTeam() {
    if (!window.confirm('Supprimer définitivement cette équipe ?')) return;

    const ok = await run(jsonRequest('/api/teams/delete', 'DELETE', { team_id: team.id }), 'Équipe supprimée.');
    if (ok) router.push('/teams');
  }

  // Pourquoi le joueur connecté ne peut pas postuler (null : il peut).
  function joinBlockReason(): string | null {
    if (!user || !player) return 'Connecte-toi et crée ton profil joueur pour postuler.';
    if (myTeam) return 'Tu es déjà dans une équipe.';
    if (roster.count >= TEAM_SIZE) return 'L’équipe est complète.';
    if (roster.slots.some(({ role, member }) => member && role.name === player.main_role)) {
      return `Le poste ${player.main_role} est déjà occupé.`;
    }

    const pending = joinRequests.some(
      (request) =>
        Number(request.team_id) === Number(teamId) &&
        Number(request.player_id) === Number(player.id) &&
        request.status === 'pending'
    );

    return pending ? 'Ta demande est en attente de réponse du capitaine.' : null;
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

  if (viewedTeamId && !team) {
    return (
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Saison 1 · Équipe</div>
          <div className={`${ds.card} ${ds.empty}`}>Équipe introuvable.</div>
        </div>
      </header>
    );
  }

  if (!team) {
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
  const blockReason = isMine ? null : joinBlockReason();
  const opggUrl = multiOpggUrl(
    roster.slots.map(({ member, player: rosterPlayer }) => rosterPlayer?.riot_id || member?.riot_id)
  );
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
            <div className={ds.sectionLabel}>
              {season?.name || 'Saison 1'} · {isMine ? 'Mon équipe' : 'Équipe'}
            </div>

            <div className={styles.teamHead}>
              {team.logo_url && <img src={logoSrc(team.logo_url, 192)} alt="" className={styles.teamLogo} />}
              <h1 className={`${ds.h1} ${styles.teamName}`}>
                {team.name}
                {team.tag && <small className={styles.teamTag}>{team.tag}</small>}
              </h1>
            </div>

            {!team.validated_by_admin && (
              <div className={styles.teamMeta}>
                <span>En attente de validation</span>
              </div>
            )}

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
              {isCaptain && !editing && (
                <button type="button" className={ds.btnPrimary} onClick={startEditing} disabled={busy}>
                  Modifier l’équipe
                </button>
              )}
              {!isMine && !blockReason && (
                <button type="button" className={ds.btnPrimary} onClick={requestJoin} disabled={busy}>
                  Demander à rejoindre
                </button>
              )}
              {opggUrl && (
                <a href={opggUrl} target="_blank" rel="noreferrer" className={ds.btnOutline}>
                  MultiGG
                </a>
              )}
              {isMine && !isCaptain && (
                <button type="button" className={ds.btnDanger} onClick={leaveTeam} disabled={busy}>
                  Quitter l’équipe
                </button>
              )}
            </div>

            {blockReason && user && <p className={styles.blockReason}>{blockReason}</p>}

            {feedback && <p className={feedback.error ? ds.formError : ds.formInfo}>{feedback.text}</p>}
          </div>
        </div>
      </header>

      {/* ÉDITION (capitaine) */}
      {editing && (
        <EditTeamModal onClose={closeEditing}>
          <form className={styles.editForm} onSubmit={saveTeam}>
            <div className={styles.modalTitle}>Modifier l’équipe</div>

            <label className={ds.field}>
              <span>Nom de l’équipe</span>
              <input className={ds.input} value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <div className={styles.editRow}>
              <label className={ds.field}>
                <span>Tag (2 à 5 caractères)</span>
                <input
                  className={ds.input}
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={5}
                  placeholder="CZF"
                />
              </label>
              <label className={ds.field}>
                <span>URL du logo</span>
                <input className={ds.input} value={editLogo} onChange={(e) => setEditLogo(e.target.value)} />
              </label>
            </div>
            <label className={ds.field}>
              <span>Description</span>
              <textarea
                className={ds.input}
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>

            <div className={ds.field}>
              <span>Riot ID des joueurs</span>
              <div className={styles.editRiotIds}>
                {roster.slots
                  .filter(({ member }) => member)
                  .map(({ role, member }) => (
                    <label key={member.id} className={styles.editRiotId}>
                      <span className={styles.editRiotRole}>
                        <img src={role.image} alt="" className={ds.roleIcon} />
                        {role.label}
                      </span>
                      <input
                        className={ds.input}
                        value={editRiotIds[member.id] ?? ''}
                        onChange={(e) => setEditRiotIds({ ...editRiotIds, [member.id]: e.target.value })}
                        placeholder="Pseudo#TAG"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                  ))}
              </div>
              <small className={styles.editHint}>
                Chaque Riot ID modifié est vérifié chez Riot ; rang et points CZF sont recalculés.
              </small>
            </div>

            {editError && <p className={ds.formError}>{editError}</p>}

            <div className={ds.formActions}>
              <button type="submit" className={ds.btnPrimary} disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className={ds.btnOutline} disabled={busy} onClick={closeEditing}>
                Annuler
              </button>
              <button type="button" className={`${ds.btnDanger} ${styles.deleteTeam}`} disabled={busy} onClick={deleteTeam}>
                Supprimer l’équipe
              </button>
            </div>
          </form>
        </EditTeamModal>
      )}

      {/* DEMANDES REÇUES (capitaine) */}
      {isCaptain && pendingRequests.length > 0 && (
        <section className={styles.section}>
          <div className={ds.container}>
            <div className={ds.sectionLabel}>Recrutement</div>
            <h2 className={styles.h2}>Demandes reçues</h2>

            <div className={`${ds.card} ${styles.requests}`}>
              {pendingRequests.map((request) => {
                const { name, tag } = splitRiotId(request.riot_id);

                return (
                  <div key={request.id} className={styles.requestRow}>
                    <span className={styles.rosterName}>
                      {name}
                      {tag && <small>#{tag}</small>}
                    </span>
                    <span className={styles.rosterSub}>{roleInfo(request.role)?.label ?? request.role}</span>
                    <span className={styles.requestActions}>
                      <button
                        type="button"
                        className={`${ds.btnPrimary} ${ds.btnSmall}`}
                        disabled={busy}
                        onClick={() => answerRequest(request.id, 'accept')}
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        className={`${ds.btnOutline} ${ds.btnSmall}`}
                        disabled={busy}
                        onClick={() => answerRequest(request.id, 'reject')}
                      >
                        Refuser
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
              const me = rosterPlayer && player && Number(rosterPlayer.id) === Number(player.id);

              return (
                <div key={role.name} className={styles.rosterRow}>
                  <span className={styles.rosterRole}>
                    <img src={role.image} alt="" className={ds.roleIcon} />
                    {role.label}
                  </span>

                  {member ? (
                    <>
                      <span className={styles.rosterIdentity}>
                      {rosterPlayer?.profile_icon_id ? (
                        <img
                          src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${rosterPlayer.profile_icon_id}.png`}
                          alt=""
                          loading="lazy"
                          className={styles.summonerIcon}
                        />
                      ) : (
                        <span className={styles.summonerIcon} />
                      )}
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
                          {isCaptain && !captain && (
                            <button
                              type="button"
                              className={styles.removeMember}
                              disabled={busy}
                              onClick={() => removeMember(riotId)}
                            >
                              Retirer
                            </button>
                          )}
                        </span>
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
              {[0, CHAMPIONS_PER_COLUMN]
                .filter((offset) => offset < Math.min(shownChampions.length, TEAM_TOP_CHAMPIONS))
                .map((offset) => (
                  <div key={offset} className={`${ds.card} ${styles.championList}`}>
                    <div className={`${styles.championRow} ${styles.championListHead}`}>
                      <span>#</span>
                      <span />
                      <span>Champion</span>
                      <span>Games</span>
                      <span>Win</span>
                      <span>KDA</span>
                    </div>

                    {shownChampions.slice(offset, offset + CHAMPIONS_PER_COLUMN).map((champion, index) => (
                      <div key={champion.championId} className={styles.championRow}>
                        <span className={styles.championRank}>{offset + index + 1}</span>
                        {champion.image ? (
                          <img src={champion.image} alt="" loading="lazy" />
                        ) : (
                          <span className={styles.championEmpty} />
                        )}
                        <span className={styles.championName}>
                          <strong>{champion.name}</strong>
                          <small>
                            {champion.roles.map((role) => roleInfo(role)?.label ?? role).join(' · ')}
                          </small>
                        </span>
                        <strong>{champion.games}</strong>
                        <strong className={champion.winRate >= 50 ? ds.win : ds.loss}>
                          {Math.round(champion.winRate)}%
                        </strong>
                        <strong>{champion.kda.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          {allChampionsOpen && teamChampions && (
            <ChampionRowsModal
              title={team.name}
              image={logoSrc(team.logo_url, 192) || null}
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

      {/* RENCONTRES (sa propre équipe) — masqué pour le moment */}
      {isMine && (
      <section className={styles.section} style={{ display: 'none' }}>
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
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.4" fill="none" />
    </svg>
  );
}

// Fenêtre d'édition : Échap ou clic à côté ferme, la page derrière ne défile plus.
function EditTeamModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${ds.onDark}`}
        role="dialog"
        aria-modal="true"
        aria-label="Modifier l’équipe"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
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
