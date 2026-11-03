'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getMyDivision } from '@/app/components/ds/myDivision';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import {
  ROLES,
  TIERS,
  divisionFromPoints,
  findMemberPlayer,
  formatRank,
  normalizeRiotId,
  splitRiotId,
  teamDivision,
  multiOpggUrl,
} from '@/app/components/ds/lol';
import styles from './teams.module.css';
import { logoSrc } from '@/lib/logo';

const TEAM_SIZE = 5;

type StatusFilter = 'complete' | 'incomplete' | null;

// Équipe enrichie : roster par rôle, points, division officielle ou estimée.
type TeamView = {
  team: any;
  members: any[];
  slots: { role: (typeof ROLES)[number]; member: any; player: any }[];
  count: number;
  complete: boolean;
  points: number;
  division: DivisionName | null;
  divisionOfficial: boolean;
  validated: boolean;
};

/* =========================================================
   VUE
========================================================= */

export default function TeamsView() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [validatedOnly, setValidatedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [divisionFilter, setDivisionFilter] = useState<DivisionName | null>(null);
  const divisionTouched = useRef(false);

  function chooseDivision(division: DivisionName | null) {
    divisionTouched.current = true;
    setDivisionFilter(division);
  }

  // Par défaut : la division de l'équipe du joueur connecté, tant qu'il n'a rien choisi.
  useEffect(() => {
    getMyDivision().then((mine) => {
      if (mine && !divisionTouched.current) setDivisionFilter(mine);
    });
  }, []);


  const loadData = useCallback(async () => {
    try {
      const [teamsRes, membersRes, requestsRes, playersRes] = await Promise.all([
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
        fetch('/api/team-join-requests').then((res) => res.json()),
        fetch('/api/players?view=list').then((res) => res.json()),
      ]);

      if (!teamsRes.success) throw new Error('Impossible de charger les équipes.');

      setTeams(teamsRes.data || []);
      setTeamMembers(membersRes.success ? membersRes.data || [] : []);
      setJoinRequests(requestsRes.success ? requestsRes.data || [] : []);
      setPlayers(playersRes.success ? playersRes.data || [] : []);
    } catch (error: any) {
      setLoadError(error?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Session locale : pas d'appel réseau, les routes d'API vérifient le jeton.
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    loadData();

    // Anciens liens /teams?team=ID : redirige vers la page de l'équipe.
    const teamParam = Number(new URLSearchParams(window.location.search).get('team'));
    if (Number.isInteger(teamParam) && teamParam > 0) router.replace(`/teams/${teamParam}`);
  }, [loadData, router]);

  const myPlayer = useMemo(
    () => (user ? players.find((player) => player.profile_id === user.id) || null : null),
    [players, user]
  );

  // Membre d'équipe correspondant au joueur connecté.
  const myMembership = useMemo(() => {
    if (!myPlayer) return null;

    const riotId = normalizeRiotId(myPlayer.riot_id);

    return (
      teamMembers.find((member) =>
        member.player_id !== null && member.player_id !== undefined
          ? Number(member.player_id) === Number(myPlayer.id)
          : normalizeRiotId(member.riot_id) === riotId
      ) || null
    );
  }, [myPlayer, teamMembers]);

  const teamViews = useMemo<TeamView[]>(() => {
    return teams.map((team) => {
      const members = teamMembers.filter((member) => Number(member.team_id) === Number(team.id));

      const slots = ROLES.map((role) => {
        const member = members.find((m) => m.role === role.name) || null;
        return { role, member, player: findMemberPlayer(member, players) };
      });

      const points = members.reduce(
        (total, member) => total + (findMemberPlayer(member, players)?.czf_points || 0),
        0
      );

      const complete = members.length >= TEAM_SIZE;
      const official = teamDivision(team);

      return {
        team,
        members,
        slots,
        count: members.length,
        complete,
        points,
        // Sans division officielle, on l'estime pour une équipe complète.
        division: official ?? (complete ? divisionFromPoints(points) : null),
        divisionOfficial: Boolean(official),
        validated: team.validated_by_admin === true,
      };
    });
  }, [teams, teamMembers, players]);

  const counts = useMemo(
    () => ({
      total: teamViews.length,
      validated: teamViews.filter((view) => view.validated).length,
      recruiting: teamViews.filter((view) => !view.complete).length,
    }),
    [teamViews]
  );

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teamViews
      .filter((view) => {
        if (
          query &&
          ![view.team.name, view.team.captain_riot_id, ...view.members.map((m) => m.riot_id)].some(
            (value) => String(value || '').toLowerCase().includes(query)
          )
        ) {
          return false;
        }

        if (validatedOnly && !view.validated) return false;
        if (statusFilter === 'complete' && !view.complete) return false;
        if (statusFilter === 'incomplete' && view.complete) return false;
        if (divisionFilter && view.division !== divisionFilter) return false;

        return true;
      })
      .sort(
        (a, b) =>
          Number(b.validated) - Number(a.validated) ||
          b.points - a.points ||
          String(a.team.name).localeCompare(String(b.team.name), 'fr')
      );
  }, [teamViews, search, validatedOnly, statusFilter, divisionFilter]);

  const myTeamView = myMembership
    ? teamViews.find((view) => Number(view.team.id) === Number(myMembership.team_id)) || null
    : null;

  function pendingRequestsFor(teamId: number) {
    return joinRequests.filter(
      (request) => Number(request.team_id) === Number(teamId) && request.status === 'pending'
    );
  }

  return (
    <>
      {/* =================================================
          EN-TÊTE
      ================================================= */}

      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Équipes</div>
            <h1 className={ds.h1}>Les équipes</h1>

            <div className={ds.counters}>
              <div className={ds.counter}>
                <strong>{loading ? '—' : counts.total}</strong>
                <span>Équipes</span>
              </div>
              <div className={ds.counter}>
                <strong>{loading ? '—' : counts.validated}</strong>
                <span>Validées</span>
              </div>
              <div className={ds.counter}>
                <strong className={ds.teal}>{loading ? '—' : counts.recruiting}</strong>
                <span>En recrutement</span>
              </div>
            </div>
          </div>

          <TeamActionCard
            user={user}
            myPlayer={myPlayer}
            myTeamView={myTeamView}
            onCreated={loadData}
          />
        </div>
      </header>

      {/* =================================================
          LISTE
      ================================================= */}

      <section className={ds.section}>
        <div className={ds.container}>
          <div className={ds.toolbar}>
            <input
              type="search"
              className={ds.search}
              placeholder="Rechercher une équipe, un capitaine, un joueur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={ds.tabs}>
              <button
                type="button"
                className={validatedOnly ? ds.tabActive : ds.tab}
                onClick={() => setValidatedOnly(!validatedOnly)}
                aria-pressed={validatedOnly}
              >
                Participants
              </button>

              <button
                type="button"
                className={statusFilter === 'complete' ? ds.tabActive : ds.tab}
                onClick={() => setStatusFilter(statusFilter === 'complete' ? null : 'complete')}
                aria-pressed={statusFilter === 'complete'}
              >
                Complètes
              </button>

              <button
                type="button"
                className={statusFilter === 'incomplete' ? ds.tabActive : ds.tab}
                onClick={() => setStatusFilter(statusFilter === 'incomplete' ? null : 'incomplete')}
                aria-pressed={statusFilter === 'incomplete'}
              >
                <span className={ds.dot} />
                Recrutent
              </button>
            </div>
          </div>

          <div className={`${ds.tabs} ${ds.filterRowLast}`}>
            <button
              type="button"
              className={divisionFilter === null ? ds.tabActive : ds.tab}
              onClick={() => chooseDivision(null)}
            >
              Toutes les divisions
            </button>

            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                className={divisionFilter === division ? ds.tabActive : ds.tab}
                onClick={() => chooseDivision(divisionFilter === division ? null : division)}
              >
                <span className={ds.dot} style={{ background: DIVISION_COLORS[division] }} />
                {division}
              </button>
            ))}
          </div>

          {loading && <div className={`${ds.card} ${ds.empty}`}>Chargement des équipes…</div>}
          {loadError && <div className={`${ds.card} ${ds.empty}`}>{loadError}</div>}

          {!loading && !loadError && filteredTeams.length === 0 && (
            <div className={`${ds.card} ${ds.empty}`}>Aucune équipe ne correspond à ces filtres.</div>
          )}

          <div className={styles.grid}>
            {filteredTeams.map((view) => (
              <TeamCard
                key={view.team.id}
                view={view}
                isMine={Number(myMembership?.team_id) === Number(view.team.id)}
                pendingCount={
                  view.team.captain_profile_id === user?.id
                    ? pendingRequestsFor(view.team.id).length
                    : 0
                }
                onOpen={() => router.push(`/teams/${view.team.id}`)}
              />
            ))}
          </div>

          {!loading && filteredTeams.length > 0 && (
            <p className={ds.resultCount}>
              {filteredTeams.length} équipe{filteredTeams.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>

    </>
  );
}

/* =========================================================
   CARTE D'ÉQUIPE
========================================================= */

function DivisionChip({ view }: { view: TeamView }) {
  if (!view.division) {
    return <span className={styles.divisionChip}>Division à définir</span>;
  }

  return (
    <span className={styles.divisionChip}>
      <span className={ds.teamDot} style={{ background: DIVISION_COLORS[view.division] }} />
      {view.division}
      {!view.divisionOfficial && <small> · estimée</small>}
    </span>
  );
}

function TeamCard({
  view,
  isMine,
  pendingCount,
  onOpen,
}: {
  view: TeamView;
  isMine: boolean;
  pendingCount: number;
  onOpen: () => void;
}) {
  const { team } = view;
  const opggUrl = rosterOpggUrl(view);

  return (
    // Toute la carte mène à la page de l'équipe, sauf le lien OP.GG.
    <div
      className={`${ds.card} ${styles.teamCard} ${view.validated ? '' : styles.teamCardPending}`}
      onClick={onOpen}
    >
      <button type="button" className={styles.teamCardMain}>
        <span className={styles.teamHead}>
          {team.logo_url ? (
            <img src={logoSrc(team.logo_url)} alt="" className={styles.teamLogo} loading="lazy" />
          ) : (
            <span className={styles.teamLogoEmpty} />
          )}

          <span className={styles.teamTitle}>
            <span className={styles.teamName}>
              {team.name}
              {isMine && <em className={ds.meChip}>Mon équipe</em>}
            </span>
            <span className={styles.teamCaptain}>
              Cap. {splitRiotId(team.captain_riot_id || '').name || '—'}
            </span>
          </span>

          <span className={view.validated ? styles.statusValidated : styles.statusPending}>
            {view.validated ? 'Validée' : 'En attente'}
          </span>
        </span>

        <span className={styles.roster}>
          {view.slots.map(({ role, member, player }) => {
            const { name, tag } = splitRiotId(player?.riot_id || member?.riot_id || '');

            return (
              <span key={role.name} className={styles.rosterRow}>
                <span className={styles.roleLabel}>{role.label}</span>

                {member ? (
                  <span className={styles.rosterName}>
                    {name}
                    {tag && <small>#{tag}</small>}
                  </span>
                ) : (
                  <span className={`${styles.rosterName} ${styles.freeSlot}`}>Place libre</span>
                )}

                {player?.soloq_tier && (
                  <img
                    src={TIERS[player.soloq_tier]?.icon}
                    alt=""
                    title={formatRank(player.soloq_tier, player.soloq_rank, player.soloq_lp) || ''}
                    className={styles.rosterRank}
                  />
                )}
              </span>
            );
          })}
        </span>
      </button>

      <span className={styles.teamFoot}>
        <DivisionChip view={view} />

        <span className={styles.teamPoints}>
          {view.points} <small>pts</small>
        </span>

        <span className={view.complete ? styles.countComplete : styles.countOpen}>
          {view.count}/{TEAM_SIZE}
        </span>

        {opggUrl && <OpggLink url={opggUrl} />}

        {pendingCount > 0 && (
          <span className={styles.requestsBadge} title="Demandes en attente">
            {pendingCount} demande{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </span>
    </div>
  );
}

function rosterOpggUrl(view: TeamView) {
  return multiOpggUrl(view.slots.map(({ member, player }) => player?.riot_id || member?.riot_id));
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true">
      <path d="M8 1.5h4.5V6M12.5 1.5 6 8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.5 8.5v4h-9v-9h4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

// Ouvre le multi OP.GG dans un nouvel onglet, sans ouvrir la page de l'équipe.
function OpggLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={styles.opggLink}
      onClick={(event) => event.stopPropagation()}
      title="Ouvrir le multi OP.GG"
    >
      OP.GG
      <ExternalIcon />
    </a>
  );
}

/* =========================================================
   CARTE D'ACTION (création / mon équipe)
========================================================= */

function TeamActionCard({
  user,
  myPlayer,
  myTeamView,
  onCreated,
}: {
  user: any;
  myPlayer: any;
  myTeamView: TeamView | null;
  onCreated: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);
    setMessage('');

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          captain_riot_id: myPlayer.riot_id,
          captain_profile_id: user.id,
          captain_player_id: myPlayer.id,
          description,
          logo_url: logoUrl,
        }),
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Erreur lors de la création.');

      setName('');
      setLogoUrl('');
      setDescription('');
      setFormOpen(false);

      await onCreated();
    } catch (err: any) {
      setError(true);
      setMessage(err?.message || 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Monter une équipe</div>
        <p className={ds.body}>Connecte-toi avec Discord pour créer ou rejoindre une équipe.</p>
        <Link href="/login" className={ds.btnPrimary}>
          Se connecter avec Discord
        </Link>
      </div>
    );
  }

  if (!myPlayer) {
    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Monter une équipe</div>
        <p className={ds.body}>Crée d&apos;abord ton profil joueur pour créer ou rejoindre une équipe.</p>
        <Link href="/players" className={ds.btnPrimary}>
          Créer mon profil
        </Link>
      </div>
    );
  }

  if (myTeamView) {
    const { team } = myTeamView;

    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Mon équipe</div>
        <div className={styles.myTeam}>
          {team.logo_url && <img src={logoSrc(team.logo_url)} alt="" className={styles.teamLogo} />}
          <span className={ds.myName}>{team.name}</span>
        </div>
        <p className={ds.body}>
          {myTeamView.count}/{TEAM_SIZE} joueurs · {myTeamView.validated ? 'validée' : 'en attente de validation'}
        </p>
        <Link href="/my-team" className={ds.btnOutline}>
          Voir mon équipe
        </Link>
      </div>
    );
  }

  if (!formOpen) {
    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Monter une équipe</div>
        <p className={ds.body}>
          Tu n&apos;as pas encore d&apos;équipe. Crée la tienne et deviens capitaine, ou postule
          dans une équipe qui recrute.
        </p>
        <button type="button" className={ds.btnPrimary} onClick={() => setFormOpen(true)}>
          Créer une équipe
        </button>
      </div>
    );
  }

  return (
    <form className={`${ds.card} ${ds.sideCard}`} onSubmit={handleSubmit}>
      <div className={ds.cardTitle}>Créer une équipe</div>

      <label className={ds.field}>
        <span>Nom de l&apos;équipe</span>
        <input className={ds.input} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className={ds.field}>
        <span>URL du logo (optionnel)</span>
        <input
          className={ds.input}
          placeholder="https://..."
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />
      </label>

      <label className={ds.field}>
        <span>Description (optionnel)</span>
        <textarea
          className={ds.input}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className={ds.formActions}>
        <button type="submit" className={ds.btnPrimary} disabled={submitting}>
          {submitting ? 'Création…' : "Créer l'équipe"}
        </button>
        <button
          type="button"
          className={ds.btnOutline}
          disabled={submitting}
          onClick={() => {
            setFormOpen(false);
            setMessage('');
          }}
        >
          Annuler
        </button>
      </div>

      {message && <p className={error ? ds.formError : ds.formInfo}>{message}</p>}
    </form>
  );
}
