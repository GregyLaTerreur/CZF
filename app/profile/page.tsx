'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
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

    const { data: members } = await supabase
      .from('team_members')
      .select('*');

    const memberLine = members?.find(
      (m: any) => m.riot_id === linkedPlayer.riot_id
    );

    const { data: teams } = await supabase
      .from('teams')
      .select('*');

    const captainTeam = teams?.find(
      (t: any) => t.captain_player_id === linkedPlayer.id
    );

    const memberTeam = teams?.find(
      (t: any) => t.id === memberLine?.team_id
    );

    setTeam(captainTeam || memberTeam || null);
  }

  async function toggleLft() {
  if (!player) return;

  const res = await fetch('/api/players', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      player_id: player.id,
      lft: !player.lft,
    }),
  });

  const data = await res.json();

  if (data.success) {
    setPlayer({
      ...player,
      lft: !player.lft,
    });
  } else {
    alert('Erreur ❌');
  }
}

async function refreshRiot() {
  if (!player) return;

  const res = await fetch('/api/players/riot-refresh', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      player_id: player.id,
    }),
  });

  const data = await res.json();

  if (data.success) {
    alert('Données Riot actualisées ✅');
    window.location.reload();
  } else {
    alert(data.message || 'Erreur Riot ❌');
  }
}

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Mon profil</h2>
        </div>

        {!user && (
          <div className="card">
            <h3>Non connecté</h3>
            <p>
              Connecte-toi avec Discord pour accéder à ton profil CZF.
            </p>
            <a href="/login" className="rulebookButton">
              Connexion Discord
            </a>
          </div>
        )}

        {user && (
          <div className="card">
            <h3>
              {user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                'Profil CZF'}
            </h3>

            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar Discord"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: 15,
                }}
              />
            )}

            {!player && (
              <>
                <p>Aucun profil joueur lié pour le moment.</p>
                <a href="/players" className="rulebookButton">
                  Créer mon profil joueur
                </a>
              </>
            )}

            {player && (
              <>
                <p>
                  <strong>Riot ID :</strong> {player.riot_id}
                </p>

                <p>
                  <strong>Rôle principal :</strong> {player.main_role}
                </p>

                <p>
                  <strong>Rôle secondaire :</strong>{' '}
                  {player.secondary_role || '-'}
                </p>

                <p>
                  <strong>Équipe :</strong>{' '}
                  {team ? team.name : 'Aucune équipe'}
                </p>

                <p>
  <strong>LFT :</strong>{' '}
  {player.lft ? '🟢 Oui' : '🔴 Non'}
</p>

<button
  className="joinTeamBtn"
  onClick={toggleLft}
>
  {player.lft
    ? 'Ne plus être LFT'
    : 'Me mettre LFT'}
</button>

                <p>
                  <strong>Points CZF :</strong> bientôt disponible
                </p>

    <button
  className="joinTeamBtn"
  onClick={refreshRiot}
>
  🔄 Actualiser mes données Riot
</button>

                <p>
                  <strong>Rang Riot :</strong> bientôt disponible
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}