'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';
import RiotRefreshPanel from './RiotRefreshPanel';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [teamSearch, setTeamSearch] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  const [editingTeamId, setEditingTeamId] =
    useState<number | null>(null);

  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDescription, setEditTeamDescription] =
    useState('');
  const [editTeamLogo, setEditTeamLogo] = useState('');
  const [editTeamMultiGG, setEditTeamMultiGG] = useState('');

  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAdmin();
    loadData();
  }, []);

  async function loadAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profile);
    setLoading(false);
  }

  async function loadData() {
    const playersRes = await fetch('/api/players');
    const teamsRes = await fetch('/api/teams');
    const membersRes = await fetch('/api/team-members');

    const playersData = await playersRes.json();
    const teamsData = await teamsRes.json();
    const membersData = await membersRes.json();

    if (playersData.success) {
      setPlayers(playersData.data);
    }

    if (teamsData.success) {
      setTeams(teamsData.data);
    }

    if (membersData.success) {
      setTeamMembers(membersData.data);
    }
  }

  function getTeamMembers(teamId: number) {
    return teamMembers.filter(
      (member) => member.team_id === teamId
    );
  }

  function getTeamPoints(teamId: number) {
    const members = getTeamMembers(teamId);

    return members.reduce((total, member) => {
      const player = players.find(
        (p) => p.riot_id === member.riot_id
      );

      return total + (player?.czf_points || 0);
    }, 0);
  }

  function getDivisionFromPoints(points: number) {
    if (points >= 6101) return 'Targon';
    if (points >= 3901) return 'Ixtal';

    return 'Yordle';
  }

  function getPlayerTeam(player: any) {
    const member = teamMembers.find(
      (m) => m.riot_id === player.riot_id
    );

    if (!member) return null;

    return (
      teams.find(
        (team) => team.id === member.team_id
      ) || null
    );
  }

  async function validateTeam(
    teamId: number,
    validated: boolean
  ) {
    const points = getTeamPoints(teamId);
    const division = getDivisionFromPoints(points);

    const res = await fetch('/api/admin/validate-team', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
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
        validated
          ? `Équipe validée — ${points} points — ${division}`
          : 'Équipe dévalidée'
      );

      await loadData();
    } else {
      setMessage(
        data.message || 'Erreur validation'
      );
    }
  }

  async function deleteTeam(
    teamId: number,
    teamName: string
  ) {
    const confirmation = confirm(
      `Supprimer définitivement l'équipe "${teamName}" ?`
    );

    if (!confirmation) return;

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

    setEditTeamMultiGG(
      team.multigg_url || ''
    );
  }

  function cancelEditingTeam() {
    setEditingTeamId(null);

    setEditTeamName('');
    setEditTeamDescription('');
    setEditTeamLogo('');
    setEditTeamMultiGG('');
  }

  async function saveTeam(teamId: number) {
    const res = await fetch('/api/teams', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_id: teamId,
        name: editTeamName,
        description: editTeamDescription,
        logo_url: editTeamLogo,
        multigg_url: editTeamMultiGG,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage('Équipe modifiée');

      setEditingTeamId(null);

      await loadData();
    } else {
      setMessage(
        data.message ||
          'Erreur modification équipe'
      );
    }
  }

  const searchedTeams = teamSearch.trim()
    ? teams
        .filter((team) =>
          team.name
            ?.toLowerCase()
            .includes(
              teamSearch.toLowerCase()
            )
        )
        .slice(0, 10)
    : [];

  const searchedPlayers = playerSearch.trim()
    ? players
        .filter((player) =>
          player.riot_id
            ?.toLowerCase()
            .includes(
              playerSearch.toLowerCase()
            )
        )
        .slice(0, 10)
    : [];

  const validatedTeamsCount =
    teams.filter(
      (team) =>
        team.validated_by_admin === true
    ).length;

  if (loading) {
    return (
      <>
        <Nav />

        <main className="section">
          <div className="card">
            Chargement...
          </div>
        </main>
      </>
    );
  }

  if (!profile?.is_admin) {
    return (
      <>
        <Nav />

        <main className="section">
          <div className="card">
            <h2>Accès refusé</h2>

            <p>
              Tu n’as pas les droits admin.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />

      <main className="section">

        <div className="sectionTitle">
          <span></span>
          <h2>Admin CZF</h2>
        </div>


        {/* =================================================
            ACTUALISATION RIOT
        ================================================= */}

        <RiotRefreshPanel />


        {/* =================================================
            ACTIONS RAPIDES
        ================================================= */}

        <div className="card">

          <h3>Actions rapides</h3>

          <a
  href="/admin/riot"
  className="joinTeamBtn"
  style={{
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  Gérer les BO Riot
</a>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <a
              href="/admin/results"
              className="joinTeamBtn"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Gérer les résultats
            </a>
          </div>

          {message && (
            <p
              style={{
                marginTop: '16px',
                fontWeight: '700',
              }}
            >
              {message}
            </p>
          )}

        </div>


        <br />


        {/* =================================================
            STATISTIQUES
        ================================================= */}

        <div className="card">

          <h3>Statistiques</h3>

          <div
            style={{
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
            }}
          >

            <div
              style={{
                border: '2px solid #0b1f4d',
                borderRadius: '10px',
                padding: '14px 20px',
                minWidth: '130px',
              }}
            >
              <strong>Joueurs</strong>

              <div
                style={{
                  fontSize: '24px',
                }}
              >
                {players.length}
              </div>
            </div>


            <div
              style={{
                border: '2px solid #0b1f4d',
                borderRadius: '10px',
                padding: '14px 20px',
                minWidth: '130px',
              }}
            >
              <strong>Équipes</strong>

              <div
                style={{
                  fontSize: '24px',
                }}
              >
                {teams.length}
              </div>
            </div>


            <div
              style={{
                border: '2px solid #0b1f4d',
                borderRadius: '10px',
                padding: '14px 20px',
                minWidth: '130px',
              }}
            >
              <strong>
                Participantes
              </strong>

              <div
                style={{
                  fontSize: '24px',
                }}
              >
                {validatedTeamsCount}
              </div>
            </div>


            <div
              style={{
                border: '2px solid #0b1f4d',
                borderRadius: '10px',
                padding: '14px 20px',
                minWidth: '130px',
              }}
            >
              <strong>LFT</strong>

              <div
                style={{
                  fontSize: '24px',
                }}
              >
                {
                  players.filter(
                    (p) => p.lft
                  ).length
                }
              </div>
            </div>

          </div>

        </div>


        <br />


        {/* =================================================
            GESTION ÉQUIPES
        ================================================= */}

        <div className="card">

          <h3>Gestion des équipes</h3>

          <div
            style={{
              position: 'relative',
              marginBottom: '20px',
            }}
          >
            <input
              type="text"
              placeholder="Rechercher une équipe..."
              value={teamSearch}
              onChange={(e) =>
                setTeamSearch(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding:
                  '14px 18px',
                borderRadius: '10px',
                border:
                  '2px solid #0b1f4d',
                background:
                  'transparent',
                color: '#0b1f4d',
                fontSize: '16px',
                fontWeight: '600',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>


          {!teamSearch.trim() && (
            <p className="muted">
              Recherche une équipe pour la gérer.
            </p>
          )}


          {teamSearch.trim() &&
            searchedTeams.length === 0 && (
              <p className="muted">
                Aucune équipe trouvée.
              </p>
            )}


          {searchedTeams.map((team) => {
            const members =
              getTeamMembers(team.id);

            const currentPoints =
              getTeamPoints(team.id);

            const currentDivision =
              getDivisionFromPoints(
                currentPoints
              );

            const isEditing =
              editingTeamId ===
              team.id;

            return (
              <div
                key={team.id}
                style={{
                  border:
                    '2px solid rgba(11,31,77,.18)',
                  borderRadius:
                    '12px',
                  padding: '20px',
                  marginBottom:
                    '15px',
                }}
              >

                {isEditing ? (
                  <>
                    <h3>
                      Modifier l'équipe
                    </h3>

                    <input
                      type="text"
                      placeholder="Nom de l'équipe"
                      value={
                        editTeamName
                      }
                      onChange={(e) =>
                        setEditTeamName(
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        boxSizing:
                          'border-box',
                        padding: '12px',
                        borderRadius:
                          '8px',
                        border:
                          '2px solid #0b1f4d',
                        marginBottom:
                          '10px',
                        fontFamily:
                          'inherit',
                      }}
                    />

                    <input
                      type="text"
                      placeholder="URL du logo"
                      value={
                        editTeamLogo
                      }
                      onChange={(e) =>
                        setEditTeamLogo(
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        boxSizing:
                          'border-box',
                        padding: '12px',
                        borderRadius:
                          '8px',
                        border:
                          '2px solid #0b1f4d',
                        marginBottom:
                          '10px',
                        fontFamily:
                          'inherit',
                      }}
                    />

                    <input
                      type="text"
                      placeholder="Lien MultiGG"
                      value={
                        editTeamMultiGG
                      }
                      onChange={(e) =>
                        setEditTeamMultiGG(
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        boxSizing:
                          'border-box',
                        padding: '12px',
                        borderRadius:
                          '8px',
                        border:
                          '2px solid #0b1f4d',
                        marginBottom:
                          '10px',
                        fontFamily:
                          'inherit',
                      }}
                    />

                    <textarea
                      placeholder="Description"
                      value={
                        editTeamDescription
                      }
                      onChange={(e) =>
                        setEditTeamDescription(
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        boxSizing:
                          'border-box',
                        padding: '12px',
                        borderRadius:
                          '8px',
                        border:
                          '2px solid #0b1f4d',
                        marginBottom:
                          '10px',
                        minHeight:
                          '100px',
                        fontFamily:
                          'inherit',
                      }}
                    />

                    <div
                      style={{
                        display:
                          'flex',
                        gap: '10px',
                        flexWrap:
                          'wrap',
                      }}
                    >

                      <button
                        className="joinTeamBtn"
                        onClick={() =>
                          saveTeam(
                            team.id
                          )
                        }
                      >
                        Enregistrer
                      </button>

                      <button
                        className="joinTeamBtn"
                        onClick={
                          cancelEditingTeam
                        }
                      >
                        Annuler
                      </button>

                    </div>
                  </>
                ) : (
                  <>

                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: '12px',
                        flexWrap:
                          'wrap',
                      }}
                    >

                      {team.logo_url && (
                        <img
                          src={
                            team.logo_url
                          }
                          alt={
                            team.name
                          }
                          style={{
                            width:
                              '45px',
                            height:
                              '45px',
                            objectFit:
                              'contain',
                            borderRadius:
                              '8px',
                          }}
                        />
                      )}

                      <h3
                        style={{
                          margin: 0,
                        }}
                      >
                        {team.name}
                      </h3>

                      <span
                        className={
                          team.validated_by_admin
                            ? 'teamStatus teamStatusComplete'
                            : 'teamStatus teamStatusIncomplete'
                        }
                      >
                        {team.validated_by_admin
                          ? 'Participante'
                          : 'Non validée'}
                      </span>

                    </div>


                    <p>
                      <strong>
                        Capitaine :
                      </strong>{' '}
                      {team.captain_riot_id ||
                        '-'}
                    </p>


                    <p>
                      <strong>
                        Joueurs :
                      </strong>{' '}
                      {members.length} / 5
                    </p>


                    <p>
                      <strong>
                        Points actuels :
                      </strong>{' '}
                      {currentPoints}
                    </p>


                    <p>
                      <strong>
                        Division :
                      </strong>{' '}
                      {team.validated_by_admin
                        ? team.division ||
                          currentDivision
                        : currentDivision}
                    </p>


                    {team.validated_by_admin &&
                      team.validated_points !==
                        null && (
                        <p>
                          <strong>
                            Points figés :
                          </strong>{' '}
                          {
                            team.validated_points
                          }
                        </p>
                      )}


                    <div
                      style={{
                        marginTop:
                          '14px',
                        marginBottom:
                          '14px',
                      }}
                    >
                      <strong>
                        Membres :
                      </strong>

                      {members.length ===
                        0 && (
                        <p className="muted">
                          Aucun membre.
                        </p>
                      )}

                      {members.map(
                        (member) => {
                          const foundPlayer =
                            players.find(
                              (p) =>
                                p.riot_id ===
                                member.riot_id
                            );

                          return (
                            <p
                              key={
                                member.id
                              }
                            >
                              {
                                member.role
                              }{' '}
                              —{' '}
                              {
                                member.riot_id
                              }{' '}
                              —{' '}
                              {
                                foundPlayer?.czf_points ||
                                0
                              }{' '}
                              pts
                            </p>
                          );
                        }
                      )}
                    </div>


                    <div
                      style={{
                        display:
                          'flex',
                        gap: '10px',
                        flexWrap:
                          'wrap',
                      }}
                    >

                      <button
                        className="joinTeamBtn"
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
                        className="joinTeamBtn"
                        onClick={() =>
                          startEditingTeam(
                            team
                          )
                        }
                      >
                        Modifier
                      </button>

                      <button
                        className="joinTeamBtn"
                        style={{
                          background:
                            '#d32f2f',
                        }}
                        onClick={() =>
                          deleteTeam(
                            team.id,
                            team.name
                          )
                        }
                      >
                        Supprimer l'équipe
                      </button>

                      <a
                        href={`/teams?team=${team.id}`}
                        className="joinTeamBtn"
                        style={{
                          textDecoration:
                            'none',
                          display:
                            'inline-flex',
                          alignItems:
                            'center',
                        }}
                      >
                        Voir la fiche
                      </a>

                    </div>
                  </>
                )}

              </div>
            );
          })}

        </div>


        <br />


        {/* =================================================
            GESTION JOUEURS
        ================================================= */}

        <div className="card">

          <h3>
            Gestion des joueurs
          </h3>

          <div
            style={{
              position: 'relative',
              marginBottom: '20px',
            }}
          >
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={playerSearch}
              onChange={(e) =>
                setPlayerSearch(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                padding:
                  '14px 18px',
                borderRadius:
                  '10px',
                border:
                  '2px solid #0b1f4d',
                background:
                  'transparent',
                color: '#0b1f4d',
                fontSize: '16px',
                fontWeight: '600',
                outline: 'none',
                fontFamily:
                  'inherit',
              }}
            />
          </div>


          {!playerSearch.trim() && (
            <p className="muted">
              Recherche un joueur pour afficher ses informations.
            </p>
          )}


          {playerSearch.trim() &&
            searchedPlayers.length ===
              0 && (
              <p className="muted">
                Aucun joueur trouvé.
              </p>
            )}


          {searchedPlayers.map(
            (player) => {
              const team =
                getPlayerTeam(
                  player
                );

              return (
                <div
                  key={player.id}
                  style={{
                    border:
                      '2px solid rgba(11,31,77,.18)',
                    borderRadius:
                      '12px',
                    padding:
                      '20px',
                    marginBottom:
                      '15px',
                  }}
                >

                  <h3>
                    {player.riot_id}
                  </h3>


                  {player.profiles
                    ?.discord_name && (
                    <p
                      className="discordPlayerName"
                    >
                      {
                        player
                          .profiles
                          .discord_name
                      }
                    </p>
                  )}


                  <p>
                    <strong>
                      Rôle principal :
                    </strong>{' '}
                    {player.main_role ||
                      '-'}
                  </p>


                  <p>
                    <strong>
                      Rôle secondaire :
                    </strong>{' '}
                    {player.secondary_role ||
                      '-'}
                  </p>


                  <p>
                    <strong>
                      Points CZF :
                    </strong>{' '}
                    {player.czf_points ??
                      '-'}
                  </p>


                  <p>
                    <strong>
                      Équipe :
                    </strong>{' '}
                    {team?.name ||
                      'Aucune'}
                  </p>


                  <p>
                    <strong>
                      Participant :
                    </strong>{' '}

                    <span
                      className={
                        team?.validated_by_admin
                          ? 'teamStatus teamStatusComplete'
                          : 'teamStatus teamStatusIncomplete'
                      }
                    >
                      {team?.validated_by_admin
                        ? 'Oui'
                        : 'Non'}
                    </span>
                  </p>


                  <p>
                    <strong>
                      LFT :
                    </strong>{' '}

                    <span
                      className={
                        player.lft
                          ? 'statusOn'
                          : 'statusOff'
                      }
                    >
                      {player.lft
                        ? 'Oui'
                        : 'Non'}
                    </span>
                  </p>


                  {team && (
                    <a
                      href={`/teams?team=${team.id}`}
                      className="joinTeamBtn"
                      style={{
                        textDecoration:
                          'none',
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                      }}
                    >
                      Voir son équipe
                    </a>
                  )}

                </div>
              );
            }
          )}

        </div>

      </main>
    </>
  );
}