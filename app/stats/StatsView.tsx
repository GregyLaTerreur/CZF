'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DIVISION_COLORS } from '@/app/components/home/divisions';
import CloseIcon from '@/app/components/icons/CloseIcon';
import ds from '@/app/components/ds/ds.module.css';
import { ROLES, splitRiotId } from '@/app/components/ds/lol';
import {
  BlockHead,
  DivisionTabs,
  TeamLogo,
  useDivisionData,
  type ChampionStat,
  type PlayerStats,
  type Role,
  type StatKey,
} from '../results/shared';
import styles from '../results/results.module.css';

const STAT_CARDS: { statKey: StatKey; title: string; format: (value: number) => string }[] = [
  { statKey: 'kda', title: 'KDA', format: (value) => value.toFixed(2) },
  { statKey: 'goldPerMin', title: 'Gold / min', format: (value) => String(Math.round(value)) },
  { statKey: 'dpm', title: 'Dégâts / min', format: (value) => String(Math.round(value)) },
  { statKey: 'csPerMin', title: 'CS / min', format: (value) => value.toFixed(1) },
];

const VISION_CARD = {
  statKey: 'visionScore' as StatKey,
  title: 'Vision / min',
  format: (value: number) => value.toFixed(2),
};

// « kai sa », « Kaï'Sa » et « kaisa » trouvent tous Kai'Sa.
function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function RoleTabs({
  value,
  onChange,
  className,
}: {
  value: Role;
  onChange: (role: Role) => void;
  className: string;
}) {
  return (
    <div className={`${ds.tabs} ${className}`}>
      {ROLES.map((item) => (
        <button
          key={item.name}
          type="button"
          className={value === item.name ? ds.tabActive : ds.tab}
          onClick={() => onChange(item.name as Role)}
        >
          <img src={item.image} alt="" className={ds.tabRoleIcon} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function StatsView() {
  const { division, setDivision, data, error, loading } = useDivisionData();
  const [role, setRole] = useState<Role>('Top');
  // Top 10 ouvert ou fermé pour toutes les colonnes à la fois.
  const [expanded, setExpanded] = useState(false);
  const [championQuery, setChampionQuery] = useState('');
  // Rôle des champions indépendant de celui des stats joueurs.
  const [championRole, setChampionRole] = useState<Role>('Top');
  // Champion dont on affiche les joueurs (un seul à la fois).
  const [openChampion, setOpenChampion] = useState<string | null>(null);

  const playerStats = data?.playerStats;
  const players = (playerStats?.[role] ?? []).filter((player) => player.qualified);
  const champions = data?.champions[championRole] ?? [];

  // Top 10 par défaut ; la recherche porte sur tous les champions du rôle
  // et garde leur vrai rang.
  const championSearch = normalizeSearch(championQuery);
  const shownChampions = championSearch
    ? champions
        .map((champion, index) => ({ champion, rank: index + 1 }))
        .filter(({ champion }) =>
          [champion.name, champion.championId].some((value) =>
            normalizeSearch(value).includes(championSearch)
          )
        )
    : champions.slice(0, 10).map((champion, index) => ({ champion, rank: index + 1 }));
  // Le support est classé à la vision plutôt qu'aux CS.
  const cards = role === 'Support' ? [...STAT_CARDS.slice(0, 3), VISION_CARD] : STAT_CARDS;

  // MVP tous rôles : un joueur peut apparaître dans plusieurs rôles.
  const mvpRanking = useMemo(() => {
    const byPlayer = new Map<number, PlayerStats & { roles: Role[] }>();

    for (const player of Object.values(playerStats ?? {}).flat()) {
      const existing = byPlayer.get(player.playerId);

      if (existing) {
        existing.mvp += player.mvp;
        if (player.mvp > 0) existing.roles.push(player.role);
      } else {
        byPlayer.set(player.playerId, { ...player, roles: player.mvp > 0 ? [player.role] : [] });
      }
    }

    return [...byPlayer.values()].filter((player) => player.mvp > 0).sort((a, b) => b.mvp - a.mvp);
  }, [playerStats]);

  const championRoleLabel = ROLES.find((item) => item.name === championRole)?.label;
  const openedChampion = champions.find((champion) => champion.championId === openChampion) ?? null;
  const closeChampion = useCallback(() => setOpenChampion(null), []);

  return (
    <div style={{ '--division-color': DIVISION_COLORS[division] } as React.CSSProperties}>
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Saison 1 · Statistiques</div>
          <h1 className={ds.h1}>Stats</h1>
        </div>
      </header>

      <section className={ds.section}>
        <div className={ds.container}>
          <DivisionTabs
            division={division}
            onChange={(item) => {
              setDivision(item);
              setRole('Top');
              setChampionRole('Top');
              setOpenChampion(null);
            }}
          />

          {error && <div className={`${ds.card} ${ds.empty}`}>{error}</div>}
          {loading && <div className={`${ds.card} ${ds.empty}`}>Chargement des statistiques…</div>}

          {data && (
            <>
              {/* JOUEURS */}
              <div className={styles.playerSection}>
                <BlockHead label="Performances" title="Statistiques joueurs" aside="Min. 45 % des games de l’équipe" />

                <RoleTabs value={role} onChange={setRole} className={ds.filterRowLast} />

                <div className={styles.rankingGrid}>
                  {cards.map((card) => (
                    <RankingCard
                      key={`${role}-${card.statKey}`}
                      players={players}
                      expanded={expanded}
                      onToggle={() => setExpanded(!expanded)}
                      {...card}
                    />
                  ))}
                </div>
              </div>

              {/* CHAMPIONS */}
              <div className={`${styles.playerSection} ${styles.statsBlock}`}>
                <BlockHead label="Draft" title="Statistiques champions" aside="Top 10 des champions" />

                <RoleTabs
                  value={championRole}
                  onChange={(item) => {
                    setChampionRole(item);
                    setOpenChampion(null);
                  }}
                  className={ds.filterRow}
                />

                {champions.length > 0 && (
                  <input
                    type="search"
                    className={`${ds.search} ${styles.championSearch}`}
                    placeholder="Rechercher un champion…"
                    value={championQuery}
                    onChange={(event) => setChampionQuery(event.target.value)}
                  />
                )}

                {champions.length === 0 ? (
                  <div className={`${ds.card} ${ds.empty}`}>Aucun champion enregistré pour le moment.</div>
                ) : shownChampions.length === 0 ? (
                  <div className={`${ds.card} ${ds.empty}`}>
                    Aucun champion « {championQuery.trim()} » joué en {championRoleLabel}.
                  </div>
                ) : (
                  <div className={styles.championGrid}>
                    {shownChampions.map(({ champion, rank }) => (
                      <button
                        key={champion.championId}
                        type="button"
                        className={`${ds.card} ${styles.championCard}`}
                        onClick={() => setOpenChampion(champion.championId)}
                      >
                        <span className={styles.championRank}>#{rank}</span>
                        {champion.image ? (
                          <img src={champion.image} alt="" loading="lazy" />
                        ) : (
                          <span className={styles.championEmpty} />
                        )}
                        <strong>{champion.name}</strong>
                        <small>
                          {champion.picks} pick{champion.picks > 1 ? 's' : ''}
                        </small>
                        <div className={styles.championStats}>
                          <span>
                            <small>Pick</small>
                            {champion.pickRate}%
                          </span>
                          <span>
                            <small>Win</small>
                            {champion.winRate}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {openedChampion && (
                  <ChampionPlayersModal
                    champion={openedChampion}
                    roleLabel={championRoleLabel}
                    onClose={closeChampion}
                  />
                )}
              </div>

              {/* MVP */}
              <div className={`${styles.playerSection} ${styles.statsBlock}`}>
                <BlockHead label="Tous rôles" title="Classement MVP" />

                {mvpRanking.length === 0 ? (
                  <div className={`${ds.card} ${ds.empty}`}>Aucun MVP attribué pour le moment.</div>
                ) : (
                  <div className={`${ds.card} ${styles.mvpGrid}`}>
                    {mvpRanking.map((player, index) => (
                      <div key={player.playerId} className={styles.mvpRow}>
                        <span className={styles.rankNumber}>{index + 1}</span>
                        <TeamLogo logo={player.teamLogo} size="sm" />
                        <span className={styles.mvpRoles}>
                          {player.roles.map((playerRole) => {
                            const info = ROLES.find((item) => item.name === playerRole);

                            return (
                              info && <img key={playerRole} src={info.image} alt={info.label} title={info.label} />
                            );
                          })}
                        </span>
                        <span className={styles.playerName}>
                          {splitRiotId(player.riotId).name}
                          <small>{player.teamShortName}</small>
                        </span>
                        <span className={styles.bar}>
                          <span style={{ width: `${(player.mvp / mvpRanking[0].mvp) * 100}%` }} />
                        </span>
                        <strong className={styles.rankValue}>{player.mvp}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// Pop-up : tous les joueurs qui ont joué le champion à ce rôle dans la division.
function ChampionPlayersModal({
  champion,
  roleLabel,
  onClose,
}: {
  champion: ChampionStat;
  roleLabel?: string;
  onClose: () => void;
}) {
  // Échap ferme la pop-up ; on bloque le défilement de la page derrière.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.championModal} ${ds.onDark}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Joueurs de ${champion.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>

        <div className={styles.championModalHead}>
          {champion.image ? <img src={champion.image} alt="" /> : <span className={styles.championEmpty} />}
          <div>
            <strong>{champion.name}</strong>
            <small>
              {roleLabel} · {champion.players.length} joueur{champion.players.length > 1 ? 's' : ''} ·{' '}
              {champion.picks} pick{champion.picks > 1 ? 's' : ''} · {champion.winRate}% win
            </small>
          </div>
        </div>

        {champion.players.length === 0 ? (
          <div className={ds.empty}>Aucun joueur</div>
        ) : (
          <div className={styles.championPlayersRows}>
            <div className={`${styles.championPlayerRow} ${styles.championPlayerHead}`}>
              <span />
              <span />
              <span>Joueur</span>
              <span>Games</span>
              <span>Win</span>
              <span>KDA</span>
            </div>

            {champion.players.map((player, index) => (
              <div key={player.playerId} className={styles.championPlayerRow}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <TeamLogo logo={player.teamLogo} size="sm" />
                <span className={styles.playerName}>
                  {splitRiotId(player.riotId).name}
                  {player.teamShortName && <small>{player.teamShortName}</small>}
                </span>
                <strong className={styles.rankValue}>{player.games}</strong>
                <strong className={`${styles.rankValue} ${player.winRate >= 50 ? ds.win : ds.loss}`}>
                  {Math.round(player.winRate)}%
                </strong>
                <strong className={styles.rankValue}>{player.kda.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankingCard({
  title,
  players,
  statKey,
  format,
  expanded,
  onToggle,
}: {
  title: string;
  players: PlayerStats[];
  statKey: StatKey;
  format: (value: number) => string;
  expanded: boolean;
  onToggle: () => void;
}) {

  const ranking = useMemo(
    () =>
      players
        .filter((player) => Number(player[statKey]) > 0)
        .sort((a, b) => Number(b[statKey]) - Number(a[statKey])),
    [players, statKey]
  );

  const max = Number(ranking[0]?.[statKey] ?? 0);
  const visible = ranking.slice(0, expanded ? 10 : 5);

  return (
    <div className={`${ds.card} ${styles.rankingCard}`}>
      <div className={styles.rankingHead}>
        <strong>{title}</strong>
        <span>Top {expanded ? 10 : 5}</span>
      </div>

      {visible.length === 0 ? (
        <div className={ds.empty}>Aucune donnée</div>
      ) : (
        <div className={styles.rankingRows}>
          {visible.map((player, index) => {
            const value = Number(player[statKey]);

            return (
              <div key={player.playerId} className={styles.rankingRow}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <TeamLogo logo={player.teamLogo} size="sm" />
                <span className={styles.playerName}>
                  {splitRiotId(player.riotId).name}
                  <small>{player.teamShortName}</small>
                </span>
                <strong className={styles.rankValue}>{format(value)}</strong>
                <span className={`${styles.bar} ${styles.barFull}`}>
                  <span style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {ranking.length > 5 && (
        <button type="button" className={ds.cardFooter} onClick={onToggle}>
          {expanded ? 'Réduire' : 'Voir le top 10'}
        </button>
      )}
    </div>
  );
}