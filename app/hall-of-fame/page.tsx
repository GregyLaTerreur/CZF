import Nav from '../components/Nav';

export default function HallOfFamePage() {
  return (
    <>
      <Nav />

      <main className="section">

        <div className="sectionTitle">
          <span></span>
          <h2>Hall Of Fame</h2>
        </div>

        <div className="card">
          <h3>Champions CZF</h3>
          <p>Les vainqueurs de chaque saison apparaîtront ici.</p>
        </div>

        <br />

        <div className="card">
          <h3>MVP Split</h3>
          <p>Historique des MVP du tournoi.</p>
        </div>

        <br />

        <div className="card">
          <h3>Records</h3>
          <p>Kills, MVP, titres et performances CZF.</p>
        </div>

      </main>
    </>
  );
}