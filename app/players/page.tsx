'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';

export default function PlayersPage() {
  const [riotId, setRiotId] = useState('');
  const [mainRole, setMainRole] = useState('');
  const [secondaryRole, setSecondaryRole] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch('/api/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        riot_id: riotId,
        main_role: mainRole,
        secondary_role: secondaryRole || null,
        description: description || null,
      }),
    });

    const data = await res.json();

    if (data.success) {
      fetchPlayers();
      setMessage('Profil créé avec succès ✅');
      setRiotId('');
      setMainRole('');
      setSecondaryRole('');
      setDescription('');
    } else {
      setMessage('Erreur lors de la création du profil ❌');
    }
  }

  const roles = [
    { name: 'Top', image: '/assets/roles/top.png' },
    { name: 'Jungle', image: '/assets/roles/jungle.png' },
    { name: 'Mid', image: '/assets/roles/mid.png' },
    { name: 'ADC', image: '/assets/roles/adc.png' },
    { name: 'Support', image: '/assets/roles/sup.png' },
  ];
  useEffect(() => {
  fetchPlayers();
  fetch('/api/teams')
  .then((res) => res.json())
  .then((data) => {
    if (data.success) {
      setTeams(data.data);
    }
  });
}, []);

async function fetchPlayers() {
  const res = await fetch('/api/players');
  const data = await res.json();

  if (data.success) {
    setPlayers(data.data);
  }
}

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Joueurs</h2>
        </div>

        <div className="card">
          <h3>Créer mon profil</h3>

          <form onSubmit={handleSubmit} className="fakeForm">
            <input
              placeholder="Riot ID (Pseudo#TAG)"
              value={riotId}
              onChange={(e) => setRiotId(e.target.value)}
              required
            />

            <div className="rolesContainer">
              <div className="roleSection">
                <h4>RÔLE PRINCIPAL</h4>

                <div className="rolePicker">
                  {roles.map((role) => (
                    <button
                      key={role.name}
                      type="button"
                      className={
                        mainRole === role.name
                          ? 'roleBtn active'
                          : 'roleBtn'
                      }
                      onClick={() => setMainRole(role.name)}
                    >
                      <img src={role.image} alt={role.name} />
                      <span>{role.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="roleSection">
                <h4>RÔLE SECONDAIRE (OPTIONNEL)</h4>

                <div className="rolePicker">
                  {roles.map((role) => (
                    <button
                      key={`secondary-${role.name}`}
                      type="button"
                      className={
                        secondaryRole === role.name
                          ? 'roleBtn active'
                          : 'roleBtn'
                      }
                      onClick={() => setSecondaryRole(role.name)}
                    >
                      <img src={role.image} alt={role.name} />
                      <span>{role.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button type="submit">
              Créer mon profil
            </button>
          </form>

          {message && <p>{message}</p>}
        </div>

        <br />

        <div className="card">
          <h3>Liste des joueurs</h3>
          
          <div className="playersTable">

  <div className="playersHeader">
    <div>Riot ID</div>
    <div>Rôle principal</div>
    <div>Rôle secondaire</div>
    <div>Rank</div>
    <div>WR</div>
    <div>Champions</div>
    <div>LFT</div>
  </div>

  {players.map((player) => (

    <div key={player.id} className="playerRow">

      <div>{player.riot_id}</div>

      <div>
        {player.main_role && (
          <img
            className="roleIcon"
            src={
              player.main_role === 'Support'
                ? '/assets/roles/sup.png'
                : `/assets/roles/${player.main_role.toLowerCase()}.png`
            }
            alt={player.main_role}
          />
        )}
      </div>

      <div>
        {player.secondary_role && (
          <img
            className="roleIcon"
            src={
              player.secondary_role === 'Support'
                ? '/assets/roles/sup.png'
                : `/assets/roles/${player.secondary_role.toLowerCase()}.png`
            }
            alt={player.secondary_role}
          />
        )}
      </div>

      <div>-</div>
      <div>-</div>
      <div>-</div>


    </div>

  ))}

</div>

        </div>
      </main>
    </>
  );
}
