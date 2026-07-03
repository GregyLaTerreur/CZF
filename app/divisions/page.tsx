import Nav from '../components/Nav';

export default function DivisionsPage() {
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
            Les divisions CZF ne sont pas attribuées à un joueur seul, mais à
            une équipe complète.
          </p>

          <p>
            Chaque joueur possède un score CZF individuel. Les points des 5
            joueurs sont additionnés pour obtenir le total de l'équipe.
          </p>

          <p>
            C'est ce total qui détermine la division de l'équipe : Yordle,
            Ixtal ou Targon.
          </p>
        </div>

        <br />

        <div className="card">
          <h3>🟣 Targon</h3>

          <p>La division élite du CZF.</p>

          <br />

          <p>
            <strong>Barème équipe :</strong> 7101+ points CZF
          </p>

          <p>
            <strong>Objectif :</strong> regrouper les équipes les plus fortes
            du tournoi.
          </p>

          <p>
            Une équipe Targon possède généralement plusieurs joueurs Emerald,
            Diamond ou Master.
          </p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir les équipes Targon
          </a>
        </div>

        <br />

        <div className="card">
          <h3>🔵 Ixtal</h3>

          <p>La division intermédiaire du CZF.</p>

          <br />

          <p>
            <strong>Barème équipe :</strong> 3901 à 7100 points CZF
          </p>

          <p>
            <strong>Objectif :</strong> créer une division compétitive pour les
            équipes Gold, Platinum, Emerald et parfois Diamond.
          </p>

          <p>
            Ixtal est pensée comme la division centrale du tournoi.
          </p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir les équipes Ixtal
          </a>
        </div>

        <br />

        <div className="card">
          <h3>🟢 Yordle</h3>

          <p>La division développement du CZF.</p>

          <br />

          <p>
            <strong>Barème équipe :</strong> 0 à 3900 points CZF
          </p>

          <p>
            <strong>Objectif :</strong> permettre aux équipes débutantes ou en
            progression d'évoluer dans une division adaptée.
          </p>

          <p>
            Yordle regroupe généralement les équipes composées majoritairement
            de joueurs Bronze, Silver et Gold.
          </p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir les équipes Yordle
          </a>
        </div>
      </main>
    </>
  );
}