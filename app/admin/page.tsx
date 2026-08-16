'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
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

  async function refreshAllRiot() {
    setMessage('Actualisation Riot en cours...');

    const res = await fetch('/api/admin/refresh-riot', {
      method: 'PATCH',
    });

    const data = await res.json();

    if (data.success) {
      setMessage('Tous les joueurs ont été actualisés ✅');
      await loadData();
    } else {
      setMessage('Erreur actualisation Riot ❌');
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
    if (points >= 6101) {
      return 'Targon';
    }

    if (points >= 3901) {
      return 'Ixtal';
    }

    return 'Yordle';
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

        // Valeurs à figer au moment de la validation
        validated_points: validated ? points : null,
        division: validated ? division : null,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(
        validated
          ? `Équipe validée ✅ ${points} points — ${division}`
          : 'Équipe dévalidée ✅'
      );

      await loadData();
    } else {
      setMessage(
        data.message || 'Erreur validation ❌'
      );
    }
  }

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

        <div className="card">
          <h3>Actions rapides</h3>

          <button
            className="joinTeamBtn"
            onClick={refreshAllRiot}
          >
            🔄 Actualiser tous les joueurs Riot
          </button>

          {message && (
            <p>{message}</p>
          )}
        </div>

        <br />

        <div className="card">
          <h3>Statistiques</h3>

          <p>
            Joueurs : {players.length}
          </p>

          <p>
            Équipes : {teams.length}
          </p>

          <p>
            LFT : {players.filter((p) => p.lft).length}
          </p>
        </div>

        <br />

        <div className="card">
          <h3>Équipes</h3>

          {teams.map((team) => {
            const members = getTeamMembers(team.id);

            const currentPoints = getTeamPoints(team.id);

            const currentDivision =
              getDivisionFromPoints(currentPoints);

            return (
              <div
                key={team.id}
                style={{
                  borderBottom:
                    '1px solid rgba(0,0,0,.15)',
                  paddingBottom: '20px',
                  marginBottom: '20px',
                }}
              >
                <h4>
                  {team.name}
                </h4>

                <p>
                  <strong>Capitaine :</strong>{' '}
                  {team.captain_riot_id}
                </p>

                <p>
                  <strong>Joueurs :</strong>{' '}
                  {members.length} / 5
                </p>

                <p>
                  <strong>
                    Points actuels :
                  </strong>{' '}
                  {currentPoints}
                </p>

                {!team.validated_by_admin && (
                  <p>
                    <strong>
                      Division actuelle :
                    </strong>{' '}
                    {currentDivision}
                  </p>
                )}

                {team.validated_by_admin && (
                  <>
                    <p>
                      <strong>
                        Points CZF figés :
                      </strong>{' '}
                      {team.validated_points ??
                        currentPoints}
                    </p>

                    <p>
                      <strong>
                        Division officielle :
                      </strong>{' '}
                      {team.division || currentDivision}
                    </p>
                  </>
                )}

                <p>
                  <strong>Statut :</strong>{' '}

                  {team.validated_by_admin
                    ? '🟢 Validée'
                    : '🔴 Non validée'}
                </p>

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

                <div
                  style={{
                    marginTop: '12px',
                  }}
                >
                  {members.map((member) => {
                    const player = players.find(
                      (p) =>
                        p.riot_id ===
                        member.riot_id
                    );

                    return (
                      <p key={member.id}>
                        {member.role} -{' '}
                        {member.riot_id} -{' '}
                        {player?.czf_points || 0}{' '}
                        pts
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}