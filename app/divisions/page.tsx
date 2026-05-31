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
          <h3>Targon</h3>

          <p>
            La division élite du CZF.
          </p>

          <br />

          <p>
            <strong>Barème :</strong> 250 à 349 points CZF
          </p>

          <p>
            <strong>Objectif :</strong> regrouper les meilleures équipes du tournoi.
          </p>

          <p>
            <strong>Limite individuelle :</strong> aucun joueur ne peut dépasser le plafond CZF défini par le règlement.
          </p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir les équipes Targon
          </a>
        </div>

        <br />

        <div className="card">
          <h3>Ixtal</h3>

          <p>
            La division intermédiaire du CZF.
          </p>

          <br />

          <p>
            <strong>Barème :</strong> 150 à 249 points CZF
          </p>

          <p>
            Équipes compétitives cherchant à accéder à Targon.
          </p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir les équipes Ixtal
          </a>
        </div>

        <br />

        <div className="card">
          <h3>Yordle</h3>

          <p>
            La division développement du CZF.
          </p>

          <br />

          <p>
            <strong>Barème :</strong> 0 à 149 points CZF
          </p>

          <p>
            Pensée pour les équipes débutantes ou en progression.
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