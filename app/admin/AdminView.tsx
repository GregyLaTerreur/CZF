'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { supabase } from '@/lib/supabase';
import { logoSrc } from '@/lib/logo';

import ds from '@/app/components/ds/ds.module.css';

import {
  DIVISION_COLORS,
  type DivisionName,
} from '@/app/components/home/divisions';

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

  const [editingPlayerId, setEditingPlayerId] =
    useState<number | null>(null);

  const [playerForm, setPlayerForm] = useState({
    riot_id: '',
    main_role: '',
    secondary_role: '',
    lft: false,
  });

  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerError, setPlayerError] = useState('');

  const [refreshingKey, setRefreshingKey] =
    useState<string | null>(null);

  const [removingMemberId, setRemovingMemberId] =
    useState<number | null>(null);

  const [editingMemberId, setEditingMemberId] =
    useState<number | null>(null);

  /*
   * AJOUT AU ROSTER
   */
  const [addingTeamId, setAddingTeamId] =
    useState<number | null>(null);

  const [addPlayerSearch, setAddPlayerSearch] =
    useState('');

  const [selectedAddPlayerId, setSelectedAddPlayerId] =
    useState<number | null>(null);

  const [addRole, setAddRole] =
    useState('Top');

  const [addingMember, setAddingMember] =
    useState(false);

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
    const [playersData, teamsData, membersData] =
      await Promise.all([
        fetch('/api/players').then((res) => res.json()),
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
      ]);

    if (playersData.success) {
      setPlayers(playersData.data || []);
    }

    if (teamsData.success) {
      setTeams(teamsData.data || []);
    }

    if (membersData.success) {
      setTeamMembers(membersData.data || []);
    }
  }

  async function getToken() {
    const { data } =
      await supabase.auth.getSession();

    const token =
      data.session?.access_token;

    if (!token) {
      throw new Error(
        'Session admin introuvable.'
      );
    }

    return token;
  }

  function normalizeRiotId(value: any) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  function getTeamMembers(teamId: number) {
    return teamMembers.filter(
      (member) =>
        Number(member.team_id) ===
        Number(teamId)
    );
  }

  /*
   * player_id en priorité.
   * Riot ID uniquement pour les anciennes lignes.
   */
  function getPlayerFromMember(member: any) {
    if (
      member.player_id !== null &&
      member.player_id !== undefined
    ) {
      const byId = players.find(
        (player) =>
          Number(player.id) ===
          Number(member.player_id)
      );

      if (byId) {
        return byId;
      }
    }

    return (
      players.find(
        (player) =>
          normalizeRiotId(player.riot_id) ===
          normalizeRiotId(member.riot_id)
      ) || null
    );
  }

  function findPlayer(riotId: string) {
    return (
      players.find(
        (player) =>
          normalizeRiotId(player.riot_id) ===
          normalizeRiotId(riotId)
      ) || null
    );
  }

  function getTeamPoints(teamId: number) {
    return getTeamMembers(teamId).reduce(
      (total, member) => {
        const player =
          getPlayerFromMember(member);

        return (
          total +
          Number(player?.czf_points || 0)
        );
      },
      0
    );
  }

  function getPlayerTeam(player: any) {
    const member =
      teamMembers.find((member) => {
        if (
          member.player_id !== null &&
          member.player_id !== undefined
        ) {
          return (
            Number(member.player_id) ===
            Number(player.id)
          );
        }

        return (
          normalizeRiotId(member.riot_id) ===
          normalizeRiotId(player.riot_id)
        );
      });

    if (!member) {
      return null;
    }

    return (
      teams.find(
        (team) =>
          Number(team.id) ===
          Number(member.team_id)
      ) || null
    );
  }

  function isCaptain(
    team: any,
    member: any
  ) {
    if (
      member.player_id !== null &&
      member.player_id !== undefined &&
      team.captain_player_id !== null &&
      team.captain_player_id !== undefined
    ) {
      return (
        Number(member.player_id) ===
        Number(team.captain_player_id)
      );
    }

    return (
      normalizeRiotId(member.riot_id) ===
      normalizeRiotId(
        team.captain_riot_id
      )
    );
  }

  async function validateTeam(
    teamId: number,
    validated: boolean
  ) {
    const points =
      getTeamPoints(teamId);

    const division =
      divisionFromPoints(points);

    const res = await fetch(
      '/api/admin/validate-team',
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          validated,
          validated_points:
            validated ? points : null,
          division:
            validated ? division : null,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      setMessage(
        validated
          ? `Équipe validée — ${points} points — ${division}`
          : 'Équipe dévalidée'
      );

      await loadData();
    } else {
      setMessage(
        data.message ||
          'Erreur validation'
      );
    }
  }

  async function deleteTeam(
    teamId: number,
    teamName: string
  ) {
    if (
      !confirm(
        `Supprimer définitivement l'équipe "${teamName}" ?`
      )
    ) {
      return;
    }

    const res = await fetch(
      '/api/teams/delete',
      {
        method: 'DELETE',
        headers: {
          'Content-Type':
            'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          team_id: teamId,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      setMessage(
        `Équipe "${teamName}" supprimée`
      );

      setTeamSearch('');
      setEditingTeamId(null);

      await loadData();
    } else {
      setMessage(
        data.message ||
          'Erreur suppression équipe'
      );
    }
  }

  function startEditingTeam(team: any) {
    setEditingTeamId(team.id);

    setEditTeamName(
      team.name || ''
    );

    setEditTeamDescription(
      team.description || ''
    );

    setEditTeamLogo(
      team.logo_url || ''
    );
  }

  async function saveTeam(
    teamId: number
  ) {
    const res = await fetch(
      '/api/teams',
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          name: editTeamName,
          description:
            editTeamDescription,
          logo_url:
            editTeamLogo,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      setMessage(
        'Équipe modifiée'
      );

      setEditingTeamId(null);

      await loadData();
    } else {
      setMessage(
        data.message ||
          'Erreur modification équipe'
      );
    }
  }

  function teamPlayerIds(
    teamId: number
  ) {
    const ids =
      getTeamMembers(teamId)
        .map((member) => {
          const player =
            getPlayerFromMember(member);

          return player?.id
            ? Number(player.id)
            : null;
        })
        .filter(
          (id): id is number =>
            id !== null &&
            Number.isFinite(id)
        );

    return [...new Set(ids)];
  }

  async function refreshRiot(
    key: string,
    playerIds: number[],
    label: string
  ) {
    if (refreshingKey) return;

    if (playerIds.length === 0) {
      setMessage(
        `${label} : aucun joueur CZF à actualiser.`
      );

      return;
    }

    setRefreshingKey(key);

    setMessage(
      `${label} : actualisation Riot en cours...`
    );

    try {
      const res = await fetch(
        '/api/admin/refresh-riot',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            player_ids:
              playerIds,
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Erreur actualisation Riot.'
        );
      }

      const failed: any[] =
        json.failed_players || [];

      setMessage(
        failed.length === 0
          ? `${label} : ${json.updated} joueur${json.updated > 1 ? 's' : ''} actualisé${json.updated > 1 ? 's' : ''}.`
          : `${label} : ${json.updated} actualisé(s), échec pour ${failed
              .map(
                (failure) =>
                  failure.riot_id ||
                  failure.player_id
              )
              .join(', ')}.`
      );

      await loadData();
    } catch (error: any) {
      setMessage(
        `${label} : ${
          error?.message ||
          'Erreur actualisation Riot.'
        }`
      );
    } finally {
      setRefreshingKey(null);
    }
  }

  /* ======================================================
     AJOUT D'UN JOUEUR
  ====================================================== */

  function startAddingMember(
    teamId: number
  ) {
    setAddingTeamId(teamId);
    setAddPlayerSearch('');
    setSelectedAddPlayerId(null);
    setAddRole('Top');
  }

  function cancelAddingMember() {
    setAddingTeamId(null);
    setAddPlayerSearch('');
    setSelectedAddPlayerId(null);
    setAddRole('Top');
  }

  const availablePlayers =
    useMemo(() => {
      const query =
        addPlayerSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return players
        .filter((player) => {
          const matches =
            String(
              player.riot_id || ''
            )
              .toLowerCase()
              .includes(query);

          if (!matches) {
            return false;
          }

          return !getPlayerTeam(
            player
          );
        })
        .slice(0, 10);
    }, [
      players,
      teamMembers,
      teams,
      addPlayerSearch,
    ]);

  async function addMember(
    teamId: number,
    teamName: string
  ) {
    if (!selectedAddPlayerId) {
      setMessage(
        'Choisis un joueur.'
      );

      return;
    }

    setAddingMember(true);

    try {
      const res = await fetch(
        '/api/admin/team-members',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            team_id: teamId,
            player_id:
              selectedAddPlayerId,
            role: addRole,
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Impossible d’ajouter le joueur.'
        );
      }

      setMessage(
        `${json.riot_id} ajouté à ${teamName} en ${addRole}.`
      );

      cancelAddingMember();

      await loadData();
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur ajout joueur.'
      );
    } finally {
      setAddingMember(false);
    }
  }

  /* ======================================================
     ROLE D'UN MEMBRE
  ====================================================== */

  async function changeMemberRole(
    member: any,
    role: string,
    teamName: string
  ) {
    setEditingMemberId(
      Number(member.id)
    );

    try {
      const res = await fetch(
        `/api/admin/team-members/${member.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            role,
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Impossible de changer le rôle.'
        );
      }

      setMessage(
        `${member.riot_id} passe ${role} chez ${teamName}.`
      );

      await loadData();
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur changement de rôle.'
      );
    } finally {
      setEditingMemberId(null);
    }
  }

  /* ======================================================
     CAPITAINE
  ====================================================== */

  async function makeCaptain(
    member: any,
    teamName: string
  ) {
    if (
      !confirm(
        `Définir ${member.riot_id} comme capitaine de "${teamName}" ?`
      )
    ) {
      return;
    }

    setEditingMemberId(
      Number(member.id)
    );

    try {
      const res = await fetch(
        `/api/admin/team-members/${member.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            make_captain: true,
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Impossible de changer le capitaine.'
        );
      }

      setMessage(
        `${json.riot_id} est maintenant capitaine de ${teamName}.`
      );

      await loadData();
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur changement de capitaine.'
      );
    } finally {
      setEditingMemberId(null);
    }
  }

  /* ======================================================
     RETRAIT
  ====================================================== */

  async function removeMember(
    member: any,
    teamName: string
  ) {
    if (
      !confirm(
        `Retirer ${member.riot_id} de l'équipe "${teamName}" ?`
      )
    ) {
      return;
    }

    setRemovingMemberId(
      member.id
    );

    try {
      const res = await fetch(
        `/api/admin/team-members/${member.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Erreur retrait joueur.'
        );
      }

      setMessage(
        `${member.riot_id} retiré de ${teamName}`
      );

      await loadData();
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Erreur retrait joueur.'
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  /* ======================================================
     JOUEURS
  ====================================================== */

  function startEditingPlayer(
    player: any
  ) {
    setEditingPlayerId(
      player.id
    );

    setPlayerError('');

    setPlayerForm({
      riot_id:
        player.riot_id || '',
      main_role:
        player.main_role || '',
      secondary_role:
        player.secondary_role || '',
      lft:
        player.lft === true,
    });
  }

  async function savePlayer(
    playerId: number
  ) {
    setPlayerSaving(true);
    setPlayerError('');

    try {
      const res = await fetch(
        `/api/admin/players/${playerId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify(
            playerForm
          ),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            'Erreur modification joueur.'
        );
      }

      setMessage(
        `Joueur ${json.riot_id} modifié`
      );

      setEditingPlayerId(null);

      setPlayerSearch(
        json.riot_id
      );

      await loadData();
    } catch (error: any) {
      setPlayerError(
        error?.message ||
          'Erreur modification joueur.'
      );
    } finally {
      setPlayerSaving(false);
    }
  }

  const searchedTeams =
    useMemo(() => {
      const query =
        teamSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return teams
        .filter((team) =>
          team.name
            ?.toLowerCase()
            .includes(query)
        )
        .slice(0, 10);
    }, [teams, teamSearch]);

  const searchedPlayers =
    useMemo(() => {
      const query =
        playerSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return players
        .filter((player) =>
          player.riot_id
            ?.toLowerCase()
            .includes(query)
        )
        .slice(0, 10);
    }, [
      players,
      playerSearch,
    ]);

  const counts = {
    players:
      players.length,

    teams:
      teams.length,

    validated:
      teams.filter(
        (team) =>
          team.validated_by_admin ===
          true
      ).length,

    lft:
      players.filter(
        (player) =>
          player.lft
      ).length,
  };

  if (
    loading ||
    !isAdmin
  ) {
    return (
      <header
        className={ds.header}
      >
        <div
          className={
            ds.container
          }
        >
          <div
            className={
              ds.sectionLabel
            }
          >
            Administration
          </div>

          <h1
            className={ds.h1}
          >
            Admin CZF
          </h1>

          <p
            className={ds.body}
          >
            {loading
              ? 'Chargement...'
              : 'Tu n’as pas les droits admin.'}
          </p>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={ds.header}
      >
        <div
          className={`${ds.container} ${ds.headerGrid}`}
        >
          <div>
            <div
              className={
                ds.sectionLabel
              }
            >
              Administration
            </div>

            <h1
              className={ds.h1}
            >
              Admin CZF
            </h1>

            <div
              className={
                ds.counters
              }
            >
              <div
                className={
                  ds.counter
                }
              >
                <strong>
                  {
                    counts.players
                  }
                </strong>

                <span>
                  Joueurs
                </span>
              </div>

              <div
                className={
                  ds.counter
                }
              >
                <strong>
                  {
                    counts.teams
                  }
                </strong>

                <span>
                  Équipes
                </span>
              </div>

              <div
                className={
                  ds.counter
                }
              >
                <strong>
                  {
                    counts.validated
                  }
                </strong>

                <span>
                  Participantes
                </span>
              </div>

              <div
                className={
                  ds.counter
                }
              >
                <strong
                  className={
                    ds.teal
                  }
                >
                  {counts.lft}
                </strong>

                <span>
                  LFT
                </span>
              </div>
            </div>
          </div>

          <div
            className={`${ds.card} ${ds.sideCard}`}
          >
            <div
              className={
                ds.cardTitle
              }
            >
              Actions
            </div>

            <RiotRefreshPanel />

            <div
              className={
                styles.actionLinks
              }
            >
              <Link
                href="/admin/results"
                className={
                  ds.btnOutline
                }
              >
                Gérer les résultats
              </Link>

              <Link
                href="/admin/riot"
                className={
                  ds.btnOutline
                }
              >
                Gérer les BO Riot
              </Link>
            </div>

            {message && (
              <p
                className={
                  ds.formInfo
                }
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </header>

      <section
        className={ds.section}
      >
        <div
          className={`${ds.container} ${styles.columns}`}
        >
          {/* =================================================
              EQUIPES
          ================================================= */}

          <div>
            <div
              className={
                ds.sectionLabel
              }
            >
              Équipes
            </div>

            <h2
              className={
                styles.h2
              }
            >
              Gestion des équipes
            </h2>

            <input
              type="search"
              className={`${ds.search} ${styles.search}`}
              placeholder="Rechercher une équipe..."
              value={teamSearch}
              onChange={(event) =>
                setTeamSearch(
                  event.target.value
                )
              }
            />

            {message && (
              <p
                className={`${ds.formInfo} ${styles.listMessage}`}
              >
                {message}
              </p>
            )}

            <div
              className={
                styles.list
              }
            >
              {!teamSearch.trim() && (
                <div
                  className={`${ds.card} ${ds.empty}`}
                >
                  Recherche une équipe pour la gérer
                </div>
              )}

              {teamSearch.trim() &&
                searchedTeams.length ===
                  0 && (
                  <div
                    className={`${ds.card} ${ds.empty}`}
                  >
                    Aucune équipe trouvée
                  </div>
                )}

              {searchedTeams.map(
                (team) => {
                  const members =
                    getTeamMembers(
                      team.id
                    );

                  const points =
                    getTeamPoints(
                      team.id
                    );

                  const division: DivisionName =
                    (team.validated_by_admin &&
                      team.division) ||
                    divisionFromPoints(
                      points
                    );

                  if (
                    editingTeamId ===
                    team.id
                  ) {
                    return (
                      <div
                        key={
                          team.id
                        }
                        className={`${ds.card} ${styles.item}`}
                      >
                        <div
                          className={
                            styles.itemTitle
                          }
                        >
                          Modifier l’équipe
                        </div>

                        <label
                          className={
                            ds.field
                          }
                        >
                          <span>
                            Nom
                          </span>

                          <input
                            className={
                              ds.input
                            }
                            value={
                              editTeamName
                            }
                            onChange={(
                              event
                            ) =>
                              setEditTeamName(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </label>

                        <label
                          className={
                            ds.field
                          }
                        >
                          <span>
                            URL du logo
                          </span>

                          <input
                            className={
                              ds.input
                            }
                            value={
                              editTeamLogo
                            }
                            onChange={(
                              event
                            ) =>
                              setEditTeamLogo(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </label>

                        <label
                          className={
                            ds.field
                          }
                        >
                          <span>
                            Description
                          </span>

                          <textarea
                            className={
                              ds.input
                            }
                            rows={4}
                            value={
                              editTeamDescription
                            }
                            onChange={(
                              event
                            ) =>
                              setEditTeamDescription(
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </label>

                        <div
                          className={
                            ds.formActions
                          }
                        >
                          <button
                            type="button"
                            className={`${ds.btnPrimary} ${ds.btnSmall}`}
                            onClick={() =>
                              saveTeam(
                                team.id
                              )
                            }
                          >
                            Enregistrer
                          </button>

                          <button
                            type="button"
                            className={`${ds.btnOutline} ${ds.btnSmall}`}
                            onClick={() =>
                              setEditingTeamId(
                                null
                              )
                            }
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={
                        team.id
                      }
                      className={`${ds.card} ${styles.item}`}
                    >
                      <div
                        className={
                          styles.itemHead
                        }
                      >
                        {team.logo_url && (
                          <img
                            className={
                              styles.logo
                            }
                            src={logoSrc(
                              team.logo_url
                            )}
                            alt=""
                          />
                        )}

                        <div
                          className={
                            styles.itemName
                          }
                        >
                          <span
                            className={
                              ds.teamDot
                            }
                            style={{
                              background:
                                DIVISION_COLORS[
                                  division
                                ],
                            }}
                          />

                          {team.name}
                        </div>

                        <span
                          className={
                            team.validated_by_admin
                              ? styles.chipOn
                              : styles.chipOff
                          }
                        >
                          {team.validated_by_admin
                            ? 'Participante'
                            : 'Non validée'}
                        </span>
                      </div>

                      <dl
                        className={
                          styles.facts
                        }
                      >
                        <div>
                          <dt>
                            Capitaine
                          </dt>

                          <dd>
                            {team.captain_riot_id ||
                              '-'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Joueurs
                          </dt>

                          <dd>
                            {
                              members.length
                            }{' '}
                            / 5
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Points
                          </dt>

                          <dd>
                            {points}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Division
                          </dt>

                          <dd>
                            {division}
                          </dd>
                        </div>

                        {team.validated_by_admin &&
                          team.validated_points !==
                            null && (
                            <div>
                              <dt>
                                Points figés
                              </dt>

                              <dd>
                                {
                                  team.validated_points
                                }
                              </dd>
                            </div>
                          )}
                      </dl>

                      {/* ======================================
                          ROSTER
                      ====================================== */}

                      <div
                        className={
                          styles.members
                        }
                      >
                        {members.length ===
                          0 && (
                          <span
                            className={
                              ds.muted
                            }
                          >
                            Aucun membre
                          </span>
                        )}

                        {members.map(
                          (member) => {
                            const player =
                              getPlayerFromMember(
                                member
                              );

                            const captain =
                              isCaptain(
                                team,
                                member
                              );

                            return (
                              <div
                                key={
                                  member.id
                                }
                                className={
                                  styles.memberRow
                                }
                              >
                                <select
                                  className={
                                    ds.input
                                  }
                                  value={
                                    member.role ||
                                    ''
                                  }
                                  disabled={
                                    editingMemberId ===
                                    Number(
                                      member.id
                                    )
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    changeMemberRole(
                                      member,
                                      event
                                        .target
                                        .value,
                                      team.name
                                    )
                                  }
                                >
                                  {ROLES.map(
                                    (
                                      role
                                    ) => (
                                      <option
                                        key={
                                          role
                                        }
                                        value={
                                          role
                                        }
                                      >
                                        {
                                          role
                                        }
                                      </option>
                                    )
                                  )}
                                </select>

                                <span
                                  className={
                                    styles.memberName
                                  }
                                >
                                  {player?.riot_id ||
                                    member.riot_id}

                                  {captain &&
                                    ' · Capitaine'}
                                </span>

                                <span
                                  className={
                                    styles.memberPoints
                                  }
                                >
                                  {player?.czf_points ||
                                    0}{' '}
                                  pts
                                </span>

                                {!captain && (
                                  <button
                                    type="button"
                                    className={`${ds.btnOutline} ${ds.btnSmall}`}
                                    disabled={
                                      editingMemberId ===
                                      Number(
                                        member.id
                                      )
                                    }
                                    onClick={() =>
                                      makeCaptain(
                                        member,
                                        team.name
                                      )
                                    }
                                  >
                                    Capitaine
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className={
                                    styles.removeBtn
                                  }
                                  onClick={() =>
                                    removeMember(
                                      member,
                                      team.name
                                    )
                                  }
                                  disabled={
                                    captain ||
                                    removingMemberId ===
                                      member.id
                                  }
                                >
                                  {captain
                                    ? 'Capitaine'
                                    : removingMemberId ===
                                        member.id
                                      ? '...'
                                      : 'Retirer'}
                                </button>
                              </div>
                            );
                          }
                        )}
                      </div>

                      {/* ======================================
                          AJOUT JOUEUR
                      ====================================== */}

                      {addingTeamId ===
                      team.id ? (
                        <div
                          className={
                            ds.card
                          }
                          style={{
                            marginTop:
                              16,
                          }}
                        >
                          <div
                            className={
                              ds.cardTitle
                            }
                          >
                            Ajouter un joueur
                          </div>

                          <label
                            className={
                              ds.field
                            }
                          >
                            <span>
                              Rechercher le joueur
                            </span>

                            <input
                              type="search"
                              className={
                                ds.input
                              }
                              placeholder="Pseudo#TAG"
                              value={
                                addPlayerSearch
                              }
                              onChange={(
                                event
                              ) => {
                                setAddPlayerSearch(
                                  event
                                    .target
                                    .value
                                );

                                setSelectedAddPlayerId(
                                  null
                                );
                              }}
                            />
                          </label>

                          {availablePlayers.length >
                            0 && (
                            <div
                              style={{
                                display:
                                  'grid',
                                gap: 6,
                                marginBottom:
                                  12,
                              }}
                            >
                              {availablePlayers.map(
                                (
                                  player
                                ) => (
                                  <button
                                    key={
                                      player.id
                                    }
                                    type="button"
                                    className={
                                      selectedAddPlayerId ===
                                      Number(
                                        player.id
                                      )
                                        ? ds.btnPrimary
                                        : ds.btnOutline
                                    }
                                    onClick={() =>
                                      setSelectedAddPlayerId(
                                        Number(
                                          player.id
                                        )
                                      )
                                    }
                                  >
                                    {
                                      player.riot_id
                                    }{' '}
                                    —{' '}
                                    {
                                      player.main_role
                                    }
                                  </button>
                                )
                              )}
                            </div>
                          )}

                          {addPlayerSearch.trim() &&
                            availablePlayers.length ===
                              0 && (
                              <p
                                className={
                                  ds.formInfo
                                }
                              >
                                Aucun joueur libre trouvé.
                              </p>
                            )}

                          <label
                            className={
                              ds.field
                            }
                          >
                            <span>
                              Rôle dans l’équipe
                            </span>

                            <select
                              className={
                                ds.input
                              }
                              value={
                                addRole
                              }
                              onChange={(
                                event
                              ) =>
                                setAddRole(
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              {ROLES.map(
                                (
                                  role
                                ) => (
                                  <option
                                    key={
                                      role
                                    }
                                    value={
                                      role
                                    }
                                  >
                                    {
                                      role
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <div
                            className={
                              ds.formActions
                            }
                          >
                            <button
                              type="button"
                              className={`${ds.btnPrimary} ${ds.btnSmall}`}
                              disabled={
                                addingMember ||
                                !selectedAddPlayerId
                              }
                              onClick={() =>
                                addMember(
                                  team.id,
                                  team.name
                                )
                              }
                            >
                              {addingMember
                                ? 'Ajout...'
                                : 'Ajouter au roster'}
                            </button>

                            <button
                              type="button"
                              className={`${ds.btnOutline} ${ds.btnSmall}`}
                              onClick={
                                cancelAddingMember
                              }
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`${ds.btnPrimary} ${ds.btnSmall}`}
                          style={{
                            marginTop:
                              16,
                          }}
                          onClick={() =>
                            startAddingMember(
                              team.id
                            )
                          }
                        >
                          Ajouter un joueur
                        </button>
                      )}

                      <div
                        className={
                          styles.itemActions
                        }
                      >
                        <button
                          type="button"
                          className={`${
                            team.validated_by_admin
                              ? ds.btnOutline
                              : ds.btnPrimary
                          } ${ds.btnSmall}`}
                          onClick={() =>
                            validateTeam(
                              team.id,
                              !team.validated_by_admin
                            )
                          }
                        >
                          {team.validated_by_admin
                            ? 'Dévalider'
                            : 'Valider'}
                        </button>

                        <button
                          type="button"
                          className={`${ds.btnOutline} ${ds.btnSmall}`}
                          onClick={() =>
                            startEditingTeam(
                              team
                            )
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className={`${ds.btnOutline} ${ds.btnSmall}`}
                          onClick={() =>
                            refreshRiot(
                              `team-${team.id}`,
                              teamPlayerIds(
                                team.id
                              ),
                              team.name
                            )
                          }
                          disabled={
                            refreshingKey !==
                            null
                          }
                        >
                          {refreshingKey ===
                          `team-${team.id}`
                            ? 'Riot en cours...'
                            : 'Actualiser Riot'}
                        </button>

                        <Link
                          href={`/teams/${team.id}`}
                          className={`${ds.btnOutline} ${ds.btnSmall}`}
                        >
                          Voir la fiche
                        </Link>

                        <button
                          type="button"
                          className={`${ds.btnDanger} ${ds.btnSmall}`}
                          onClick={() =>
                            deleteTeam(
                              team.id,
                              team.name
                            )
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* =================================================
              JOUEURS
          ================================================= */}

          <div>
            <div
              className={
                ds.sectionLabel
              }
            >
              Joueurs
            </div>

            <h2
              className={
                styles.h2
              }
            >
              Gestion des joueurs
            </h2>

            <input
              type="search"
              className={`${ds.search} ${styles.search}`}
              placeholder="Rechercher un joueur..."
              value={
                playerSearch
              }
              onChange={(
                event
              ) =>
                setPlayerSearch(
                  event.target
                    .value
                )
              }
            />

            {message && (
              <p
                className={`${ds.formInfo} ${styles.listMessage}`}
              >
                {message}
              </p>
            )}

            <div
              className={
                styles.list
              }
            >
              {!playerSearch.trim() && (
                <div
                  className={`${ds.card} ${ds.empty}`}
                >
                  Recherche un joueur pour afficher ses infos
                </div>
              )}

              {playerSearch.trim() &&
                searchedPlayers.length ===
                  0 && (
                  <div
                    className={`${ds.card} ${ds.empty}`}
                  >
                    Aucun joueur trouvé
                  </div>
                )}

              {searchedPlayers.map(
                (player) => {
                  const team =
                    getPlayerTeam(
                      player
                    );

                  if (
                    editingPlayerId ===
                    player.id
                  ) {
                    return (
                      <div
                        key={
                          player.id
                        }
                        className={`${ds.card} ${styles.item}`}
                      >
                        <div
                          className={
                            styles.itemTitle
                          }
                        >
                          Modifier le joueur
                        </div>

                        <label
                          className={
                            ds.field
                          }
                        >
                          <span>
                            Riot ID (Pseudo#TAG)
                          </span>

                          <input
                            className={
                              ds.input
                            }
                            value={
                              playerForm.riot_id
                            }
                            onChange={(
                              event
                            ) =>
                              setPlayerForm(
                                {
                                  ...playerForm,
                                  riot_id:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                            placeholder="Pseudo#EUW"
                          />
                        </label>

                        <div
                          className={
                            styles.formRow
                          }
                        >
                          <label
                            className={
                              ds.field
                            }
                          >
                            <span>
                              Rôle principal
                            </span>

                            <select
                              className={
                                ds.input
                              }
                              value={
                                playerForm.main_role
                              }
                              onChange={(
                                event
                              ) =>
                                setPlayerForm(
                                  {
                                    ...playerForm,
                                    main_role:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            >
                              <option value="">
                                -
                              </option>

                              {ROLES.map(
                                (
                                  role
                                ) => (
                                  <option
                                    key={
                                      role
                                    }
                                    value={
                                      role
                                    }
                                  >
                                    {
                                      role
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          <label
                            className={
                              ds.field
                            }
                          >
                            <span>
                              Rôle secondaire
                            </span>

                            <select
                              className={
                                ds.input
                              }
                              value={
                                playerForm.secondary_role
                              }
                              onChange={(
                                event
                              ) =>
                                setPlayerForm(
                                  {
                                    ...playerForm,
                                    secondary_role:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                            >
                              <option value="">
                                Aucun
                              </option>

                              {ROLES.map(
                                (
                                  role
                                ) => (
                                  <option
                                    key={
                                      role
                                    }
                                    value={
                                      role
                                    }
                                  >
                                    {
                                      role
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>

                        <div
                          className={
                            ds.tabs
                          }
                        >
                          <button
                            type="button"
                            className={
                              playerForm.lft
                                ? ds.tabActive
                                : ds.tab
                            }
                            onClick={() =>
                              setPlayerForm(
                                {
                                  ...playerForm,
                                  lft: !playerForm.lft,
                                }
                              )
                            }
                          >
                            {playerForm.lft
                              ? 'LFT : oui'
                              : 'LFT : non'}
                          </button>
                        </div>

                        <p
                          className={
                            ds.formInfo
                          }
                        >
                          Un nouveau Riot ID est vérifié chez Riot : rang, points CZF, rosters et capitanat suivent automatiquement.
                        </p>

                        {playerError && (
                          <p
                            className={
                              ds.formError
                            }
                          >
                            {
                              playerError
                            }
                          </p>
                        )}

                        <div
                          className={
                            ds.formActions
                          }
                        >
                          <button
                            type="button"
                            className={`${ds.btnPrimary} ${ds.btnSmall}`}
                            onClick={() =>
                              savePlayer(
                                player.id
                              )
                            }
                            disabled={
                              playerSaving
                            }
                          >
                            {playerSaving
                              ? 'Vérification...'
                              : 'Enregistrer'}
                          </button>

                          <button
                            type="button"
                            className={`${ds.btnOutline} ${ds.btnSmall}`}
                            onClick={() =>
                              setEditingPlayerId(
                                null
                              )
                            }
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={
                        player.id
                      }
                      className={`${ds.card} ${styles.item}`}
                    >
                      <div
                        className={
                          styles.itemHead
                        }
                      >
                        <div
                          className={
                            styles.itemName
                          }
                        >
                          {
                            player.riot_id
                          }
                        </div>

                        {player.lft && (
                          <span
                            className={
                              ds.lftChip
                            }
                          >
                            LFT
                          </span>
                        )}
                      </div>

                      {player.profiles
                        ?.discord_name && (
                        <div
                          className={`${styles.discord} ${ds.muted}`}
                        >
                          {
                            player
                              .profiles
                              .discord_name
                          }
                        </div>
                      )}

                      <dl
                        className={
                          styles.facts
                        }
                      >
                        <div>
                          <dt>
                            Rôle principal
                          </dt>

                          <dd>
                            {player.main_role ||
                              '-'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Rôle secondaire
                          </dt>

                          <dd>
                            {player.secondary_role ||
                              '-'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Points CZF
                          </dt>

                          <dd>
                            {player.czf_points ??
                              '-'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Équipe
                          </dt>

                          <dd>
                            {team?.name ||
                              'Aucune'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Participant
                          </dt>

                          <dd
                            className={
                              team?.validated_by_admin
                                ? ds.win
                                : ds.loss
                            }
                          >
                            {team?.validated_by_admin
                              ? 'Oui'
                              : 'Non'}
                          </dd>
                        </div>
                      </dl>

                      <div
                        className={
                          styles.itemActions
                        }
                      >
                        <button
                          type="button"
                          className={`${ds.btnPrimary} ${ds.btnSmall}`}
                          onClick={() =>
                            startEditingPlayer(
                              player
                            )
                          }
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className={`${ds.btnOutline} ${ds.btnSmall}`}
                          onClick={() =>
                            refreshRiot(
                              `player-${player.id}`,
                              [
                                player.id,
                              ],
                              player.riot_id
                            )
                          }
                          disabled={
                            refreshingKey !==
                            null
                          }
                        >
                          {refreshingKey ===
                          `player-${player.id}`
                            ? 'Riot en cours...'
                            : 'Actualiser Riot'}
                        </button>

                        {team && (
                          <Link
                            href={`/teams/${team.id}`}
                            className={`${ds.btnOutline} ${ds.btnSmall}`}
                          >
                            Voir son équipe
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}