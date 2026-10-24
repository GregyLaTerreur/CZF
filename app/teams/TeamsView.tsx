'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
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
} from '@/app/components/ds/lol';
import { ChampionPool, useDdragonVersion } from '@/app/components/ds/LolUi';
import styles from './teams.module.css';

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
   ICONES
========================================================= */

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.4" fill="none" />
    </svg>
  );
}

/* =========================================================
   VUE
========================================================= */

export default function TeamsView() {
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
  const [openTeamId, setOpenTeamId] = useState<number | null>(null);

  const ddragonVersion = useDdragonVersion();

  const loadData = useCallback(async () => {
    try {
      const [teamsRes, membersRes, requestsRes, playersRes] = await Promise.all([
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
        fetch('/api/team-join-requests').then((res) => res.json()),
        fetch('/api/players').then((res) => res.json()),
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
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadData();

    // Lien direct /teams?team=ID : ouvre la fiche de l'équipe.
    const teamParam = Number(new URLSearchParams(window.location.search).get('team'));
    if (Number.isInteger(teamParam) && teamParam > 0) setOpenTeamId(teamParam);
  }, [loadData]);

  // Garde l'URL synchronisée avec la fiche ouverte (lien partageable).
  useEffect(() => {
    const url = new URL(window.location.href);

    if (openTeamId) url.searchParams.set('team', String(openTeamId));
    else url.searchParams.delete('team');

    window.history.replaceState(null, '', url.toString());
  }, [openTeamId]);

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

  const openView = teamViews.find((view) => Number(view.team.id) === openTeamId) || null;
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
            onOpenTeam={setOpenTeamId}
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
              onClick={() => setDivisionFilter(null)}
            >
              Toutes les divisions
            </button>

            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                className={divisionFilter === division ? ds.tabActive : ds.tab}
                onClick={() => setDivisionFilter(divisionFilter === division ? null : division)}
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
                onOpen={() => setOpenTeamId(Number(view.team.id))}
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

      {openView && (
        <TeamModal
          key={openView.team.id}
          view={openView}
          user={user}
          myPlayer={myPlayer}
          myMembership={myMembership}
          pendingRequests={pendingRequestsFor(openView.team.id)}
          hasPendingRequest={
            Boolean(myPlayer) &&
            joinRequests.some(
              (request) =>
                Number(request.team_id) === Number(openView.team.id) &&
                Number(request.player_id) === Number(myPlayer?.id) &&
                request.status === 'pending'
            )
          }
          ddragonVersion={ddragonVersion}
          onClose={() => setOpenTeamId(null)}
          onChanged={loadData}
        />
      )}
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

  return (
    <button type="button" className={`${ds.card} ${styles.teamCard}`} onClick={onOpen}>
      <span className={styles.teamHead}>
        {team.logo_url ? (
          <img src={team.logo_url} alt="" className={styles.teamLogo} loading="lazy" />
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

      <span className={styles.teamFoot}>
        <DivisionChip view={view} />

        <span className={styles.teamPoints}>
          {view.points} <small>pts</small>
        </span>

        <span className={view.complete ? styles.countComplete : styles.countOpen}>
          {view.count}/{TEAM_SIZE}
        </span>

        {pendingCount > 0 && (
          <span className={styles.requestsBadge} title="Demandes en attente">
            {pendingCount} demande{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </span>
    </button>
  );
}

/* =========================================================
   FICHE D'ÉQUIPE (fenêtre)
========================================================= */

function TeamModal({
  view,
  user,
  myPlayer,
  myMembership,
  pendingRequests,
  hasPendingRequest,
  ddragonVersion,
  onClose,
  onChanged,
}: {
  view: TeamView;
  user: any;
  myPlayer: any;
  myMembership: any;
  pendingRequests: any[];
  hasPendingRequest: boolean;
  ddragonVersion: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { team } = view;
  const isCaptain = Boolean(user) && team.captain_profile_id === user.id;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(team.name || '');
  const [editLogo, setEditLogo] = useState(team.logo_url || '');
  const [editMultiGG, setEditMultiGG] = useState(team.multigg_url || '');
  const [editDescription, setEditDescription] = useState(team.description || '');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Échap ferme la fiche ; on bloque le défilement de la page derrière.
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

  function joinBlockReason(): string | null {
    if (!user || !myPlayer) return 'Connecte-toi et crée ton profil joueur pour postuler.';

    if (myMembership) {
      return Number(myMembership.team_id) === Number(team.id)
        ? 'Tu fais partie de cette équipe.'
        : 'Tu es déjà dans une autre équipe.';
    }

    if (view.complete) return "L'équipe est complète.";

    if (view.members.some((member) => member.role === myPlayer.main_role)) {
      return `Le poste ${myPlayer.main_role} est déjà occupé.`;
    }

    if (hasPendingRequest) return 'Ta demande est en attente de réponse du capitaine.';

    return null;
  }

  // Appel d'API avec message de retour dans la fiche.
  async function run(action: () => Promise<Response>, success: string) {
    setBusy(true);
    setFeedback(null);

    try {
      const res = await action();
      const data = await res.json();

      if (!data.success) throw new Error(data.message || data.error?.message || 'Erreur.');

      setFeedback({ text: success, error: false });
      await onChanged();
      return true;
    } catch (error: any) {
      setFeedback({ text: error?.message || 'Erreur.', error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function requestJoin() {
    return run(
      () =>
        fetch('/api/team-join-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: team.id,
            riot_id: myPlayer.riot_id,
            role: myPlayer.main_role,
            profile_id: user.id,
            player_id: myPlayer.id,
          }),
        }),
      'Demande envoyée au capitaine.'
    );
  }

  function answerRequest(requestId: number, action: 'accept' | 'reject') {
    return run(
      () =>
        fetch('/api/team-join-requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId, action }),
        }),
      action === 'accept' ? 'Joueur accepté.' : 'Demande refusée.'
    );
  }

  function removeMember(riotId: string) {
    if (!confirm(`Retirer ${riotId} de l'équipe ?`)) return;

    return run(
      () =>
        fetch('/api/team-members', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team_id: team.id, riot_id: riotId }),
        }),
      'Joueur retiré.'
    );
  }

  async function saveTeam(event: React.FormEvent) {
    event.preventDefault();

    const ok = await run(
      () =>
        fetch('/api/teams', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: team.id,
            name: editName,
            description: editDescription,
            logo_url: editLogo,
            multigg_url: editMultiGG,
          }),
        }),
      'Équipe modifiée.'
    );

    if (ok) setEditing(false);
  }

  async function deleteTeam() {
    if (!confirm('Supprimer définitivement cette équipe ?')) return;

    const ok = await run(
      () =>
        fetch('/api/teams/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team_id: team.id }),
        }),
      'Équipe supprimée.'
    );

    if (ok) onClose();
  }

  const blockReason = joinBlockReason();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${ds.onDark}`}
        role="dialog"
        aria-modal="true"
        aria-label={team.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>

        {/* EN-TÊTE */}
        <div className={styles.modalHead}>
          {team.logo_url ? (
            <img src={team.logo_url} alt="" className={styles.modalLogo} />
          ) : (
            <span className={styles.modalLogo} />
          )}

          <div className={styles.modalWho}>
            <div className={styles.modalName}>{team.name}</div>
            <div className={styles.modalMeta}>
              <span>Capitaine · {team.captain_riot_id || '—'}</span>
              <span>{view.validated ? 'Validée par un admin' : 'En attente de validation'}</span>
            </div>
          </div>

          {team.multigg_url && (
            <a href={team.multigg_url} target="_blank" rel="noreferrer" className={ds.btnOutline}>
              MultiGG
            </a>
          )}
        </div>

        <div className={styles.modalStats}>
          <div className={styles.modalStat}>
            <span>Division</span>
            <strong>
              {view.division ? (
                <>
                  <span className={ds.teamDot} style={{ background: DIVISION_COLORS[view.division] }} />
                  {view.division}
                  {!view.divisionOfficial && <small> estimée</small>}
                </>
              ) : (
                'À définir'
              )}
            </strong>
          </div>
          <div className={styles.modalStat}>
            <span>Total CZF</span>
            <strong>{view.points} pts</strong>
          </div>
          <div className={styles.modalStat}>
            <span>Effectif</span>
            <strong>
              {view.count}/{TEAM_SIZE} · {view.complete ? 'Complète' : 'Recrute'}
            </strong>
          </div>
        </div>

        {team.description && !editing && <p className={styles.modalDescription}>{team.description}</p>}

        {feedback && (
          <p className={feedback.error ? ds.formError : ds.formInfo} role="status">
            {feedback.text}
          </p>
        )}

        {/* ÉDITION (capitaine) */}
        {editing ? (
          <form className={styles.editForm} onSubmit={saveTeam}>
            <label className={ds.field}>
              <span>Nom de l&apos;équipe</span>
              <input className={ds.input} value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label className={ds.field}>
              <span>URL du logo</span>
              <input className={ds.input} value={editLogo} onChange={(e) => setEditLogo(e.target.value)} />
            </label>
            <label className={ds.field}>
              <span>Lien MultiGG</span>
              <input className={ds.input} value={editMultiGG} onChange={(e) => setEditMultiGG(e.target.value)} />
            </label>
            <label className={ds.field}>
              <span>Description</span>
              <textarea
                className={ds.input}
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>

            <div className={ds.formActions}>
              <button type="submit" className={ds.btnPrimary} disabled={busy}>
                Enregistrer
              </button>
              <button type="button" className={ds.btnOutline} disabled={busy} onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* ROSTER */}
            <div className={styles.modalLabel}>Roster</div>

            <div className={styles.modalRoster}>
              {view.slots.map(({ role, member, player }) => {
                const riotId = player?.riot_id || member?.riot_id || '';
                const { name, tag } = splitRiotId(riotId);
                const rank = formatRank(player?.soloq_tier, player?.soloq_rank, player?.soloq_lp);

                return (
                  <div key={role.name} className={styles.modalRosterRow}>
                    <span className={styles.modalRole}>
                      <img src={role.image} alt="" className={ds.roleIcon} />
                      {role.label}
                    </span>

                    {member ? (
                      <>
                        <span className={styles.modalPlayer}>
                          <span className={styles.modalPlayerName}>
                            {name}
                            {tag && <small>#{tag}</small>}
                          </span>
                          {player?.profiles?.discord_name && (
                            <span className={styles.modalDiscord}>{player.profiles.discord_name}</span>
                          )}
                        </span>

                        <span className={styles.modalRank}>
                          {rank ? (
                            <>
                              <img src={TIERS[player.soloq_tier]?.icon} alt="" className={ds.rankIcon} />
                              {rank}
                            </>
                          ) : (
                            <span className={ds.muted}>Non classé</span>
                          )}
                        </span>

                        <span className={styles.modalPool}>
                          <ChampionPool player={player} ddragonVersion={ddragonVersion} />
                        </span>

                        <span className={styles.modalRowAction}>
                          {isCaptain && (
                            <button
                              type="button"
                              className={`${ds.btnDanger} ${ds.btnSmall}`}
                              disabled={busy}
                              onClick={() => removeMember(riotId)}
                            >
                              Retirer
                            </button>
                          )}
                        </span>
                      </>
                    ) : (
                      <span className={`${styles.modalPlayer} ${ds.muted}`}>Place libre</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DEMANDES (capitaine) */}
            {isCaptain && (
              <>
                <div className={styles.modalLabel}>Demandes reçues</div>

                {pendingRequests.length === 0 ? (
                  <p className={ds.muted}>Aucune demande en attente.</p>
                ) : (
                  <div className={styles.requests}>
                    {pendingRequests.map((request) => (
                      <div key={request.id} className={styles.requestRow}>
                        <span className={styles.modalPlayerName}>{request.riot_id}</span>
                        <span className={styles.modalDiscord}>{request.role}</span>

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
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ACTIONS */}
            <div className={styles.modalActions}>
              {!blockReason && (
                <button type="button" className={ds.btnPrimary} disabled={busy} onClick={requestJoin}>
                  Demander à rejoindre
                </button>
              )}

              {blockReason && !isCaptain && <p className={styles.blockReason}>{blockReason}</p>}

              {isCaptain && (
                <>
                  <button type="button" className={ds.btnOutline} onClick={() => setEditing(true)}>
                    Modifier l&apos;équipe
                  </button>
                  <button type="button" className={ds.btnDanger} disabled={busy} onClick={deleteTeam}>
                    Supprimer l&apos;équipe
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CARTE D'ACTION (création / mon équipe)
========================================================= */

function TeamActionCard({
  user,
  myPlayer,
  myTeamView,
  onOpenTeam,
  onCreated,
}: {
  user: any;
  myPlayer: any;
  myTeamView: TeamView | null;
  onOpenTeam: (teamId: number) => void;
  onCreated: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [multiggUrl, setMultiggUrl] = useState('');
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
          multigg_url: multiggUrl,
        }),
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Erreur lors de la création.');

      setName('');
      setLogoUrl('');
      setMultiggUrl('');
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
          {team.logo_url && <img src={team.logo_url} alt="" className={styles.teamLogo} />}
          <span className={ds.myName}>{team.name}</span>
        </div>
        <p className={ds.body}>
          {myTeamView.count}/{TEAM_SIZE} joueurs · {myTeamView.validated ? 'validée' : 'en attente de validation'}
        </p>
        <button type="button" className={ds.btnOutline} onClick={() => onOpenTeam(Number(team.id))}>
          Voir mon équipe
        </button>
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
        <span>Lien MultiGG (optionnel)</span>
        <input className={ds.input} value={multiggUrl} onChange={(e) => setMultiggUrl(e.target.value)} />
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
