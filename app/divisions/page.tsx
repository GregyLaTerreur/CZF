'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';

export default function DivisionsPage() {
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      const res = await fetch('/api/teams');
      const data = await res.json();

      if (data.success && data.data) {
        setTeams(data.data);
      }
    }

    fetchTeams();
  }, []);

  const validatedTeams = teams.filter(
    (team) => team.validated_by_admin === true
  );

  const targonTeams = validatedTeams.filter(
    (team) => team.division === 'Targon'
  );

  const ixtalTeams = validatedTeams.filter(
    (team) => team.division === 'Ixtal'
  );

  const yordleTeams = validatedTeams.filter(
    (team) => team.division === 'Yordle'
  );

  function DivisionCard({
    title,
    description,
    range,
    teams,
    variant,
  }: {
    title: string;
    description: string;
    range: string;
    teams: any[];
    variant: 'targon' | 'ixtal' | 'yordle';
  }) {
    return (
      <div className={`card divisionCard divisionCard-${variant}`}>
        <div className="divisionCardHeader">
          <h3>{title}</h3>
        </div>

        <p>{description}</p>

        <div className="divisionRange">
          <strong>Barème équipe :</strong> {range}
        </div>

        <div className="divisionTeamsGrid">
          {teams.length > 0 ? (
            teams.slice(0, 12).map((team) => (
              <a
                key={team.id}
                href={`/teams?team=${team.id}`}
                className="divisionTeamButton"
              >
                {team.logo_url && (
                  <img
                    src={team.logo_url}
                    alt={`Logo ${team.name}`}
                    className="divisionTeamLogo"
                  />
                )}

                <div className="divisionTeamText">
                  <span className="divisionTeamName">
                    {team.name}
                  </span>

                  {team.validated_points !== null &&
                    team.validated_points !== undefined && (
                      <div className="divisionTeamPoints">
                        {team.validated_points} pts
                      </div>
                    )}
                </div>
              </a>
            ))
          ) : (
            <p className="muted">
              Aucune équipe validée pour le moment.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav />

      <main className="section divisionsPage">
        <div className="sectionTitle">
          <span></span>
          <h2>Divisions</h2>
        </div>

        {/* FONCTIONNEMENT — MARINE */}
        <div className="card divisionsIntroCard">
          <h3>Fonctionnement des divisions</h3>

          <p>
            Les divisions CZF sont attribuées aux équipes validées
            par les admins. Chaque équipe est placée en Yordle,
            Ixtal ou Targon selon son total de points CZF au moment
            de sa validation.
          </p>

          <p>
            Une fois validée, l&apos;équipe apparaît dans sa division.
            En cliquant dessus, vous êtes redirigé directement vers
            sa fiche dans l&apos;onglet Équipes.
          </p>
        </div>

        <br />

        <DivisionCard
          title="Targon"
          description="La division élite du CZF."
          range="6101 à 8000 points CZF"
          teams={targonTeams}
          variant="targon"
        />

        <br />

        <DivisionCard
          title="Ixtal"
          description="La division intermédiaire du CZF."
          range="3901 à 6100 points CZF"
          teams={ixtalTeams}
          variant="ixtal"
        />

        <br />

        <DivisionCard
          title="Yordle"
          description="La division développement du CZF."
          range="0 à 3900 points CZF"
          teams={yordleTeams}
          variant="yordle"
        />
      </main>
    </>
  );
}