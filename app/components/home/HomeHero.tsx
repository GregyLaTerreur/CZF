"use client";

// Haut de l'accueil : prochain match streamé dans les 3 jours, affiché au-dessus du bloc
// d'intro (titre « KCB vs QGB », date, bouton Twitch, face-à-face des logos).
import Link from "next/link";
import { logoSrc } from "@/lib/logo";
import {
  formatMatchDate,
  sideLabel,
  useUpcomingMatches,
  type UpcomingSide,
} from "../upcoming";
import styles from "../../home.module.css";

const SHOW_WITHIN_MS = 3 * 24 * 60 * 60 * 1000;

function HeroLogo({ side }: { side: UpcomingSide }) {
  return (
    <span className={styles.matchHeroLogo}>
      {side.logo ? (
        <img src={logoSrc(side.logo, 192)} alt={side.name ?? ""} />
      ) : (
        <span>?</span>
      )}
    </span>
  );
}

export default function HomeHero({ children }: { children: React.ReactNode }) {
  const matches = useUpcomingMatches();
  // Seulement un match streamé, aux deux équipes connues, qui commence dans moins de 3 jours.
  const limit = Date.now() + SHOW_WITHIN_MS;
  const match = matches?.find(
    (item) =>
      item.streamUrl &&
      item.top.shortName &&
      item.bottom.shortName &&
      new Date(item.scheduledAt).getTime() <= limit
  );

  if (!match) return <>{children}</>;

  return (
    <>
      <section className={styles.matchHero}>
        <div className={styles.matchHeroText}>
          <div className={styles.sectionLabel}>
            Playoffs {match.division} · {match.name} · {match.format}
          </div>

          <h2 className={styles.matchHeroTitle}>
            {sideLabel(match.top)} <em>vs</em>
            <br />
            {sideLabel(match.bottom)}
          </h2>

          <div className={styles.matchHeroDate}>
            {formatMatchDate(match.scheduledAt)}
          </div>

          <div className={styles.heroActions}>
            {match.streamUrl && (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnTwitch}
              >
                <svg viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 1l7 4-7 4z" fill="currentColor" />
                </svg>
                Regarder sur Twitch
              </a>
            )}
            <Link
              href={`/results?division=${match.division}`}
              className={styles.btnPrimary}
            >
              Voir l&apos;arbre
            </Link>
          </div>
        </div>

        <div className={styles.matchHeroVs} aria-hidden="true">
          <HeroLogo side={match.top} />
          <span className={styles.matchHeroVsText}>VS</span>
          <HeroLogo side={match.bottom} />
        </div>
      </section>

      {children}
    </>
  );
}
