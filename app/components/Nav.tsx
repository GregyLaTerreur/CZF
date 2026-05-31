export default function Nav() {
  return (
    <nav className="nav">
      <img src="/assets/czf-logo.png" alt="CZF" />

      <div>
        <a href="/">Accueil</a>
        <a href="/divisions">Divisions</a>
        <a href="/teams">Équipes</a>
        <a href="/players">Joueurs</a>
        <a href="/calendar">Calendrier</a>
        <a href="/results">Résultats</a>
        <a href="/hall-of-fame">Hall of Fame</a>
        <a href="#rulebook">Rulebook</a>
      </div>
    </nav>
  );
}
