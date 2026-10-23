import Link from 'next/link';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import Nav from './components/Nav';
import styles from './home.module.css';
import {
  DivisionTeamCount,
  HeroStats,
  LatestResults,
  Standings,
  Ticker,
} from './components/home/HomeLive';
import { DIVISION_COLORS, type DivisionName } from './components/home/divisions';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-barlow-condensed',
});

const DISCORD_URL = 'https://discord.gg/ZWSmEGrv2s';
const RULEBOOK_URL =
  'https://docs.google.com/document/d/1ASxjPHKffW-ZK9C55Gv57JjFJ6t8qiQhaKxbBzW8ohk/edit?usp=sharing';

const DIVISION_INFO: { name: DivisionName; level: string; points: string }[] = [
  { name: 'Targon', level: 'Division Élite', points: '6101 – 8000 pts CZF' },
  { name: 'Ixtal', level: 'Division Intermédiaire', points: '3901 – 6100 pts CZF' },
  { name: 'Yordle', level: 'Division Développement', points: '0 – 3900 pts CZF' },
];

export default function Home() {
  return (
    <main className={`${styles.home} ${barlow.variable} ${barlowCondensed.variable}`}>
      <Nav />

      {/* HERO */}
      <header id="home-accueil" className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <div className={styles.badge}>
              <span className={styles.badgeLeft}>
                <span className={styles.dot} style={{ background: 'var(--teal)' }} />
                Saison en cours
              </span>
              <span className={styles.badgeRight}>League of Legends · Saison 1</span>
            </div>

            <h1 className={styles.display}>
              Clash des Zéros
              <br />
              de la <em>Faille</em>
            </h1>

            <p className={`${styles.body} ${styles.heroText}`}>
              La ligue communautaire où chaque équipe joue à son niveau. Trois divisions —
              Targon, Ixtal et Yordle — des matchs serrés, et un Hall of Fame à écrire.
            </p>

            <div className={styles.heroActions}>
              <Link href="/login" className={styles.btnPrimary}>
                Rejoindre la ligue
              </Link>
              <a
                href={RULEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnOutline}
              >
                Règlement
              </a>
            </div>

            <HeroStats />
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <img src="/assets/PNG CZF.png" alt="" className={styles.heroLogo} />
            <img
              src="/assets/eclairs/eclair_czf_03.png"
              alt=""
              className={`${styles.heroBolt} ${styles.heroBoltA}`}
            />
            <img
              src="/assets/eclairs/eclair_czf_02.png"
              alt=""
              className={`${styles.heroBolt} ${styles.heroBoltB}`}
            />
          </div>
        </div>
      </header>

      <Ticker />

      {/* CLASSEMENT */}
      <Standings />

      {/* DERNIERS RÉSULTATS */}
      {/* Ids préfixés "home-" : globals.css stylise #resultats, #divisions… */}
      <section id="home-resultats" className={styles.darkSection}>
        <div className={styles.container}>
          <LatestResults />

          <div className={styles.darkActions}>
            <Link href="/results" className={styles.btnDark}>
              Tous les résultats
            </Link>
          </div>
        </div>
      </section>

      {/* DIVISIONS */}
      <section id="home-divisions" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionLabel}>Le système CZF</div>
              <h2 className={styles.h2}>Trois divisions</h2>
            </div>
          </div>

          <div className={styles.divisions}>
            {DIVISION_INFO.map((division) => (
              <article
                key={division.name}
                className={styles.divisionCard}
                style={{ '--division-color': DIVISION_COLORS[division.name] } as React.CSSProperties}
              >
                <div className={styles.divisionLevel}>{division.level}</div>
                <div className={styles.divisionName}>
                  {division.name}
                  <span className={styles.divisionDot} aria-hidden="true" />
                </div>
                <div className={styles.divisionPoints}>{division.points}</div>
                <DivisionTeamCount division={division.name} />
              </article>
            ))}
          </div>

          <div className={styles.divisionNote}>
            <h3 className={styles.h3}>Comment ça marche ?</h3>
            <p className={styles.body} style={{ marginTop: 12 }}>
              La division n&apos;est pas attribuée à un joueur mais à l&apos;équipe entière.
              Chaque joueur a un score CZF calculé à partir de son niveau ; les points des 5
              titulaires sont additionnés et c&apos;est ce total qui place l&apos;équipe en
              Yordle, Ixtal ou Targon.
            </p>
            <p className={styles.body}>
              N&apos;importe quel joueur peut donc évoluer dans n&apos;importe quelle division :
              l&apos;objectif est d&apos;avoir des équipes équilibrées et des matchs compétitifs.
            </p>
          </div>

          <div className={styles.divisionActions}>
            <Link href="/divisions" className={styles.btnOutline}>
              Voir le système complet
            </Link>
          </div>
        </div>
      </section>

      {/* REJOINDRE */}
      <section id="home-rejoindre" className={styles.darkSection}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionLabel}>Participer</div>
              <h2 className={styles.h2}>Entre dans la Faille</h2>
            </div>
          </div>

          <div className={styles.joinGrid}>
            <article className={styles.joinCard}>
              <h3 className={styles.h3}>Le Discord CZF</h3>
              <p className={styles.body}>
                Obligatoire pour participer : annonces, inscriptions, résultats et suivi du
                tournoi, tout passe par le serveur.
              </p>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnPrimary}
                style={{ boxShadow: '6px 6px 0 var(--darker)' }}
              >
                Rejoindre le Discord
              </a>
            </article>

            <article className={styles.joinCard}>
              <h3 className={styles.h3}>Ton profil CZF</h3>
              <ul className={styles.joinList}>
                <li>Connexion avec Discord</li>
                <li>Profil joueur et score CZF</li>
                <li>Rejoindre ou créer une équipe</li>
                <li>Suivre tes stats toute la saison</li>
              </ul>
              <Link href="/login" className={`${styles.btnOutline} ${styles.btnCream}`}>
                Créer mon profil
              </Link>
            </article>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span>© CZF — Clash des Zéros de la Faille</span>
          <nav className={styles.footerLinks}>
            <Link href="/teams">Équipes</Link>
            <Link href="/players">Joueurs</Link>
            <Link href="/hall-of-fame">Hall of Fame</Link>
            <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer">
              Rulebook
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
