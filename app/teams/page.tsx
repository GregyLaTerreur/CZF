'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';

export default function TeamsPage() {
  const [teamName, setTeamName] = useState('');
  const [captainRiotId, setCaptainRiotId] = useState('')
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [multiggUrl, setMultiggUrl] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [openTeam, setOpenTeam] = useState<number | null>(null);
  

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    const res = await fetch('/api/teams');
    const data = await res.json();

    if (data.success) {
      setTeams(data.data);
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    console.log('TEAM SUBMIT');
    e.preventDefault();

    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: teamName,
        captain_riot_id: captainRiotId,
        description,
        logo_url: logoUrl,
        multigg_url: multiggUrl,
}),
    });

    const data = await res.json();

    if (data.success) {
      setMessage('Équipe créée avec succès ✅');
      setTeamName('');
      setCaptainRiotId('');
      fetchTeams();
    } else {
      setMessage('Erreur lors de la création ❌');
    }
  }

  return (
    <>
      <Nav />

      <main className="section">

        <div className="sectionTitle">
          <span></span>
          <h2>Équipes</h2>
        </div>

        <div className="card">

          <h3>Créer une équipe</h3>

          <form onSubmit={handleCreateTeam} className="fakeForm">

            <input
              placeholder="Nom de l'équipe"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />

            <input
              placeholder="Riot ID du capitaine"
              value={captainRiotId}
              onChange={(e) => setCaptainRiotId(e.target.value)}
              required
            />

<input
  placeholder="URL du logo"
  value={logoUrl}
  onChange={(e) => setLogoUrl(e.target.value)}
/>

<input
  placeholder="Lien MultiGG"
  value={multiggUrl}
  onChange={(e) => setMultiggUrl(e.target.value)}
/>

<textarea
  placeholder="Description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

            <button type="submit">
              Créer l'équipe
            </button>

          </form>

          {message && <p>{message}</p>}

        </div>

        <br />

        <div className="card">

          <h3>Liste des équipes</h3>

          <div className="playersTable">

            <div className="teamsHeader">
               <div></div>   {/* flèche */}
  <div>Équipe</div>
  <div>Capitaine</div>
  <div>Division</div>
  <div>Joueurs</div>
  <div>Statut</div>

            </div>

            {teams.map((team) => (

  <div key={team.id}>

    <div className="teamRow">

      <div
        className="teamArrow"
        onClick={() =>
          setOpenTeam(
            openTeam === team.id
              ? null
              : team.id
          )
        }
      >
        {openTeam === team.id ? '▼' : '▶'}
      </div>

     <div className="teamNameCell">

  {team.logo_url && (
    <img
      className="teamLogoSmall"
      src={team.logo_url}
      alt={team.name}
    />
  )}

  <span>{team.name}</span>

</div>
<div>{team.captain_riot_id}</div>

<div>
  {team.division || '-'}
</div>

      <div>1 / 5</div>

      <div>
        {team.validated_by_admin
          ? '🟢 Validée'
          : '🔴 Incomplète'}
      </div>

    </div>

    {openTeam === team.id && (

      <div className="teamDetails">

        <div className="teamInfos">

          <h3>{team.name}</h3>

            <p>
              <strong>Capitaine :</strong> {team.captain_riot_id}
            </p>
            <p>
             <strong>Description :</strong> {team.description || '-'}
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
          <button className="joinTeamBtn">
  Demander à rejoindre
</button>

          <h4>Joueurs</h4>

          <p>Top : -</p>
          <p>Jungle : -</p>
          <p>Mid : -</p>
          <p>ADC : -</p>
          <p>Support : -</p>

        </div>

        <div className="teamLogoBigContainer">

          {team.logo_url && (
            <img
              className="teamLogoBig"
              src={team.logo_url}
              alt={team.name}
            />
          )}

        </div>

      </div>

    )}

  </div>

))}

          </div>

        </div>

      </main>
    </>
  );
}