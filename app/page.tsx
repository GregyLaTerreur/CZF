import Nav from './components/Nav';
import Section from './components/Section';
import { results } from '@/lib/data';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default function Home() {
  return (
    <main>
      <Nav />

      <header id="accueil" className="hero">
        <div className="heroText">
          <p className="eyebrow">League of Legends Tournament</p>
          <h1>
            CLASH DES ZÉROS
            <br />
            DE LA FAILLE
          </h1>
          <p>
            Une ligue communautaire structurée autour de trois divisions :
            Yordle, Ixtal et Targon.
          </p>

          <div className="heroActions">
            <a href="#equipes">Voir les équipes</a>
            <a href="#compte">Créer mon profil CZF</a>
          </div>
        </div>

        <img
          className="heroLogo"
          src="/assets/czf-logo.png"
          alt="Logo CZF"
        />
      </header>

      <Section id="discord" title="Discord">
        <div className="card discordCard">
          <h3>Rejoins la communauté CZF</h3>

          <p>
            Rejoindre le discord est obligatoire pour participer au tournoi.
            Toutes les annonces, les inscriptions, les résultats et le suivi du
            tournoi se font sur notre serveur Discord.
          </p>

          <br />

          <a
            href="https://discord.gg/ZWSmEGrv2s"
            target="_blank"
            rel="noopener noreferrer"
            className="joinTeamBtn"
          >
            🚀 Rejoindre le Discord
          </a>
        </div>
      </Section>

<Section id="divisions" title="Divisions">
  <div className="grid three">
    <article className="card">
      <h3>Targon</h3>
      <p>Division Élite</p>
      <p>6101 à 8000 points CZF</p>
    </article>

    <article className="card">
      <h3>Ixtal</h3>
      <p>Division Intermédiaire</p>
      <p>3901 à 6100 points CZF</p>
    </article>

    <article className="card">
      <h3>Yordle</h3>
      <p>Division Développement</p>
      <p>0 à 3900 points CZF</p>
    </article>
  </div>

  <div className="card" style={{ marginTop: '24px' }}>
    <h3>Comment fonctionnent les divisions ?</h3>

    <p>
      Les divisions ne sont pas attribuées à un joueur, mais à l'équipe entière.
      Chaque joueur possède un score CZF individuel calculé à partir de son
      niveau.
    </p>

    <p>
      Avant le début du tournoi, les points des 5 joueurs sont additionnés afin
      d'obtenir le total de l'équipe. C'est ce total qui détermine la division :
      Yordle, Ixtal ou Targon.
    </p>

    <p>
      Ainsi, n'importe quel joueur peut évoluer dans n'importe quelle division,
      selon la composition de son équipe. L'objectif n'est pas de classer les
      joueurs individuellement, mais de créer des équipes équilibrées et des
      matchs compétitifs.
    </p>
  </div>

  <br />

  <a href="/divisions" className="rulebookButton">
    Voir le système complet
  </a>
</Section>

      <Section id="equipes" title="Top Équipes">
        <div className="card">
          <h3>Classement actuel</h3>

          <p>🥇 À venir</p>
          <p>🥈 À venir</p>
          <p>🥉 À venir</p>

          <br />

          <a href="/teams" className="rulebookButton">
            Voir toutes les équipes
          </a>
        </div>
      </Section>

      <Section id="compte" title="Compte CZF">
        <div className="importBox">
          <div>
            <h3>Créer votre compte CZF</h3>

            <p>
              Connectez-vous avec Discord pour créer votre compte, générer votre
              profil joueur CZF et rejoindre une équipe.
            </p>

            <p>Une fois connecté, vous pourrez :</p>

            <ul>
              <li>Créer votre profil joueur</li>
              <li>Rejoindre une équipe</li>
              <li>Participer aux compétitions CZF</li>
              <li>Suivre votre progression</li>
            </ul>
          </div>

          <div className="heroActions">
            <a href="/login" className="rulebookButton">
              Créer mon profil CZF
            </a>
          </div>
        </div>
      </Section>

      <Section id="calendrier" title="Prochain Match">
        <div className="card">
          <h3>À venir</h3>

          <p>Équipe A vs Équipe B</p>
          <p>Date : --/--/----</p>
          <p>Heure : --:--</p>

          <br />

          <a href="/calendar" className="rulebookButton">
            Calendrier complet
          </a>
        </div>
      </Section>

      <Section id="resultats" title="Résultats">
        {results.length === 0 ? (
          <Empty text="Aucun résultat enregistré. Les scores, MVP de match et liens VOD apparaîtront ici." />
        ) : null}
      </Section>

      <Section id="hall-of-fame" title="Hall Of Fame">
        <div className="card">
          <h3>Champion en titre</h3>
          <p>À venir</p>

          <br />

          <h3>MVP du Split</h3>
          <p>À venir</p>

          <br />

          <a href="/hall-of-fame" className="rulebookButton">
            Voir le Hall Of Fame
          </a>
        </div>
      </Section>

      <Section id="rulebook" title="Rulebook">
        <div className="rulebook">
          <h3>Rulebook officiel CZF</h3>

          <p>
            Retrouvez l'ensemble des règles du Clash des Zéros de la Faille :
            inscriptions, rosters, système de points, calendrier, sanctions et
            playoffs.
          </p>

          <br />

          <a
            href="https://docs.google.com/document/d/1ASxjPHKffW-ZK9C55Gv57JjFJ6t8qiQhaKxbBzW8ohk/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="rulebookButton"
          >
            Consulter le Rulebook
          </a>
        </div>
      </Section>

      <footer>© CZF — Clash des Zéros de la Faille</footer>
    </main>
  );
}