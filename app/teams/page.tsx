'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export default function TeamsPage() {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [multiggUrl, setMultiggUrl] = useState('');

  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  const [teamSearch, setTeamSearch] = useState('');
  const [validatedOnly, setValidatedOnly] = useState(false);
  const [divisionFilter, setDivisionFilter] = useState('Toutes');
  const [statusFilter, setStatusFilter] = useState('Toutes');

  const [message, setMessage] = useState('');
  const [openTeam, setOpenTeam] = useState<number | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);

  const [editingTeam, setEditingTeam] = useState<number | null>(
    null
  );
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editMultiGG, setEditMultiGG] = useState('');

  useEffect(() => {
    refreshAll();
    loadProfile();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(
      window.location.search
    );

    const teamId = params.get('team');

    if (!teamId) return;

    const parsedTeamId = Number(teamId);

    if (Number.isNaN(parsedTeamId)) return;

    setOpenTeam(parsedTeamId);

    setTimeout(() => {
      const element = document.getElementById(
        `team-${parsedTeamId}`
      );

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 500);
  }, [teams]);

  async function refreshAll() {
    await fetchTeams();
    await fetchTeamMembers();
    await loadJoinRequests();
    await fetchPlayers();
  }

  async function fetchPlayers() {
    const res = await fetch('/api/players');
    const data = await res.json();

    if (data.success) {
      setPlayers(data.data);
    }
  }

  async function fetchTeams() {
    const res = await fetch('/api/teams');
    const data = await res.json();

    if (data.success) {
      setTeams(data.data);
    }
  }

  async function fetchTeamMembers() {
    const res = await fetch('/api/team-members');
    const data = await res.json();

    if (data.success) {
      setTeamMembers(data.data);
    }
  }

  async function loadJoinRequests() {
    const res = await fetch('/api/team-join-requests');
    const data = await res.json();

    if (data.success) {
      setJoinRequests(data.data);
    }
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profile);

    const result = await supabase
      .from('players')
      .select('*');

    const linkedPlayer = result.data?.find(
      (p: any) => p.profile_id === user.id
    );

    setPlayer(linkedPlayer);
  }

  function getTeamMembers(teamId: number) {
    return teamMembers.filter(
      (member) =>
        Number(member.team_id) === Number(teamId)
    );
  }

  function getTeamCount(teamId: number) {
    return getTeamMembers(teamId).length;
  }

  function getPlayerByRiotId(riotId: string) {
    const normalizedRiotId = String(
      riotId || ''
    )
      .trim()
      .toLowerCase();

    return players.find(
      (p) =>
        String(p.riot_id || '')
          .trim()
          .toLowerCase() === normalizedRiotId
    );
  }

  function getPlayerFromMember(member: any) {
    if (!member) {
      return null;
    }

    if (
      member.player_id !== null &&
      member.player_id !== undefined
    ) {
      const playerById = players.find(
        (p) =>
          Number(p.id) === Number(member.player_id)
      );

      if (playerById) {
        return playerById;
      }
    }

    return (
      getPlayerByRiotId(member.riot_id) || null
    );
  }

  function getTeamPoints(teamId: number) {
    const members = getTeamMembers(teamId);

    return members.reduce((total, member) => {
      const foundPlayer =
        getPlayerFromMember(member);

      return total + (foundPlayer?.czf_points || 0);
    }, 0);
  }

  function getTeamDivision(teamId: number) {
    const points = getTeamPoints(teamId);

    if (points >= 6101) return 'Targon';
    if (points >= 3901) return 'Ixtal';

    return 'Yordle';
  }

  function isTeamComplete(teamId: number) {
    return getTeamCount(teamId) >= 5;
  }

  function getPlayerTeam() {
    if (!player) return null;

    const normalizedRiotId = String(
      player.riot_id || ''
    )
      .trim()
      .toLowerCase();

    return (
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
          String(member.riot_id || '')
            .trim()
            .toLowerCase() === normalizedRiotId
        );
      }) || null
    );
  }

  function hasPendingRequest(teamId: number) {
    if (!player) return false;

    return joinRequests.some(
      (request) =>
        Number(request.team_id) === Number(teamId) &&
        Number(request.player_id) === Number(player.id) &&
        request.status === 'pending'
    );
  }

  function isRoleTaken(
    teamId: number,
    role: string
  ) {
    return teamMembers.some(
      (member) =>
        Number(member.team_id) === Number(teamId) &&
        member.role === role
    );
  }

  function getJoinBlockReason(teamId: number) {
    if (!profile || !player) {
      return 'Connecte-toi et crée ton profil joueur.';
    }

    const currentTeam = getPlayerTeam();

    if (currentTeam) {
      if (
        Number(currentTeam.team_id) ===
        Number(teamId)
      ) {
        return 'Tu es déjà dans cette équipe.';
      }

      return 'Tu es déjà dans une autre équipe.';
    }

    if (isTeamComplete(teamId)) {
      return "L'équipe est complète.";
    }

    if (
      isRoleTaken(
        teamId,
        player.main_role
      )
    ) {
      return `Le poste ${player.main_role} est déjà occupé.`;
    }

    if (hasPendingRequest(teamId)) {
      return 'Tu as déjà postulé à cette équipe.';
    }

    return null;
  }

  async function requestJoinTeam(teamId: number) {
    const blockReason =
      getJoinBlockReason(teamId);

    if (blockReason) {
      alert(blockReason);
      return;
    }

    const res = await fetch(
      '/api/team-join-requests',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: teamId,
          riot_id: player.riot_id,
          role: player.main_role,
          profile_id: profile.id,
          player_id: player.id,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      alert('Demande envoyée.');
      await loadJoinRequests();
    } else {
      alert(data.message || 'Erreur.');
    }
  }

  async function handleJoinRequest(
    requestId: number,
    action: 'accept' | 'reject'
  ) {
    const res = await fetch(
      '/api/team-join-requests',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: requestId,
          action,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      alert(
        action === 'accept'
          ? 'Joueur accepté.'
          : 'Demande refusée.'
      );

      await refreshAll();
    } else {
      alert(data.message || 'Erreur.');
    }
  }

  function startEditingTeam(team: any) {
    setEditingTeam(team.id);
    setEditName(team.name || '');
    setEditDescription(team.description || '');
    setEditLogo(team.logo_url || '');
    setEditMultiGG(team.multigg_url || '');
  }

  async function saveTeam(teamId: number) {
    const res = await fetch('/api/teams', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_id: teamId,
        name: editName,
        description: editDescription,
        logo_url: editLogo,
        multigg_url: editMultiGG,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert('Équipe modifiée.');
      setEditingTeam(null);
      await fetchTeams();
    } else {
      alert('Erreur.');
    }
  }

  async function removeMember(
    teamId: number,
    riotId: string
  ) {
    const confirmDelete = confirm(
      `Retirer ${riotId} de l'équipe ?`
    );

    if (!confirmDelete) return;

    const res = await fetch(
      '/api/team-members',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: teamId,
          riot_id: riotId,
        }),
      }
    );

    const data = await res.json();

    if (data.success) {
      alert('Joueur retiré.');
      await refreshAll();
    } else {
      alert('Erreur.');
    }
  }

  async function deleteTeam(teamId: number) {
    const ok = confirm(
      'Supprimer définitivement cette équipe ?'
    );

    if (!ok) return;

    const res = await fetch('/api/teams/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_id: teamId,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert('Équipe supprimée.');
      window.location.reload();
    } else {
      alert('Erreur.');
    }
  }

  function getChampionIconUrl(
    championName: string
  ) {
    return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${championName}.png`;
  }

  function getRankIcon(player: any) {
    switch (player?.soloq_tier) {
      case 'IRON':
        return '/assets/ranks/iron.webp';

      case 'BRONZE':
        return '/assets/ranks/bronze.webp';

      case 'SILVER':
        return '/assets/ranks/silver.webp';

      case 'GOLD':
        return '/assets/ranks/gold.webp';

      case 'PLATINUM':
        return '/assets/ranks/platine.webp';

      case 'EMERALD':
        return '/assets/ranks/Emerald.webp';

      case 'DIAMOND':
        return '/assets/ranks/diamant.webp';

      case 'MASTER':
        return '/assets/ranks/master.webp';

      case 'GRANDMASTER':
        return '/assets/ranks/gm.webp';

      case 'CHALLENGER':
        return '/assets/ranks/chall.webp';

      default:
        return '/assets/ranks/iron.webp';
    }
  }

  function renderChampionPool(member: any) {
    const foundPlayer =
      getPlayerFromMember(member);

    if (!foundPlayer?.top_champions?.length) {
      return null;
    }

    return (
      <div className="championPool">
        {foundPlayer.top_champions.map(
          (champion: any) => (
            <img
              key={champion.champion_id}
              src={getChampionIconUrl(
                champion.champion_name
              )}
              alt={champion.champion_name}
            />
          )
        )}
      </div>
    );
  }

  async function handleCreateTeam(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!profile || !player) {
      setMessage(
        'Tu dois être connecté et avoir un profil joueur pour créer une équipe.'
      );
      return;
    }

    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: teamName,
        captain_riot_id: player.riot_id,
        captain_profile_id: profile.id,
        captain_player_id: player.id,
        description,
        logo_url: logoUrl,
        multigg_url: multiggUrl,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(
        'Équipe créée avec succès.'
      );

      setTeamName('');
      setDescription('');
      setLogoUrl('');
      setMultiggUrl('');

      await fetchTeams();
    } else {
      setMessage(
        'Erreur lors de la création.'
      );
    }
  }

  const displayedTeams = teams.filter(
    (team) => {
      const matchesSearch =
        team.name
          ?.toLowerCase()
          .includes(
            teamSearch.toLowerCase()
          );

      const matchesValidated =
        !validatedOnly ||
        team.validated_by_admin === true;

      const matchesDivision =
        statusFilter === 'Incomplètes' ||
        divisionFilter === 'Toutes' ||
        team.division === divisionFilter;

      const matchesStatus =
        statusFilter === 'Toutes' ||
        (statusFilter === 'Complètes' &&
          isTeamComplete(team.id)) ||
        (statusFilter === 'Incomplètes' &&
          !isTeamComplete(team.id));

      return (
        matchesSearch &&
        matchesValidated &&
        matchesDivision &&
        matchesStatus
      );
    }
  );

  return (
    <>
      <Nav />

      <main className="section teamsPage">

        <div className="sectionTitle">
          <span></span>
          <h2>Équipes</h2>
        </div>


        {/* =========================================
            CRÉER UNE ÉQUIPE
        ========================================== */}

        <div className="card teamsCreateCard">

          <h3>Créer une équipe</h3>

          <form
            onSubmit={handleCreateTeam}
            className="fakeForm"
          >
            <input
              placeholder="Nom de l'équipe"
              value={teamName}
              onChange={(e) =>
                setTeamName(e.target.value)
              }
              required
            />

            <input
              placeholder="URL du logo"
              value={logoUrl}
              onChange={(e) =>
                setLogoUrl(e.target.value)
              }
            />

            <input
              placeholder="Lien MultiGG"
              value={multiggUrl}
              onChange={(e) =>
                setMultiggUrl(e.target.value)
              }
            />

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
            />

            <button type="submit">
              Créer l'équipe
            </button>
          </form>

          {message && (
            <p>{message}</p>
          )}

        </div>


        <br />


        {/* =========================================
            LISTE DES ÉQUIPES
        ========================================== */}

        <div className="card teamsListCard">

          <h3>
            Liste des équipes
          </h3>


          <div className="teamsFilters">

            <div className="teamsSearch">

              <input
                type="text"
                placeholder="Rechercher une équipe..."
                value={teamSearch}
                onChange={(e) =>
                  setTeamSearch(
                    e.target.value
                  )
                }
              />

            </div>


            <label className="teamsParticipantsCheck">

              <input
                type="checkbox"
                checked={validatedOnly}
                onChange={(e) =>
                  setValidatedOnly(
                    e.target.checked
                  )
                }
              />

              <span className="teamsCustomCheck"></span>

              <span>
                Participants uniquement
              </span>

            </label>


            <select
              className="teamsFilterSelect"
              value={divisionFilter}
              onChange={(e) =>
                setDivisionFilter(
                  e.target.value
                )
              }
              disabled={
                statusFilter ===
                'Incomplètes'
              }
            >
              <option value="Toutes">
                Toutes les divisions
              </option>

              <option value="Yordle">
                Yordle
              </option>

              <option value="Ixtal">
                Ixtal
              </option>

              <option value="Targon">
                Targon
              </option>
            </select>


            <select
              className="teamsFilterSelect"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >
              <option value="Toutes">
                Tous les statuts
              </option>

              <option value="Complètes">
                Complètes
              </option>

              <option value="Incomplètes">
                Incomplètes
              </option>
            </select>

          </div>


          <div className="playersTable">

            <div className="teamsHeader">
              <div></div>
              <div>Équipe</div>
              <div>Capitaine</div>
              <div>Division</div>
              <div>Joueurs</div>
              <div>Statut</div>
            </div>


            {displayedTeams.map((team) => {
              const isCaptain =
                team.captain_profile_id ===
                profile?.id;

              const teamRequests =
                joinRequests.filter(
                  (request) =>
                    Number(request.team_id) ===
                      Number(team.id) &&
                    request.status ===
                      'pending'
                );

              const count =
                getTeamCount(team.id);

              const joinBlockReason =
                getJoinBlockReason(team.id);

              const complete =
                isTeamComplete(team.id);

              return (
                <div
                  key={team.id}
                  id={`team-${team.id}`}
                  className="teamEntry"
                >

                  <div className="teamRow">

                    <div
                      className={`teamArrow ${
                        openTeam === team.id
                          ? 'open'
                          : ''
                      }`}
                      onClick={() =>
                        setOpenTeam(
                          openTeam === team.id
                            ? null
                            : team.id
                        )
                      }
                    >
                      <span></span>
                    </div>


                    <div className="teamNameCell">

                      {team.logo_url && (
                        <img
                          className="teamLogoSmall"
                          src={
                            team.logo_url
                          }
                          alt={team.name}
                        />
                      )}

                      <span>
                        {team.name}
                      </span>

                    </div>


                    <div>
                      {team.captain_riot_id ||
                        '-'}
                    </div>


                    <div>

                      {complete ? (
                        <span>
                          {getTeamDivision(
                            team.id
                          )}{' '}
                          —{' '}
                          {getTeamPoints(
                            team.id
                          )}{' '}
                          pts
                        </span>
                      ) : (
                        <span className="muted">
                          Équipe incomplète
                        </span>
                      )}

                    </div>


                    <div>
                      {count} / 5
                    </div>


                    <div>

                      <span
                        className={
                          complete
                            ? 'teamStatus teamStatusComplete'
                            : 'teamStatus teamStatusIncomplete'
                        }
                      >
                        {complete
                          ? 'Complète'
                          : 'Incomplète'}
                      </span>

                    </div>

                  </div>


                  {openTeam === team.id && (
                    <div className="teamDetails">

                      <div className="teamInfos">

                        {editingTeam ===
                        team.id ? (
                          <>

                            <h3>
                              Modifier l'équipe
                            </h3>

                            <input
                              placeholder="Nom de l'équipe"
                              value={editName}
                              onChange={(e) =>
                                setEditName(
                                  e.target.value
                                )
                              }
                            />

                            <br />
                            <br />

                            <textarea
                              placeholder="Description"
                              value={
                                editDescription
                              }
                              onChange={(e) =>
                                setEditDescription(
                                  e.target.value
                                )
                              }
                            />

                            <br />
                            <br />

                            <input
                              placeholder="URL du logo"
                              value={editLogo}
                              onChange={(e) =>
                                setEditLogo(
                                  e.target.value
                                )
                              }
                            />

                            <br />
                            <br />

                            <input
                              placeholder="Lien MultiGG"
                              value={
                                editMultiGG
                              }
                              onChange={(e) =>
                                setEditMultiGG(
                                  e.target.value
                                )
                              }
                            />

                            <br />
                            <br />

                            <button
                              onClick={() =>
                                saveTeam(
                                  team.id
                                )
                              }
                            >
                              Enregistrer
                            </button>

                            <button
                              style={{
                                marginLeft:
                                  '10px',
                              }}
                              onClick={() =>
                                setEditingTeam(
                                  null
                                )
                              }
                            >
                              Annuler
                            </button>

                          </>
                        ) : (
                          <>

                            <h3>
                              {team.name}
                            </h3>


                            <p>
                              <strong>
                                Capitaine :
                              </strong>{' '}
                              {team.captain_riot_id ||
                                '-'}
                            </p>


                            <p>
                              <strong>
                                Division :
                              </strong>{' '}
                              {getTeamDivision(
                                team.id
                              )}
                            </p>


                            <p>
                              <strong>
                                Total CZF :
                              </strong>{' '}
                              {getTeamPoints(
                                team.id
                              )}{' '}
                              pts
                            </p>


                            <p>
                              <strong>
                                Description :
                              </strong>{' '}
                              {team.description ||
                                '-'}
                            </p>


                            {team.multigg_url && (
                              <p>
                                <a
                                  href={
                                    team.multigg_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="multiggLink"
                                >
                                  Ouvrir la page
                                  MultiGG →
                                </a>
                              </p>
                            )}


                            {isCaptain && (
                              <div className="teamCaptainActions">

                                <button
                                  className="joinTeamBtn"
                                  onClick={() =>
                                    startEditingTeam(
                                      team
                                    )
                                  }
                                >
                                  Modifier
                                  l'équipe
                                </button>

                                <button
                                  className="joinTeamBtn teamDeleteBtn"
                                  onClick={() =>
                                    deleteTeam(
                                      team.id
                                    )
                                  }
                                >
                                  Supprimer
                                  l'équipe
                                </button>

                              </div>
                            )}


                            {!joinBlockReason && (
                              <button
                                className="joinTeamBtn"
                                onClick={() =>
                                  requestJoinTeam(
                                    team.id
                                  )
                                }
                              >
                                Demander à
                                rejoindre
                              </button>
                            )}


                            {joinBlockReason &&
                              player && (
                                <p className="muted">
                                  {
                                    joinBlockReason
                                  }
                                </p>
                              )}


                            {isCaptain && (
                              <div className="teamRequests">

                                <h4>
                                  Demandes reçues
                                </h4>

                                {teamRequests.length ===
                                0 ? (
                                  <p>
                                    Aucune demande
                                  </p>
                                ) : (
                                  teamRequests.map(
                                    (
                                      request
                                    ) => (
                                      <div
                                        key={
                                          request.id
                                        }
                                        className="card teamRequestCard"
                                      >

                                        <p>
                                          <strong>
                                            {
                                              request.riot_id
                                            }
                                          </strong>
                                        </p>

                                        <p>
                                          Rôle :{' '}
                                          {
                                            request.role
                                          }
                                        </p>

                                        <button
                                          onClick={() =>
                                            handleJoinRequest(
                                              request.id,
                                              'accept'
                                            )
                                          }
                                        >
                                          Accepter
                                        </button>

                                        <button
                                          style={{
                                            marginLeft:
                                              '10px',
                                          }}
                                          onClick={() =>
                                            handleJoinRequest(
                                              request.id,
                                              'reject'
                                            )
                                          }
                                        >
                                          Refuser
                                        </button>

                                      </div>
                                    )
                                  )
                                )}

                              </div>
                            )}


                            <h4>Joueurs</h4>

                            <div className="teamRoster">

                              {ROLES.map(
                                (role) => {
                                  const member =
                                    teamMembers.find(
                                      (m) =>
                                        Number(
                                          m.team_id
                                        ) ===
                                          Number(
                                            team.id
                                          ) &&
                                        m.role ===
                                          role
                                    );

                                  const memberPlayer =
                                    member
                                      ? getPlayerFromMember(
                                          member
                                        )
                                      : null;

                                  return (
                                    <div
                                      key={role}
                                      className="teamRosterRow"
                                    >

                                      <strong>
                                        {role} :
                                      </strong>


                                      {member &&
                                        memberPlayer && (
                                        <img
                                          src={getRankIcon(
                                            memberPlayer
                                          )}
                                          className="rankIcon"
                                          alt=""
                                        />
                                      )}


                                      <span>
                                        {memberPlayer?.riot_id ||
                                          member?.riot_id ||
                                          '-'}
                                      </span>


                                      {memberPlayer
                                        ?.profiles
                                        ?.discord_name && (
                                        <span className="teamDiscordName">
                                          {
                                            memberPlayer
                                              .profiles
                                              .discord_name
                                          }
                                        </span>
                                      )}


                                      {member &&
                                        renderChampionPool(
                                          member
                                        )}


                                      {isCaptain &&
                                        member && (
                                          <button
                                            className="teamRemoveMemberBtn"
                                            onClick={() =>
                                              removeMember(
                                                team.id,
                                                memberPlayer?.riot_id ||
                                                  member.riot_id
                                              )
                                            }
                                          >
                                            Retirer
                                          </button>
                                        )}

                                    </div>
                                  );
                                }
                              )}

                            </div>

                          </>
                        )}

                      </div>


                      <div className="teamLogoBigContainer">

                        {team.logo_url && (
                          <img
                            className="teamLogoBig"
                            src={
                              team.logo_url
                            }
                            alt={team.name}
                          />
                        )}

                      </div>

                    </div>
                  )}

                </div>
              );
            })}

          </div>

        </div>

      </main>
    </>
  );
}