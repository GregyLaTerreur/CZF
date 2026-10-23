'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/app/home.module.css';
import { DIVISION_COLORS, DIVISIONS, type DivisionName } from './divisions';
import { type PlayerStat, type StandingTeam, useResults } from './useResults';

const ROLE_LABELS: Record<string, string> = {
  Top: 'TOP',
  Jungle: 'JGL',
  Mid: 'MID',
  ADC: 'ADC',
  Support: 'SUP',
};

function TeamLogo({ logo, shortName }: { logo: string | null; shortName: string }) {
  if (!logo) {
    return <span className={styles.logoFallback}>{shortName}</span>;
  }

  return <img src={logo} alt="" className={styles.logo} loading="lazy" />;
}

function splitRiotId(riotId: string) {
  const [name, tag] = riotId.split('#');
  return { name, tag };
}

/* =========================================================
   HERO — chiffres clés
========================================================= */

export function HeroStats() {
  const { data } = useResults();

  const stats = [
    { value: data ? data.teams.length : '—', label: 'Équipes' },
    { value: data ? data.history.length : '—', label: 'Matchs joués' },
    { value: DIVISIONS.length, label: 'Divisions' },
  ];

  return (
    <div className={styles.heroStats}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.heroStat}>
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   TICKER
========================================================= */

export function Ticker() {
  const { data } = useResults();

  const items = ['Saison 1 en cours', 'Divisions Targon · Ixtal · Yordle'];

  if (data) {
    items.push(`${data.teams.length} équipes inscrites`, `${data.history.length} matchs joués`);

    for (const division of DIVISIONS) {
      const leader = data.divisions[division]?.[0];
      if (leader) items.push(`Leader ${division} : ${leader.name}`);
    }
  }

  items.push('Rejoins le Discord CZF');

  // Contenu doublé pour un défilement continu.
  const loop = [...items, ...items];

  return (
    <div className={styles.ticker} aria-label={items.join(', ')}>
      <div className={styles.tickerTrack} aria-hidden="true">
        {loop.map((item, index) => (
          <span key={index} className={styles.tickerItem}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   CLASSEMENT + TOP MVP
========================================================= */

type DivisionFilter = DivisionName | 'all';

function DivisionTabs<T extends DivisionFilter>({
  value,
  onChange,
  withAll = false,
}: {
  value: T;
  onChange: (division: T) => void;
  withAll?: boolean;
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {withAll && (
        <button
          type="button"
          role="tab"
          aria-selected={value === 'all'}
          className={value === 'all' ? styles.tabActive : styles.tab}
          onClick={() => onChange('all' as T)}
        >
          Toutes
        </button>
      )}
      {(DIVISIONS as T[]).map((division) => (
        <button
          key={division}
          type="button"
          role="tab"
          aria-selected={division === value}
          className={division === value ? styles.tabActive : styles.tab}
          onClick={() => onChange(division)}
        >
          <span
            className={styles.dot}
            style={{ background: DIVISION_COLORS[division as DivisionName] }}
          />
          {division}
        </button>
      ))}
    </div>
  );
}

function StandingsTable({ teams }: { teams: StandingTeam[] }) {
  if (teams.length === 0) {
    return <div className={styles.empty}>Aucune équipe dans cette division.</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>#</th>
          <th>Équipe</th>
          <th className={styles.num}>V</th>
          <th className={styles.num}>D</th>
          <th className={`${styles.num} ${styles.hideMobile}`}>Diff</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team, index) => (
          <tr key={team.id}>
            <td className={`${styles.rank} ${index < 3 ? styles.rankTop : ''}`}>{index + 1}</td>
            <td>
              <div className={styles.teamCell}>
                <TeamLogo logo={team.logo} shortName={team.shortName} />
                <span>{team.name}</span>
              </div>
            </td>
            <td className={`${styles.num} ${styles.win}`}>{team.wins}</td>
            <td className={`${styles.num} ${styles.loss}`}>{team.losses}</td>
            <td
              className={`${styles.num} ${styles.hideMobile} ${
                team.gameDiff > 0 ? styles.diffPos : team.gameDiff < 0 ? styles.diffNeg : ''
              }`}
            >
              {team.gameDiff > 0 ? `+${team.gameDiff}` : team.gameDiff}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopMvp({ players }: { players: PlayerStat[] }) {
  const best = players[0]?.mvp || 1;

  return (
    <div className={styles.statPanel}>
      <div className={styles.statHead}>
        <div className={styles.statTitle}>MVP</div>
        <div className={styles.statTag}>TOP 5</div>
      </div>

      {players.length === 0 && <div className={styles.empty}>Aucun MVP désigné pour le moment.</div>}

      {players.map((player, index) => {
        const { name, tag } = splitRiotId(player.riotId);

        return (
          <div key={`${player.playerId}-${player.role}`}>
            <div className={styles.statRow}>
              <span className={`${styles.statRank} ${index === 0 ? styles.statRankTop : ''}`}>
                #{index + 1}
              </span>
              <div className={styles.statWho}>
                <div className={styles.statName}>
                  {name}
                  {tag && <small>#{tag}</small>}
                </div>
                <div className={styles.statSub}>
                  {player.teamShortName} · {ROLE_LABELS[player.role] || player.role} · {player.games} games
                </div>
              </div>
              <div className={styles.statValue}>{player.mvp}</div>
            </div>
            <div
              className={`${styles.statBar} ${index === 0 ? styles.statBarTop : ''}`}
              style={{ width: `${Math.max(8, (player.mvp / best) * 100)}%` }}
            />
          </div>
        );
      })}

      <Link href="/results" className={styles.cardFooter}>
        Voir toutes les stats
      </Link>
    </div>
  );
}

export function Standings() {
  const { data, error, loading } = useResults();
  const [division, setDivision] = useState<DivisionName>('Targon');

  const teams = data?.divisions[division] || [];

  // À égalité de MVP, le joueur qui a le moins de games passe devant.
  const topMvp = data
    ? Object.values(data.playerStatsByDivision[division] || {})
        .flat()
        .filter((player) => player.mvp > 0)
        .sort((a, b) => b.mvp - a.mvp || a.games - b.games || b.kda - a.kda)
        .slice(0, 5)
    : [];

  return (
    <section id="home-classement" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionLabel}>Saison 1 · Classement</div>
            <h2 className={styles.h2}>Qui domine la Faille ?</h2>
          </div>
          <DivisionTabs value={division} onChange={setDivision} />
        </div>

        {error && <div className={`${styles.card} ${styles.empty}`}>{error}</div>}

        {loading && (
          <div className={styles.standingsGrid}>
            <div className={`${styles.card} ${styles.skeleton}`} />
            <div className={`${styles.statPanel} ${styles.skeleton}`} />
          </div>
        )}

        {data && (
          <div className={styles.standingsGrid}>
            <div className={styles.card}>
              <StandingsTable teams={teams} />
              <Link href="/results" className={styles.cardFooter}>
                Classement complet
              </Link>
            </div>
            <TopMvp players={topMvp} />
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   DERNIERS RÉSULTATS
========================================================= */

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

export function LatestResults() {
  const { data, error, loading } = useResults();
  const [division, setDivision] = useState<DivisionFilter>('all');

  const matches = (data?.history || [])
    .filter((match) => division === 'all' || match.division === division)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 6);

  return (
    <>
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.sectionLabel}>Saison 1 · Derniers matchs</div>
          <h2 className={styles.h2}>Résultats</h2>
        </div>
        <DivisionTabs value={division} onChange={setDivision} withAll />
      </div>

      {error && <div className={styles.empty}>{error}</div>}
      {loading && <div className={styles.empty}>Chargement des résultats…</div>}
      {data && matches.length === 0 && (
        <div className={styles.empty}>Aucun match joué pour le moment.</div>
      )}

      {matches.length > 0 && (
        <div className={styles.matches}>
          {matches.map((match) => {
            const winnerId = match.winner?.id ?? null;

            return (
              <article key={match.id} className={styles.matchCard}>
                <div className={styles.matchMeta}>
                  <span className={styles.chip} style={{ color: DIVISION_COLORS[match.division] }}>
                    {match.division}
                  </span>
                  <span>
                    {match.stage === 'playoff' ? 'Playoffs' : 'Poules'} · BO{match.bestOf} ·{' '}
                    {dateFormat.format(new Date(match.playedAt))}
                  </span>
                </div>

                {[match.team1, match.team2].map((team, side) => {
                  if (!team) {
                    return (
                      <div key={`missing-${side}`} className={`${styles.matchTeam} ${styles.matchLoser}`}>
                        <TeamLogo logo={null} shortName="?" />
                        <span>Équipe retirée</span>
                      </div>
                    );
                  }

                  const lost = winnerId !== null && winnerId !== team.id;

                  return (
                    <div
                      key={team.id}
                      className={`${styles.matchTeam} ${lost ? styles.matchLoser : ''}`}
                    >
                      <TeamLogo logo={team.logo} shortName={team.shortName} />
                      <span>{team.name}</span>
                      <b
                        className={`${styles.matchScore} ${
                          winnerId === team.id ? styles.win : lost ? styles.loss : ''
                        }`}
                      >
                        {team.score}
                      </b>
                    </div>
                  );
                })}

                {match.mvpRiotId && (
                  <div className={styles.matchMvp}>
                    MVP · <b>{splitRiotId(match.mvpRiotId).name}</b>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/* =========================================================
   DIVISIONS — nombre d'équipes
========================================================= */

export function DivisionTeamCount({ division }: { division: DivisionName }) {
  const { data } = useResults();

  if (!data) return null;

  const count = data.divisions[division]?.length || 0;

  return (
    <p className={styles.divisionTeams}>
      {count} équipe{count > 1 ? 's' : ''} cette saison
    </p>
  );
}
