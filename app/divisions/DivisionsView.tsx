'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import { TIERS, teamDivision } from '@/app/components/ds/lol';
import styles from './divisions.module.css';

// Barème de points d'équipe (cf. divisionFromPoints).
const SCALE_MAX = 8000;

const DIVISION_INFO: Record<
  DivisionName,
  { level: string; min: number; max: number }
> = {
  Targon: {
    level: 'Division Élite',
    min: 6101,
    max: SCALE_MAX,
  },
  Ixtal: {
    level: 'Division Intermédiaire',
    min: 3901,
    max: 6100,
  },
  Yordle: {
    level: 'Division Développement',
    min: 0,
    max: 3900,
  },
};

// Échelle affichée de bas en haut : Yordle → Ixtal → Targon.
const SCALE_ORDER: DivisionName[] = ['Yordle', 'Ixtal', 'Targon'];

// Rangs SoloQ typiques d'une division, affichés au-dessus du barème.
const DIVISION_TIERS: Record<DivisionName, string[]> = {
  Yordle: ['BRONZE', 'SILVER', 'GOLD'],
  Ixtal: ['PLATINUM', 'EMERALD'],
  Targon: ['DIAMOND', 'MASTER'],
};

export default function DivisionsView() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<DivisionName | null>(null);

  useEffect(() => {
    fetch('/api/teams')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error('Impossible de charger les équipes.');
        setTeams(data.data || []);
      })
      .catch((error) => setLoadError(error?.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  // Équipes validées par division, triées par points.
  const byDivision = useMemo(() => {
    const groups = Object.fromEntries(DIVISIONS.map((d) => [d, [] as any[]])) as Record<
      DivisionName,
      any[]
    >;

    teams.forEach((team) => {
      const division = teamDivision(team);
      if (division) groups[division].push(team);
    });

    DIVISIONS.forEach((division) =>
      groups[division].sort(
        (a, b) =>
          (b.validated_points || 0) - (a.validated_points || 0) ||
          String(a.name).localeCompare(String(b.name), 'fr')
      )
    );

    return groups;
  }, [teams]);

  const total = DIVISIONS.reduce((sum, division) => sum + byDivision[division].length, 0);
  const shown = divisionFilter ? [divisionFilter] : DIVISIONS;

  return (
    <>
      {/* =================================================
          EN-TÊTE
      ================================================= */}

      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Divisions</div>
            <h1 className={ds.h1}>Les divisions</h1>
            <p className={ds.body}>
              La division n&apos;est pas attribuée à un joueur mais à l&apos;équipe : les points
              CZF des titulaires sont additionnés, et ce total place l&apos;équipe en Yordle,
              Ixtal ou Targon au moment de sa validation par les admins.
            </p>

            <div className={ds.counters}>
              <div className={ds.counter}>
                <strong>{loading ? '—' : total}</strong>
                <span>Équipes validées</span>
              </div>
              {DIVISIONS.map((division) => (
                <div key={division} className={ds.counter}>
                  <strong>{loading ? '—' : byDivision[division].length}</strong>
                  <span>
                    <span className={ds.teamDot} style={{ background: DIVISION_COLORS[division] }} />
                    {division}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            <div className={ds.cardTitle}>Barème équipe</div>

            <div className={styles.scaleTiers}>
              {SCALE_ORDER.map((division) => {
                const info = DIVISION_INFO[division];

                return (
                  <span key={division} style={{ flexGrow: info.max - info.min }}>
                    {DIVISION_TIERS[division].map((tier) => (
                      <img key={tier} src={TIERS[tier].icon} alt={TIERS[tier].label} title={TIERS[tier].label} />
                    ))}
                  </span>
                );
              })}
            </div>

            <div className={styles.scale}>
              {SCALE_ORDER.map((division) => {
                const info = DIVISION_INFO[division];

                return (
                  <span
                    key={division}
                    className={styles.scaleSegment}
                    style={{
                      flexGrow: info.max - info.min,
                      background: DIVISION_COLORS[division],
                    }}
                  >
                    {division}
                  </span>
                );
              })}
            </div>

            <div className={styles.scaleTicks}>
              <span>0</span>
              <span style={{ left: `${(3900 / SCALE_MAX) * 100}%` }}>3900</span>
              <span style={{ left: `${(6100 / SCALE_MAX) * 100}%` }}>6100</span>
              <span>8000</span>
            </div>
          </div>
        </div>
      </header>

      {/* =================================================
          DIVISIONS
      ================================================= */}

      <section className={ds.section}>
        <div className={ds.container}>
          <div className={`${ds.tabs} ${ds.filterRowLast}`}>
            <button
              type="button"
              className={divisionFilter === null ? ds.tabActive : ds.tab}
              onClick={() => setDivisionFilter(null)}
            >
              Toutes les divisions
            </button>

            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                className={divisionFilter === division ? ds.tabActive : ds.tab}
                onClick={() => setDivisionFilter(divisionFilter === division ? null : division)}
              >
                <span className={ds.dot} style={{ background: DIVISION_COLORS[division] }} />
                {division}
              </button>
            ))}
          </div>

          {loading && <div className={`${ds.card} ${ds.empty}`}>Chargement des divisions…</div>}
          {loadError && <div className={`${ds.card} ${ds.empty}`}>{loadError}</div>}

          {!loading &&
            !loadError &&
            shown.map((division) => (
              <DivisionBlock key={division} division={division} teams={byDivision[division]} />
            ))}
        </div>
      </section>
    </>
  );
}

/* =========================================================
   BLOC DIVISION
========================================================= */

function DivisionBlock({ division, teams }: { division: DivisionName; teams: any[] }) {
  const info = DIVISION_INFO[division];
  const range =
    info.max === SCALE_MAX ? `${info.min} pts et +` : `${info.min} – ${info.max} pts`;

  return (
    <article
      className={styles.division}
      style={{ '--division-color': DIVISION_COLORS[division] } as React.CSSProperties}
    >
      <div className={styles.divisionHead}>
        <div>
          <div className={styles.divisionLevel}>{info.level}</div>
          <h2 className={styles.divisionName}>
            {division}
            <span className={styles.divisionDot} aria-hidden="true" />
          </h2>
        </div>

        <div className={styles.divisionMeta}>
          <span className={styles.divisionRange}>{range}</span>
          <span className={styles.divisionCount}>
            {teams.length} équipe{teams.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className={`${ds.card} ${ds.empty}`}>Aucune équipe validée pour le moment.</div>
      ) : (
        <div className={styles.grid}>
          {teams.map((team, index) => (
            <Link
              key={team.id}
              href={`/teams?team=${team.id}`}
              className={`${ds.card} ${styles.teamTile}`}
            >
              <span className={styles.teamRank}>{index + 1}</span>

              {team.logo_url ? (
                <img src={team.logo_url} alt="" className={styles.teamLogo} loading="lazy" />
              ) : (
                <span className={styles.teamLogoEmpty} />
              )}

              <span className={styles.teamName}>{team.name}</span>

              {team.validated_points !== null && team.validated_points !== undefined && (
                <span className={styles.teamPoints}>
                  {team.validated_points} <small>pts</small>
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
