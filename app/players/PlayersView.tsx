'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import ds from '@/app/components/ds/ds.module.css';
import {
  ROLES,
  TIERS,
  dpmUrl,
  formatRank,
  rankValue,
  roleInfo,
  soloqGames,
  splitRiotId,
  teamDivision,
  winRate,
} from '@/app/components/ds/lol';
import { ChampionPool, RolePicker, useDdragonVersion } from '@/app/components/ds/LolUi';
import styles from './players.module.css';

/* =========================================================
   CONSTANTES
========================================================= */

const PAGE_SIZE = 40;

type SortKey = 'riot_id' | 'main_role' | 'rank' | 'points' | 'wr';
type SortDirection = 'asc' | 'desc';

/* =========================================================
   ICONES
========================================================= */

function SortIcon({ direction }: { direction: SortDirection | null }) {
  return (
    <svg viewBox="0 0 10 14" className={styles.sortIcon} aria-hidden="true">
      <path d="M5 1 9 5H1z" opacity={direction === 'asc' ? 1 : 0.3} />
      <path d="M5 13 1 9h8z" opacity={direction === 'desc' ? 1 : 0.3} />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      aria-hidden="true"
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* =========================================================
   COMPOSANTS
========================================================= */

function SortHeader({
  sort,
  label,
  className,
  sortKey,
  sortDirection,
  onSort,
}: {
  sort: SortKey;
  label: string;
  className?: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === sort;

  return (
    <button
      type="button"
      className={`${styles.sortButton} ${active ? styles.sortActive : ''} ${className || ''}`}
      onClick={() => onSort(sort)}
    >
      {label}
      <SortIcon direction={active ? sortDirection : null} />
    </button>
  );
}

/* =========================================================
   VUE
========================================================= */

export default function PlayersView() {
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<DivisionName | null>(null);
  const [participantsOnly, setParticipantsOnly] = useState(false);
  const [lftOnly, setLftOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const ddragonVersion = useDdragonVersion();

  useEffect(() => {
    // Session locale : pas d'appel réseau, les routes d'API vérifient le jeton.
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    loadData();
  }, []);

  async function loadData() {
    try {
      // Une seule requête : l'équipe de chaque joueur est jointe côté serveur.
      const playersRes = await fetch('/api/players?view=list&include=team').then((res) =>
        res.json()
      );

      if (!playersRes.success) throw new Error('Impossible de charger les joueurs.');

      setPlayers(playersRes.data || []);
    } catch (error: any) {
      setLoadError(error?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }

  const myPlayer = useMemo(
    () => (user ? players.find((player) => player.profile_id === user.id) || null : null),
    [players, user]
  );

  const teamByPlayer = useMemo(
    () =>
      new Map<number, any>(
        players.filter((player) => player.team).map((player) => [Number(player.id), player.team])
      ),
    [players]
  );

  const counts = useMemo(
    () => ({
      total: players.length,
      participants: players.filter(
        (player) => teamByPlayer.get(Number(player.id))?.validated_by_admin === true
      ).length,
      lft: players.filter((player) => player.lft).length,
    }),
    [players, teamByPlayer]
  );

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const list = players.filter((player) => {
      const team = teamByPlayer.get(Number(player.id));

      if (
        query &&
        ![player.riot_id, player.profiles?.discord_name, team?.name].some((value) =>
          String(value || '').toLowerCase().includes(query)
        )
      ) {
        return false;
      }

      if (roleFilter && player.main_role !== roleFilter && player.secondary_role !== roleFilter) {
        return false;
      }

      if (divisionFilter && teamDivision(team) !== divisionFilter) return false;
      if (participantsOnly && team?.validated_by_admin !== true) return false;
      if (lftOnly && !player.lft) return false;

      return true;
    });

    const value = (player: any): number | string => {
      if (sortKey === 'points') return player.czf_points ?? -1;
      if (sortKey === 'rank') return rankValue(player);
      if (sortKey === 'wr') return winRate(player) ?? -1;
      if (sortKey === 'main_role') {
        const index = ROLES.findIndex((role) => role.name === player.main_role);
        return index === -1 ? 99 : index;
      }

      return String(player.riot_id || '').toLowerCase();
    };

    const factor = sortDirection === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);

      const diff =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'fr');

      return diff * factor;
    });
  }, [players, teamByPlayer, searchQuery, roleFilter, divisionFilter, participantsOnly, lftOnly, sortKey, sortDirection]);

  // Un changement de filtre repart de la première page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, roleFilter, divisionFilter, participantsOnly, lftOnly, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    // Les colonnes chiffrées partent du plus fort.
    setSortDirection(key === 'riot_id' || key === 'main_role' ? 'asc' : 'desc');
  }

  const visiblePlayers = filteredPlayers.slice(0, visibleCount);
  const hasMore = filteredPlayers.length > visibleCount;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Affiche les joueurs suivants quand le bas de la liste approche.
  // Relancé après chaque ajout : si le bas est encore visible, on continue.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((count) => count + PAGE_SIZE);
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  return (
    <>
      {/* =================================================
          EN-TÊTE
      ================================================= */}

      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Joueurs</div>
            <h1 className={ds.h1}>Les joueurs</h1>

            <div className={ds.counters}>
              <div className={ds.counter}>
                <strong>{loading ? '—' : counts.total}</strong>
                <span>Inscrits</span>
              </div>
              <div className={ds.counter}>
                <strong>{loading ? '—' : counts.participants}</strong>
                <span>En équipe validée</span>
              </div>
              <div className={ds.counter}>
                <strong className={ds.teal}>{loading ? '—' : counts.lft}</strong>
                <span>LFT</span>
              </div>
            </div>
          </div>

          <ProfileCard user={user} myPlayer={myPlayer} onCreated={loadData} />
        </div>
      </header>

      {/* =================================================
          LISTE
      ================================================= */}

      <section className={ds.section}>
        <div className={ds.container}>
          <div className={ds.toolbar}>
            <input
              type="search"
              className={ds.search}
              placeholder="Rechercher un joueur, un pseudo Discord, une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className={ds.tabs}>
              <button
                type="button"
                className={participantsOnly ? ds.tabActive : ds.tab}
                onClick={() => setParticipantsOnly(!participantsOnly)}
                aria-pressed={participantsOnly}
              >
                Participants
              </button>

              <button
                type="button"
                className={lftOnly ? ds.tabActive : ds.tab}
                onClick={() => setLftOnly(!lftOnly)}
                aria-pressed={lftOnly}
              >
                <span className={ds.dot} />
                LFT
              </button>
            </div>
          </div>

          <div className={`${ds.tabs} ${ds.filterRow}`}>
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

          <div className={`${ds.tabs} ${ds.filterRowLast}`}>
            <button
              type="button"
              className={roleFilter === null ? ds.tabActive : ds.tab}
              onClick={() => setRoleFilter(null)}
            >
              Tous les rôles
            </button>

            {ROLES.map((role) => (
              <button
                key={role.name}
                type="button"
                className={roleFilter === role.name ? ds.tabActive : ds.tab}
                onClick={() => setRoleFilter(roleFilter === role.name ? null : role.name)}
              >
                <img src={role.image} alt="" className={ds.tabRoleIcon} />
                {role.label}
              </button>
            ))}
          </div>

          <div className={ds.card}>
            <div className={`${styles.row} ${styles.rowHead}`}>
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="riot_id" label="Joueur" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="main_role" label="Rôles" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="rank" label="Rang SoloQ" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="points" label="Pts CZF" className={styles.alignRight} />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="wr" label="WR" className={`${styles.alignRight} ${styles.hideMobile}`} />
              <span className={`${styles.headLabel} ${styles.hideTablet}`}>Champion pool</span>
              <span className={styles.headLabel} />
            </div>

            {loading && <div className={ds.empty}>Chargement des joueurs…</div>}
            {loadError && <div className={ds.empty}>{loadError}</div>}

            {!loading && !loadError && filteredPlayers.length === 0 && (
              <div className={ds.empty}>Aucun joueur ne correspond à ces filtres.</div>
            )}

            {visiblePlayers.map((player) => {
              const team = teamByPlayer.get(Number(player.id));
              const { name, tag } = splitRiotId(player.riot_id);
              const main = roleInfo(player.main_role);
              const secondary = roleInfo(player.secondary_role);
              const rank = formatRank(player.soloq_tier, player.soloq_rank, player.soloq_lp);
              const wr = winRate(player);
              const open = openPlayerId === player.id;
              const isMe = myPlayer?.id === player.id;

              return (
                <div key={player.id} className={`${styles.entry} ${open ? styles.entryOpen : ''}`}>
                  <button
                    type="button"
                    className={`${styles.row} ${styles.rowButton}`}
                    onClick={() => setOpenPlayerId(open ? null : player.id)}
                    aria-expanded={open}
                  >
                    <span className={styles.playerCell}>
                      {team?.logo_url ? (
                        <img src={team.logo_url} alt="" className={styles.teamLogo} loading="lazy" />
                      ) : (
                        <span className={styles.teamLogoEmpty} />
                      )}

                      <span className={styles.playerText}>
                        <span className={styles.playerName}>
                          {name}
                          {tag && <small>#{tag}</small>}
                          {isMe && <em className={ds.meChip}>Toi</em>}
                        </span>
                        <span className={styles.playerTeam}>
                          {teamDivision(team) && (
                            <span
                              className={ds.teamDot}
                              style={{ background: DIVISION_COLORS[teamDivision(team)!] }}
                              title={teamDivision(team)!}
                            />
                          )}
                          {team?.name || 'Sans équipe'}
                        </span>
                      </span>
                    </span>

                    <span className={styles.rolesCell}>
                      {main && <img src={main.image} alt={main.name} title={main.name} className={ds.roleIcon} />}
                      {secondary && (
                        <img
                          src={secondary.image}
                          alt={secondary.name}
                          title={`${secondary.name} (secondaire)`}
                          className={`${ds.roleIcon} ${styles.roleSecondary}`}
                        />
                      )}
                      {!main && !secondary && <span className={ds.muted}>—</span>}
                    </span>

                    <span className={styles.rankCell}>
                      {rank ? (
                        <>
                          <img src={TIERS[player.soloq_tier]?.icon} alt="" className={ds.rankIcon} />
                          <span>{rank}</span>
                        </>
                      ) : (
                        <span className={ds.muted}>Non classé</span>
                      )}
                    </span>

                    <span className={`${styles.points} ${styles.alignRight}`}>
                      {player.czf_points ?? '—'}
                    </span>

                    <span className={`${styles.wr} ${styles.alignRight} ${styles.hideMobile}`}>
                      {wr === null ? (
                        <span className={ds.muted}>—</span>
                      ) : (
                        <>
                          <b className={wr >= 50 ? ds.win : ds.loss}>{wr}%</b>
                          <small>{soloqGames(player)} games</small>
                        </>
                      )}
                    </span>

                    <span className={styles.hideTablet}>
                      <ChampionPool player={player} ddragonVersion={ddragonVersion} />
                    </span>

                    <span className={styles.endCell}>
                      {player.lft && <span className={ds.lftChip}>LFT</span>}
                      <ChevronIcon open={open} />
                    </span>
                  </button>

                  {open && (
                    <PlayerDetails
                      player={player}
                      team={team}
                      ddragonVersion={ddragonVersion}
                      pool={<ChampionPool player={player} ddragonVersion={ddragonVersion} size="large" />}
                    />
                  )}
                </div>
              );
            })}

            {hasMore && <div ref={sentinelRef} className={ds.empty}>Chargement…</div>}
          </div>

          {!loading && filteredPlayers.length > 0 && (
            <p className={ds.resultCount}>
              {Math.min(visibleCount, filteredPlayers.length)} sur {filteredPlayers.length} joueur
              {filteredPlayers.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/* =========================================================
   DÉTAIL D'UN JOUEUR
========================================================= */

function PlayerDetails({
  player,
  team,
  ddragonVersion,
  pool,
}: {
  player: any;
  team: any;
  ddragonVersion: string;
  pool: React.ReactNode;
}) {
  const { name, tag } = splitRiotId(player.riot_id);
  const wr = winRate(player);

  const stats = [
    { label: 'SoloQ', value: formatRank(player.soloq_tier, player.soloq_rank, player.soloq_lp) || 'Non classé' },
    { label: 'Peak', value: formatRank(player.peak_tier, player.peak_rank, player.peak_lp) || '—' },
    { label: 'Flex', value: formatRank(player.flex_tier, player.flex_rank, player.flex_lp) || '—' },
    { label: 'WR SoloQ', value: wr === null ? '—' : `${wr}% · ${soloqGames(player)} games` },
    { label: 'Niveau', value: player.summoner_level || '—' },
    { label: 'Points CZF', value: player.czf_points ?? '—' },
  ];

  return (
    <div className={`${styles.details} ${ds.onDark}`}>
      <div className={styles.detailsHead}>
        {player.profile_icon_id ? (
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${player.profile_icon_id}.png`}
            alt=""
            className={styles.profileIcon}
          />
        ) : (
          <span className={styles.profileIcon} />
        )}

        <div className={styles.detailsWho}>
          <div className={styles.detailsName}>
            {name}
            {tag && <small>#{tag}</small>}
          </div>

          <div className={styles.detailsMeta}>
            <span>Discord · {player.profiles?.discord_name || 'non lié'}</span>
            <span>Équipe · {team?.name || 'aucune'}</span>
            {player.main_role && (
              <span>
                Rôles · {player.main_role}
                {player.secondary_role ? ` / ${player.secondary_role}` : ''}
              </span>
            )}
          </div>
        </div>

        <a href={dpmUrl(player.riot_id)} target="_blank" rel="noreferrer" className={ds.btnOutline}>
          Profil DPM
        </a>
      </div>

      <div className={styles.detailsStats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.detailsStat}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.detailsBottom}>
        <div>
          <div className={styles.detailsLabel}>Champion pool</div>
          {pool}
        </div>

        {player.description && (
          <div>
            <div className={styles.detailsLabel}>Description</div>
            <p className={styles.description}>{player.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CRÉATION DU PROFIL
========================================================= */

function ProfileCard({
  user,
  myPlayer,
  onCreated,
}: {
  user: any;
  myPlayer: any;
  onCreated: () => Promise<void>;
}) {
  const [riotId, setRiotId] = useState('');
  const [mainRole, setMainRole] = useState('');
  const [secondaryRole, setSecondaryRole] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(true);

    if (!mainRole) return setMessage('Choisis un rôle principal.');
    if (!riotId.includes('#')) return setMessage('Riot ID invalide. Format attendu : Pseudo#TAG');

    setError(false);
    setSubmitting(true);
    setMessage('Recherche Riot en cours…');

    try {
      const riotRes = await fetch('/api/riot/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riot_id: riotId }),
      });

      const riot = await riotRes.json();

      if (!riot.success) throw new Error(riot.message || 'Erreur Riot API');

      const riotData = riot.data;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          riot_id: riotId,
          main_role: mainRole,
          secondary_role: secondaryRole || null,
          description: description || null,

          puuid: riotData.puuid,
          summoner_level: riotData.summoner_level,
          profile_icon_id: riotData.profile_icon_id,

          soloq_tier: riotData.soloq_tier,
          soloq_rank: riotData.soloq_rank,
          soloq_lp: riotData.soloq_lp,
          soloq_wins: riotData.soloq_wins,
          soloq_losses: riotData.soloq_losses,

          flex_tier: riotData.flex_tier,
          flex_rank: riotData.flex_rank,
          flex_lp: riotData.flex_lp,

          peak_tier: riotData.peak_tier,
          peak_rank: riotData.peak_rank,
          peak_lp: riotData.peak_lp,

          czf_points: riotData.czf_points,
          top_champions: riotData.top_champions,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(
          data.message ||
            data.error?.message ||
            data.error?.details ||
            JSON.stringify(data.error) ||
            'Erreur inconnue.'
        );
      }

      setMessage('Profil créé avec succès.');
      setRiotId('');
      setMainRole('');
      setSecondaryRole('');
      setDescription('');

      await onCreated();
    } catch (err: any) {
      setError(true);
      setMessage(`Erreur création profil : ${err?.message || 'Erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Rejoindre la CZF</div>
        <p className={ds.body}>
          Connecte-toi avec Discord pour créer ton profil joueur et rejoindre une équipe.
        </p>
        <Link href="/login" className={ds.btnPrimary}>
          Se connecter avec Discord
        </Link>
      </div>
    );
  }

  if (myPlayer) {
    const { name, tag } = splitRiotId(myPlayer.riot_id);
    const rank = formatRank(myPlayer.soloq_tier, myPlayer.soloq_rank, myPlayer.soloq_lp);

    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Mon profil</div>
        <div className={ds.myName}>
          {name}
          {tag && <small>#{tag}</small>}
        </div>

        <div className={styles.myRank}>
          {rank ? (
            <>
              <img src={TIERS[myPlayer.soloq_tier]?.icon} alt="" className={styles.myRankIcon} />
              <span>
                <strong>{rank}</strong>
                <small>SoloQ</small>
              </span>
            </>
          ) : (
            <span>
              <strong>Non classé</strong>
              <small>SoloQ</small>
            </span>
          )}

          <span className={styles.myPoints}>
            <strong>{myPlayer.czf_points ?? '—'}</strong>
            <small>Points CZF</small>
          </span>
        </div>

        <Link href="/profile" className={ds.btnOutline}>
          Voir mon profil
        </Link>
      </div>
    );
  }

  // Connecté sans profil : le formulaire ne s'ouvre qu'au clic.
  if (!formOpen) {
    return (
      <div className={`${ds.card} ${ds.sideCard}`}>
        <div className={ds.cardTitle}>Rejoindre la CZF</div>
        <p className={ds.body}>
          Tu n&apos;as pas encore de profil joueur. Crée-le pour apparaître dans la liste et
          rejoindre une équipe.
        </p>
        <button type="button" className={ds.btnPrimary} onClick={() => setFormOpen(true)}>
          Créer mon profil
        </button>
      </div>
    );
  }

  return (
    <form className={`${ds.card} ${ds.sideCard}`} onSubmit={handleSubmit}>
      <div className={ds.cardTitle}>Créer mon profil</div>

      <label className={ds.field}>
        <span>Riot ID</span>
        <input
          className={ds.input}
          placeholder="Pseudo#TAG"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          required
        />
      </label>

      <div className={ds.field}>
        <span>Rôle principal</span>
        <RolePicker value={mainRole} onChange={setMainRole} />
      </div>

      <div className={ds.field}>
        <span>Rôle secondaire (optionnel)</span>
        <RolePicker value={secondaryRole} onChange={setSecondaryRole} optional />
      </div>

      <label className={ds.field}>
        <span>Description (optionnel)</span>
        <textarea
          className={ds.input}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className={ds.formActions}>
        <button type="submit" className={ds.btnPrimary} disabled={submitting}>
          {submitting ? 'Recherche Riot…' : 'Créer mon profil'}
        </button>

        <button
          type="button"
          className={ds.btnOutline}
          disabled={submitting}
          onClick={() => {
            setFormOpen(false);
            setMessage('');
          }}
        >
          Annuler
        </button>
      </div>

      {message && <p className={error ? ds.formError : ds.formInfo}>{message}</p>}
    </form>
  );
}
