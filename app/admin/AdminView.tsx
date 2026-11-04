'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { logoSrc } from '@/lib/logo';
import ds from '@/app/components/ds/ds.module.css';
import { DIVISION_COLORS, type DivisionName } from '@/app/components/home/divisions';
import { divisionFromPoints } from '@/app/components/ds/lol';
import RiotRefreshPanel from './RiotRefreshPanel';
import styles from './admin.module.css';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export default function AdminView() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [teamSearch, setTeamSearch] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDescription, setEditTeamDescription] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState('');

  const [message, setMessage] = useState('');

  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [playerForm, setPlayerForm] = useState({
    riot_id: '',
    main_role: '',
    secondary_role: '',
    lft: false,
  });
  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerError, setPlayerError] = useState('');

  useEffect(() => {
    loadAdmin();
    loadData();
  }, []);

  async function loadAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.is_admin === true);
    }

    setLoading(false);
  }

  async function loadData() {
    const [playersData, teamsData, membersData] = await Promise.all([
      fetch('/api/players').then((res) => res.json()),
      fetch('/api/teams').then((res) => res.json()),
      fetch('/api/team-members').then((res) => res.json()),
    ]);

    if (playersData.success) setPlayers(playersData.data);
    if (teamsData.success) setTeams(teamsData.data);
    if (membersData.success) setTeamMembers(membersData.data);
  }

  function getTeamMembers(teamId: number) {
    return teamMembers.filter((member) => member.team_id === teamId);
  }

  function findPlayer(riotId: string) {
    return players.find((p) => p.riot_id === riotId);
  }

  function getTeamPoints(teamId: number) {
    return getTeamMembers(teamId).reduce(
      (total, member) => total + (findPlayer(member.riot_id)?.czf_points || 0),
      0
    );
  }

  function getPlayerTeam(player: any) {
    const member = teamMembers.find((m) => m.riot_id === player.riot_id);
    if (!member) return null;

    return teams.find((team) => team.id === member.team_id) || null;
  }

  async function validateTeam(teamId: number, validated: boolean) {
    const points = getTeamPoints(teamId);
    const division = divisionFromPoints(points);

    const res = await fetch('/api/admin/validate-team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        validated,
        validated_points: validated ? points : null,
        division: validated ? division : null,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(
        validated ? `Équipe validée — ${points} points — ${division}` : 'Équipe dévalidée'
      );
      await loadData();
    } else {
      setMessage(data.message || 'Erreur validation');
    }
  }

  async function deleteTeam(teamId: number, teamName: string) {
    if (!confirm(`Supprimer définitivement l'équipe "${teamName}" ?`)) return;

    const res = await fetch('/api/teams/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(`Équipe "${teamName}" supprimée`);
      setTeamSearch('');
      setEditingTeamId(null);
      await loadData();
    } else {
      setMessage(data.message || 'Erreur suppression équipe');
    }
  }

  function startEditingTeam(team: any) {
    setEditingTeamId(team.id);
    setEditTeamName(team.name || '');
    setEditTeamDescription(team.description || '');
    setEditTeamLogo(team.logo_url || '');
  }

  async function saveTeam(teamId: number) {
    const res = await fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        name: editTeamName,
        description: editTeamDescription,
        logo_url: editTeamLogo,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage('Équipe modifiée');
      setEditingTeamId(null);
      await loadData();
    } else {
      setMessage(data.message || 'Erreur modification équipe');
    }
  }

  function startEditingPlayer(player: any) {
    setEditingPlayerId(player.id);
    setPlayerError('');
    setPlayerForm({
      riot_id: player.riot_id || '',
      main_role: player.main_role || '',
      secondary_role: player.secondary_role || '',
      lft: player.lft === true,
    });
  }

  async function savePlayer(playerId: number) {
    setPlayerSaving(true);
    setPlayerError('');

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Session admin introuvable.');

      const res = await fetch(`/api/admin/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(playerForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.message || 'Erreur modification joueur.');

      setMessage(`Joueur ${json.riot_id} modifié`);
      setEditingPlayerId(null);
      // La recherche suit le nouveau pseudo.
      setPlayerSearch(json.riot_id);
      await loadData();
    } catch (error: any) {
      setPlayerError(error?.message || 'Erreur modification joueur.');
    } finally {
      setPlayerSaving(false);
    }
  }

  const searchedTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return [];

    return teams.filter((team) => team.name?.toLowerCase().includes(query)).slice(0, 10);
  }, [teams, teamSearch]);

  const searchedPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return [];

    return players.filter((player) => player.riot_id?.toLowerCase().includes(query)).slice(0, 10);
  }, [players, playerSearch]);

  const counts = {
    players: players.length,
    teams: teams.length,
    validated: teams.filter((team) => team.validated_by_admin === true).length,
    lft: players.filter((p) => p.lft).length,
  };

  if (loading || !isAdmin) {
    return (
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Administration</div>
          <h1 className={ds.h1}>Admin CZF</h1>
          <p className={ds.body}>
            {loading ? 'Chargement...' : 'Tu n’as pas les droits admin.'}
          </p>
        </div>
      </header>
    );
  }

  return (
    <>
      {/* En-tête : compteurs + actions */}
      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Administration</div>
            <h1 className={ds.h1}>Admin CZF</h1>

            <div className={ds.counters}>
              <div className={ds.counter}>
                <strong>{counts.players}</strong>
                <span>Joueurs</span>
              </div>
              <div className={ds.counter}>
                <strong>{counts.teams}</strong>
                <span>Équipes</span>
              </div>
              <div className={ds.counter}>
                <strong>{counts.validated}</strong>
                <span>Participantes</span>
              </div>
              <div className={ds.counter}>
                <strong className={ds.teal}>{counts.lft}</strong>
                <span>LFT</span>
              </div>
            </div>
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            <div className={ds.cardTitle}>Actions</div>

            <RiotRefreshPanel />

            <div className={styles.actionLinks}>
              <Link href="/admin/results" className={ds.btnOutline}>
                Gérer les résultats
              </Link>
              <Link href="/admin/riot" className={ds.btnOutline}>
                Gérer les BO Riot
              </Link>
            </div>

            {message && <p className={ds.formInfo}>{message}</p>}
          </div>
        </div>
      </header>

      {/* Gestion des équipes et des joueurs */}
      <section className={ds.section}>
        <div className={`${ds.container} ${styles.columns}`}>
          <div>
            <div className={ds.sectionLabel}>Équipes</div>
            <h2 className={styles.h2}>Gestion des équipes</h2>

            <input
              type="search"
              className={`${ds.search} ${styles.search}`}
              placeholder="Rechercher une équipe..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
            />

            <div className={styles.list}>
              {!teamSearch.trim() && (
                <div className={`${ds.card} ${ds.empty}`}>Recherche une équipe pour la gérer</div>
              )}

              {teamSearch.trim() && searchedTeams.length === 0 && (
                <div className={`${ds.card} ${ds.empty}`}>Aucune équipe trouvée</div>
              )}

              {searchedTeams.map((team) => {
                const members = getTeamMembers(team.id);
                const points = getTeamPoints(team.id);
                const division: DivisionName =
                  (team.validated_by_admin && team.division) || divisionFromPoints(points);

                if (editingTeamId === team.id) {
                  return (
                    <div key={team.id} className={`${ds.card} ${styles.item}`}>
                      <div className={styles.itemTitle}>Modifier l’équipe</div>

                      <label className={ds.field}>
                        <span>Nom</span>
                        <input
                          className={ds.input}
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                        />
                      </label>

                      <label className={ds.field}>
                        <span>URL du logo</span>
                        <input
                          className={ds.input}
                          value={editTeamLogo}
                          onChange={(e) => setEditTeamLogo(e.target.value)}
                        />
                      </label>

                      <label className={ds.field}>
                        <span>Description</span>
                        <textarea
                          className={ds.input}
                          rows={4}
                          value={editTeamDescription}
                          onChange={(e) => setEditTeamDescription(e.target.value)}
                        />
                      </label>

                      <div className={ds.formActions}>
                        <button type="button" className={`${ds.btnPrimary} ${ds.btnSmall}`} onClick={() => saveTeam(team.id)}>
                          Enregistrer
                        </button>
                        <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => setEditingTeamId(null)}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={team.id} className={`${ds.card} ${styles.item}`}>
                    <div className={styles.itemHead}>
                      {team.logo_url && (
                        <img className={styles.logo} src={logoSrc(team.logo_url)} alt="" />
                      )}

                      <div className={styles.itemName}>
                        <span className={ds.teamDot} style={{ background: DIVISION_COLORS[division] }} />
                        {team.name}
                      </div>

                      <span className={team.validated_by_admin ? styles.chipOn : styles.chipOff}>
                        {team.validated_by_admin ? 'Participante' : 'Non validée'}
                      </span>
                    </div>

                    <dl className={styles.facts}>
                      <div>
                        <dt>Capitaine</dt>
                        <dd>{team.captain_riot_id || '-'}</dd>
                      </div>
                      <div>
                        <dt>Joueurs</dt>
                        <dd>{members.length} / 5</dd>
                      </div>
                      <div>
                        <dt>Points</dt>
                        <dd>{points}</dd>
                      </div>
                      <div>
                        <dt>Division</dt>
                        <dd>{division}</dd>
                      </div>
                      {team.validated_by_admin && team.validated_points !== null && (
                        <div>
                          <dt>Points figés</dt>
                          <dd>{team.validated_points}</dd>
                        </div>
                      )}
                    </dl>

                    <div className={styles.members}>
                      {members.length === 0 && <span className={ds.muted}>Aucun membre</span>}

                      {members.map((member) => (
                        <div key={member.id} className={styles.memberRow}>
                          <span className={styles.memberRole}>{member.role}</span>
                          <span className={styles.memberName}>{member.riot_id}</span>
                          <span className={styles.memberPoints}>
                            {findPlayer(member.riot_id)?.czf_points || 0} pts
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={`${team.validated_by_admin ? ds.btnOutline : ds.btnPrimary} ${ds.btnSmall}`}
                        onClick={() => validateTeam(team.id, !team.validated_by_admin)}
                      >
                        {team.validated_by_admin ? 'Dévalider' : 'Valider'}
                      </button>
                      <button type="button" className={`${ds.btnOutline} ${ds.btnSmall}`} onClick={() => startEditingTeam(team)}>
                        Modifier
                      </button>
                      <Link href={`/teams/${team.id}`} className={`${ds.btnOutline} ${ds.btnSmall}`}>
                        Voir la fiche
                      </Link>
                      <button type="button" className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => deleteTeam(team.id, team.name)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className={ds.sectionLabel}>Joueurs</div>
            <h2 className={styles.h2}>Gestion des joueurs</h2>

            <input
              type="search"
              className={`${ds.search} ${styles.search}`}
              placeholder="Rechercher un joueur..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
            />

            <div className={styles.list}>
              {!playerSearch.trim() && (
                <div className={`${ds.card} ${ds.empty}`}>Recherche un joueur pour afficher ses infos</div>
              )}

              {playerSearch.trim() && searchedPlayers.length === 0 && (
                <div className={`${ds.card} ${ds.empty}`}>Aucun joueur trouvé</div>
              )}

              {searchedPlayers.map((player) => {
                const team = getPlayerTeam(player);

                if (editingPlayerId === player.id) {
                  return (
                    <div key={player.id} className={`${ds.card} ${styles.item}`}>
                      <div className={styles.itemTitle}>Modifier le joueur</div>

                      <label className={ds.field}>
                        <span>Riot ID (Pseudo#TAG)</span>
                        <input
                          className={ds.input}
                          value={playerForm.riot_id}
                          onChange={(e) => setPlayerForm({ ...playerForm, riot_id: e.target.value })}
                          placeholder="Pseudo#EUW"
                        />
                      </label>

                      <div className={styles.formRow}>
                        <label className={ds.field}>
                          <span>Rôle principal</span>
                          <select
                            className={ds.input}
                            value={playerForm.main_role}
                            onChange={(e) => setPlayerForm({ ...playerForm, main_role: e.target.value })}
                          >
                            <option value="">-</option>
                            {ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </label>

                        <label className={ds.field}>
                          <span>Rôle secondaire</span>
                          <select
                            className={ds.input}
                            value={playerForm.secondary_role}
                            onChange={(e) => setPlayerForm({ ...playerForm, secondary_role: e.target.value })}
                          >
                            <option value="">Aucun</option>
                            {ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className={ds.tabs}>
                        <button
                          type="button"
                          className={playerForm.lft ? ds.tabActive : ds.tab}
                          onClick={() => setPlayerForm({ ...playerForm, lft: !playerForm.lft })}
                          aria-pressed={playerForm.lft}
                        >
                          {playerForm.lft ? 'LFT : oui' : 'LFT : non'}
                        </button>
                      </div>

                      <p className={ds.formInfo}>
                        Un nouveau Riot ID est vérifié chez Riot : rang, points CZF, rosters et
                        capitanat suivent automatiquement.
                      </p>

                      {playerError && <p className={ds.formError}>{playerError}</p>}

                      <div className={ds.formActions}>
                        <button
                          type="button"
                          className={`${ds.btnPrimary} ${ds.btnSmall}`}
                          onClick={() => savePlayer(player.id)}
                          disabled={playerSaving}
                        >
                          {playerSaving ? 'Vérification...' : 'Enregistrer'}
                        </button>
                        <button
                          type="button"
                          className={`${ds.btnOutline} ${ds.btnSmall}`}
                          onClick={() => setEditingPlayerId(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={player.id} className={`${ds.card} ${styles.item}`}>
                    <div className={styles.itemHead}>
                      <div className={styles.itemName}>{player.riot_id}</div>
                      {player.lft && <span className={ds.lftChip}>LFT</span>}
                    </div>

                    {player.profiles?.discord_name && (
                      <div className={`${styles.discord} ${ds.muted}`}>{player.profiles.discord_name}</div>
                    )}

                    <dl className={styles.facts}>
                      <div>
                        <dt>Rôle principal</dt>
                        <dd>{player.main_role || '-'}</dd>
                      </div>
                      <div>
                        <dt>Rôle secondaire</dt>
                        <dd>{player.secondary_role || '-'}</dd>
                      </div>
                      <div>
                        <dt>Points CZF</dt>
                        <dd>{player.czf_points ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>Équipe</dt>
                        <dd>{team?.name || 'Aucune'}</dd>
                      </div>
                      <div>
                        <dt>Participant</dt>
                        <dd className={team?.validated_by_admin ? ds.win : ds.loss}>
                          {team?.validated_by_admin ? 'Oui' : 'Non'}
                        </dd>
                      </div>
                    </dl>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={`${ds.btnPrimary} ${ds.btnSmall}`}
                        onClick={() => startEditingPlayer(player)}
                      >
                        Modifier
                      </button>
                      {team && (
                        <Link href={`/teams/${team.id}`} className={`${ds.btnOutline} ${ds.btnSmall}`}>
                          Voir son équipe
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
