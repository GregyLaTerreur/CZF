"use client";

// Haut de l'accueil : matchs streamés du jour et du lendemain, en carrousel s'il y en a plusieurs,
// affichés au-dessus du bloc d'intro (titre « KCB vs QGB », date, bouton Twitch, face-à-face des logos).
import { useEffect, useState } from "react";
import Link from "next/link";
import { logoSrc } from "@/lib/logo";
import {
  formatMatchDate,
  matchDay,
  sideLabel,
  useUpcomingMatches,
  type UpcomingSide,
} from "../upcoming";
import styles from "../../home.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLIDE_MS = 8000;

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
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Seulement les matchs streamés, aux deux équipes connues, joués aujourd'hui ou demain (heure de Paris).
  const lastDay = matchDay(new Date(Date.now() + DAY_MS).toISOString()).key;
  const shown = (matches ?? []).filter(
    (item) =>
      item.streamUrl &&
      item.top.shortName &&
      item.bottom.shortName &&
      matchDay(item.scheduledAt).key <= lastDay
  );
  const count = shown.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (!count) return <>{children}</>;

  const current = index % count;
  const match = shown[current];
  const go = (step: number) => setIndex((current + step + count) % count);

  return (
    <>
      <section
        className={styles.matchHero}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={`${styles.matchHeroText} ${count > 1 ? styles.matchHeroTextNav : ""}`}>
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

        {count > 1 && (
          <div className={styles.matchHeroNav}>
            <button type="button" onClick={() => go(-1)} aria-label="Match précédent">
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="2.4" fill="none" />
              </svg>
            </button>
            <span className={styles.matchHeroDots}>
              {shown.map((item, dot) => (
                <button
                  key={`${item.division}-${item.key}`}
                  type="button"
                  className={dot === current ? styles.matchHeroDotOn : ""}
                  onClick={() => setIndex(dot)}
                  aria-label={`Match ${dot + 1} sur ${count}`}
                />
              ))}
            </span>
            <button type="button" onClick={() => go(1)} aria-label="Match suivant">
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="m5 2 5 5-5 5" stroke="currentColor" strokeWidth="2.4" fill="none" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {children}
    </>
  );
}
