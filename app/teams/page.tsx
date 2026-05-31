
import Nav from '../components/Nav';

export default function TeamsPage() {
  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Équipes</h2>
        </div>

        <div className="grid three">
          <div className="card">
            <h3>Targon</h3>
            <p>Division élite du CZF.</p>
          </div>

          <div className="card">
            <h3>Ixtal</h3>
            <p>Division intermédiaire du CZF.</p>
          </div>

          <div className="card">
            <h3>Yordle</h3>
            <p>Division développement du CZF.</p>
          </div>
        </div>
      </main>
    </>
  );
}