'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export default function MyTeamPage() {
  const [user, setUser] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    loadMyTeam();
  }, []);

  async function loadMyTeam() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) return;

    const { data: players } = await supabase
      .from('players')
      .select('*');

    const linkedPlayer = players?.find(
      (p: any) => p.profile_id === user.id
    );

    setPlayer(linkedPlayer || null);

    if (!linkedPlayer) return;

    const { data: allMembers } = await supabase
      .from('team_members')
      .select('*');

    const myMemberLine = allMembers?.find(
      (m: any) => m.riot_id === linkedPlayer.riot_id
    );

    const { data: allTeams } = await supabase
      .from('teams')
      .select('*');

    const captainTeam = allTeams?.find(
      (t: any) => t.captain_player_id === linkedPlayer.id
    );

    const memberTeam = allTeams?.find(
      (t: any) => t.id === myMemberLine?.team_id
    );

    const foundTeam = captainTeam || memberTeam || null;

    setTeam(foundTeam);

    if (foundTeam) {
      const currentMembers =
        allMembers?.filter(
          (m: any) => m.team_id === foundTeam.id
        ) || [];

      setMembers(currentMembers);
    } else {
      setMembers([]);
    }
  }

  function getRolePlayer(role: string) {
    const member = members.find((m) => m.role === role);
    return member?.riot_id || '-';
  }

  async function leaveTeam() {
    if (!team || !player) return;

    if (team.captain_player_id === player.id) {
      alert(
        "Le capitaine ne peut pas quitter son équipe pour l'instant."
      );
      return;
    }

    const res = await fetch('/api/team-members', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        team_id: team.id,
        riot_id: player.riot_id,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Tu as quitté l'équipe ✅");
      await loadMyTeam();
    } else {
      alert('Erreur ❌');
    }
  }

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Mon équipe</h2>
        </div>

        {!user && (
          <div className="card">
            <h3>Non connecté</h3>
            <p>Connecte-toi avec Discord.</p>
            <a href="/login" className="rulebookButton">
              Connexion Discord
            </a>
          </div>
        )}

        {user && !player && (
          <div className="card">
            <h3>Aucun profil joueur</h3>
            <p>Crée d'abord ton profil joueur CZF.</p>
            <a href="/players" className="rulebookButton">
              Créer mon profil joueur
            </a>
          </div>
        )}

        {user && player && !team && (
          <div className="card">
            <h3>Aucune équipe</h3>
            <p>Tu n'es dans aucune équipe pour le moment.</p>
            <a href="/teams" className="rulebookButton">
              Voir les équipes
            </a>
          </div>
        )}

        {user && player && team && (
          <div className="card">
            <h3>{team.name}</h3>

            {team.logo_url && (
              <img
                src={team.logo_url}
                alt={team.name}
                className="teamLogoBig"
              />
            )}

            <p>
              <strong>Capitaine :</strong>{' '}
              {team.captain_riot_id || '-'}
            </p>

            <p>
              <strong>Division :</strong>{' '}
              {team.division || '-'}
            </p>

            <p>
              <strong>Description :</strong>{' '}
              {team.description || '-'}
            </p>

            {team.multigg_url && (
              <p>
                <a
                  href={team.multigg_url}
                  target="_blank"
                  rel="noreferrer"
                  className="multiggLink"
                >
                  Cliquez pour ouvrir la page MultiGG →
                </a>
              </p>
            )}

            <h4>Roster</h4>

            {ROLES.map((role) => (
              <p key={role}>
                {role} : {getRolePlayer(role)}
              </p>
            ))}

            <button
              className="joinTeamBtn"
              onClick={leaveTeam}
            >
              Quitter l'équipe
            </button>
          </div>
        )}
      </main>
    </>
  );
}