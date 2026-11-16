'use client';

// Bandeau orange défilant sous le menu : prochains matchs de l'arbre, avec lien vers le stream.
// N'apparaît que s'il y a au moins un match programmé.
import BoltIcon from '@/app/components/icons/BoltIcon';
import { formatMatchDate, sideLabel, useUpcomingMatches } from './upcoming';
import styles from './upcomingTicker.module.css';

const MAX_ITEMS = 6;

export default function UpcomingTicker() {
  const matches = useUpcomingMatches();

  if (!matches?.length) return null;

  const items = matches.slice(0, MAX_ITEMS);
  // Contenu répété pour un défilement continu, même avec un seul match.
  const loop = Array.from({ length: items.length < 3 ? 4 : 2 }, () => items).flat();

  return (
    <div className={styles.ticker}>
      <div className={styles.track}>
        {loop.map((match, index) => (
          <span key={index} className={styles.item} aria-hidden={index >= items.length || undefined}>
            <BoltIcon className={styles.bolt} />
            <span>
              {index % items.length === 0 ? 'Prochain match · ' : ''}
              {match.division} · {match.name} · {sideLabel(match.top)} vs {sideLabel(match.bottom)} ·{' '}
              {formatMatchDate(match.scheduledAt)}
            </span>
            {match.streamUrl && (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
                tabIndex={index >= items.length ? -1 : undefined}
              >
                Regarder sur Twitch
              </a>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
