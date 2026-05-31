import Nav from '../components/Nav';

export default function PlayersPage() {
  return (
    <>
      <Nav />

      <main className="section">

        <div className="sectionTitle">
          <span></span>
          <h2>Joueurs</h2>
        </div>

        <div className="card">

          <h3>Recherche Riot ID</h3>

          <div className="fakeForm">
            <input placeholder="Pseudo#TAG" />
            <button>Rechercher</button>
          </div>

        </div>

        <br />

        <div className="card">
          <h3>Liste des joueurs</h3>

          <p>
            Les joueurs inscrits apparaîtront ici avec :
          </p>

          <ul>
            <li>Logo de rang</li>
            <li>Rang actuel</li>
            <li>Peak Elo</li>
            <li>Score CZF</li>
            <li>Top 3 champions</li>
            <li>Lien OPGG</li>
            <li>Lien DPM</li>
          </ul>

        </div>

      </main>
    </>
  );
}