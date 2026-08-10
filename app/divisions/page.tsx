'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';

export default function DivisionsPage() {
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      const res = await fetch('/api/teams');
      const data = await res.json();

      if (data.teams) {
        setTeams(data.teams);
      }
    }

    fetchTeams();
  }, []);

  const validatedTeams = teams.filter((team) => team.is_validated === true);

  const targonTeams = validatedTeams.filter((team) => team.division === 'Targon');
  const ixtalTeams = validatedTeams.filter((team) => team.division === 'Ixtal');
  const yordleTeams = validatedTeams.filter((team) => team.division === 'Yordle');

  function DivisionCard({
    title,
    description,
    range,
    teams,
  }: {
    title: string;
    description: string;
    range: string;
    teams: any[];
  }) {
    return (
      <div className="card">
        <h3>{title}</h3>

        <p>{description}</p>

        <br />

        <p>
          <strong>Barème équipe :</strong> {range}
        </p>

        <div className="divisionTeamsGrid">
          {teams.slice(0, 8).length > 0 ? (
            teams.slice(0, 8).map((team) => (
              <a
                key={team.id}
                href={`/teams#team-${team.id}`}
                className="divisionTeamButton"
              >
                {team.name}
              </a>
            ))
          ) : (
            <p className="muted">Aucune équipe validée pour le moment.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Divisions</h2>
        </div>

        <div className="card">
          <h3>Fonctionnement des divisions</h3>

          <p>
            Les divisions CZF sont attribuées aux équipes validées par les admins.
            Chaque équipe est placée en Yordle, Ixtal ou Targon selon son total
            de points CZF.
          </p>

          <p>
            Une fois validée, l'équipe apparaît dans sa division. En cliquant sur
            son bouton, vous êtes redirigé directement vers sa fiche dans l'onglet
            Équipes.
          </p>
        </div>

        <br />

        <DivisionCard
          title="🟣 Targon"
          description="La division élite du CZF."
          range="6101 à 8000 points CZF"
          teams={targonTeams}
        />

        <br />

        <DivisionCard
          title="🔵 Ixtal"
          description="La division intermédiaire du CZF."
          range="3901 à 7100 points CZF"
          teams={ixtalTeams}
        />

        <br />

        <DivisionCard
          title="🟢 Yordle"
          description="La division développement du CZF."
          range="0 à 3900 points CZF"
          teams={yordleTeams}
        />
      </main>
    </>
  );
}