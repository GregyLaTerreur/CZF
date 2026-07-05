'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

const tiers = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];

const ranks = ['IV', 'III', 'II', 'I'];

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);

  const [editing, setEditing] = useState(false);
  const [editMainRole, setEditMainRole] = useState('');
  const [editSecondaryRole, setEditSecondaryRole] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPeakTier, setEditPeakTier] = useState('');
  const [editPeakRank, setEditPeakRank] = useState('');
  const [editPeakLp, setEditPeakLp] = useState('0');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) return;

    const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', user.id)
  .maybeSingle();

if (!existingProfile) {
  await supabase.from('profiles').insert([
    {
      id: user.id,
      discord_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        'Joueur',
    },
  ]);
}

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

  function getRankText(player: any) {
    if (!player?.soloq_tier) return 'Unranked';

    if (
      ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(player.soloq_tier)
    ) {
      return `${player.soloq_tier} ${player.soloq_lp || 0} LP`;
    }

    return `${player.soloq_tier} ${player.soloq_rank || ''} ${
      player.soloq_lp || 0
    } LP`;
  }

  function getPeakText(player: any) {
    if (!player?.peak_tier) return '-';

    if (
      ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(player.peak_tier)
    ) {
      return `${player.peak_tier} ${player.peak_lp || 0} LP`;
    }

    return `${player.peak_tier} ${player.peak_rank || ''} ${
      player.peak_lp || 0
    } LP`;
  }

  function getWinrate(player: any) {
    const wins = player?.soloq_wins || 0;
    const losses = player?.soloq_losses || 0;
    const total = wins + losses;

    if (total === 0) return '-';

    return `${Math.round((wins / total) * 100)}%`;
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

  async function refreshRiot(showAlert = true) {
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
      if (showAlert) {
        alert('Données Riot actualisées ✅');
      }

      window.location.reload();
    } else {
      alert(data.message || 'Erreur Riot ❌');
    }
  }

  function startEditProfile() {
    if (!player) return;

    setEditing(true);
    setEditMainRole(player.main_role || '');
    setEditSecondaryRole(player.secondary_role || '');
    setEditDescription(player.description || '');
    setEditPeakTier(player.peak_tier || '');
    setEditPeakRank(player.peak_rank || '');
    setEditPeakLp(String(player.peak_lp || 0));
  }

  async function saveProfile() {
    if (!player) return;

    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player_id: player.id,
        main_role: editMainRole,
        secondary_role: editSecondaryRole || null,
        description: editDescription || null,
        peak_tier: editPeakTier || null,
        peak_rank:
          ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(editPeakTier)
            ? null
            : editPeakRank || null,
        peak_lp: Number(editPeakLp) || 0,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert('Profil modifié ✅ Recalcul des points...');
      await refreshRiot(false);
    } else {
      alert('Erreur modification profil ❌');
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

            {player && !editing && (
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
                  <strong>Peak déclaré :</strong> {getPeakText(player)}
                </p>

                <p>
                  <strong>Rank SoloQ :</strong> {getRankText(player)}
                </p>

                <p>
                  <strong>Winrate SoloQ :</strong> {getWinrate(player)}
                </p>

                <p>
                  <strong>Games SoloQ :</strong>{' '}
                  {(player.soloq_wins || 0) + (player.soloq_losses || 0)}
                </p>

                <p>
                  <strong>Points CZF :</strong>{' '}
                  {player.czf_points ?? '-'}
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
                  onClick={startEditProfile}
                >
                  Modifier mon profil
                </button>

                <button
                  className="joinTeamBtn"
                  onClick={() => refreshRiot(true)}
                  style={{ marginLeft: '10px' }}
                >
                  🔄 Actualiser Riot
                </button>

                <button
                  className="joinTeamBtn"
                  onClick={toggleLft}
                  style={{ marginLeft: '10px' }}
                >
                  {player.lft ? 'Ne plus être LFT' : 'Me mettre LFT'}
                </button>
              </>
            )}

            {player && editing && (
              <>
                <h3>Modifier mon profil</h3>

                <label>Rôle principal</label>
                <select
                  value={editMainRole}
                  onChange={(e) => setEditMainRole(e.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                <br />
                <br />

                <label>Rôle secondaire</label>
                <select
                  value={editSecondaryRole}
                  onChange={(e) => setEditSecondaryRole(e.target.value)}
                >
                  <option value="">Aucun</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                <br />
                <br />

                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                />

                <br />
                <br />

                <label>Peak elo déclaré</label>
                <select
                  value={editPeakTier}
                  onChange={(e) => {
                    setEditPeakTier(e.target.value);
                    setEditPeakRank('');
                  }}
                >
                  <option value="">Aucun</option>
                  {tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>

                {editPeakTier &&
                  !['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(
                    editPeakTier
                  ) && (
                    <select
                      value={editPeakRank}
                      onChange={(e) => setEditPeakRank(e.target.value)}
                    >
                      <option value="">Division</option>
                      {ranks.map((rank) => (
                        <option key={rank} value={rank}>
                          {rank}
                        </option>
                      ))}
                    </select>
                  )}

                {editPeakTier && (
                  <input
                    type="number"
                    value={editPeakLp}
                    onChange={(e) => setEditPeakLp(e.target.value)}
                    placeholder="LP"
                  />
                )}

                <br />
                <br />

                <button
                  className="joinTeamBtn"
                  onClick={saveProfile}
                >
                  Enregistrer
                </button>

                <button
                  className="joinTeamBtn"
                  onClick={() => setEditing(false)}
                  style={{ marginLeft: '10px' }}
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}