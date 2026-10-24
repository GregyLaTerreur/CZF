'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  DIVISION_COLORS,
  DIVISIONS,
  type DivisionName,
} from '@/app/components/home/divisions';
import styles from './players.module.css';

/* =========================================================
   CONSTANTES
========================================================= */

const ROLES = [
  { name: 'Top', label: 'TOP', image: '/assets/roles/top.png' },
  { name: 'Jungle', label: 'JGL', image: '/assets/roles/jungle.png' },
  { name: 'Mid', label: 'MID', image: '/assets/roles/mid.png' },
  { name: 'ADC', label: 'ADC', image: '/assets/roles/adc.png' },
  { name: 'Support', label: 'SUP', image: '/assets/roles/sup.png' },
];

const TIERS: Record<string, { label: string; icon: string; order: number }> = {
  IRON: { label: 'Fer', icon: '/assets/ranks/iron.webp', order: 0 },
  BRONZE: { label: 'Bronze', icon: '/assets/ranks/bronze.webp', order: 1 },
  SILVER: { label: 'Argent', icon: '/assets/ranks/silver.webp', order: 2 },
  GOLD: { label: 'Or', icon: '/assets/ranks/gold.webp', order: 3 },
  PLATINUM: { label: 'Platine', icon: '/assets/ranks/platine.webp', order: 4 },
  EMERALD: { label: 'Émeraude', icon: '/assets/ranks/Emerald.webp', order: 5 },
  DIAMOND: { label: 'Diamant', icon: '/assets/ranks/diamant.webp', order: 6 },
  MASTER: { label: 'Maître', icon: '/assets/ranks/master.webp', order: 7 },
  GRANDMASTER: { label: 'Grand Maître', icon: '/assets/ranks/gm.webp', order: 8 },
  CHALLENGER: { label: 'Challenger', icon: '/assets/ranks/chall.webp', order: 9 },
};

const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVISION_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

const DDRAGON_FALLBACK = '14.24.1';
const PAGE_SIZE = 40;

type SortKey = 'riot_id' | 'main_role' | 'rank' | 'points' | 'wr';
type SortDirection = 'asc' | 'desc';

/* =========================================================
   HELPERS
========================================================= */

function splitRiotId(riotId: string) {
  const [name, tag] = String(riotId || '').split('#');
  return { name, tag };
}

function roleInfo(role: string | null | undefined) {
  return ROLES.find((item) => item.name === role) || null;
}

// "Maître 375 LP", "Or II 54 LP" ou null si non classé.
function formatRank(tier?: string | null, division?: string | null, lp?: number | null) {
  if (!tier) return null;

  const label = TIERS[tier]?.label ?? tier;

  if (APEX_TIERS.includes(tier)) return `${label} ${lp || 0} LP`;

  return `${label} ${division || ''} ${lp || 0} LP`.replace(/\s+/g, ' ');
}

function rankValue(player: any) {
  const tier = TIERS[player.soloq_tier]?.order ?? -1;
  const division = DIVISION_ORDER[player.soloq_rank] ?? 0;

  return tier * 10000 + division * 1000 + (player.soloq_lp || 0);
}

function soloqGames(player: any) {
  return (player.soloq_wins || 0) + (player.soloq_losses || 0);
}

function winRate(player: any): number | null {
  const games = soloqGames(player);
  return games ? Math.round(((player.soloq_wins || 0) / games) * 100) : null;
}

// Division d'un joueur = celle de son équipe, si elle est validée.
function teamDivision(team: any): DivisionName | null {
  if (team?.validated_by_admin !== true) return null;

  return DIVISIONS.includes(team.division) ? team.division : null;
}

function dpmUrl(riotId: string) {
  return `https://dpm.lol/${encodeURIComponent(riotId.replace('#', '-'))}`;
}

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

function ChampionPool({
  player,
  ddragonVersion,
  size = 'small',
}: {
  player: any;
  ddragonVersion: string;
  size?: 'small' | 'large';
}) {
  const champions = player.top_champions || [];

  if (!champions.length) return <span className={styles.muted}>—</span>;

  return (
    <div className={size === 'large' ? styles.poolLarge : styles.pool}>
      {champions.map((champion: any) => (
        <img
          key={champion.champion_id}
          src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champion.champion_name}.png`}
          alt={champion.champion_name}
          title={champion.champion_name}
          loading="lazy"
          // Nom de champion inconnu de Data Dragon : on masque l'image cassée.
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}

function RolePicker({
  value,
  onChange,
  optional,
}: {
  value: string;
  onChange: (role: string) => void;
  optional?: boolean;
}) {
  return (
    <div className={styles.rolePicker}>
      {ROLES.map((role) => (
        <button
          key={role.name}
          type="button"
          className={value === role.name ? styles.rolePickActive : styles.rolePick}
          // Le rôle secondaire peut être retiré en recliquant dessus.
          onClick={() => onChange(optional && value === role.name ? '' : role.name)}
          title={role.name}
        >
          <img src={role.image} alt="" />
          {role.label}
        </button>
      ))}
    </div>
  );
}

/* =========================================================
   VUE
========================================================= */

export default function PlayersView() {
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ddragonVersion, setDdragonVersion] = useState(DDRAGON_FALLBACK);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<DivisionName | null>(null);
  const [participantsOnly, setParticipantsOnly] = useState(false);
  const [lftOnly, setLftOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadData();

    // Version Data Dragon à jour pour les icônes des champions récents.
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((res) => res.json())
      .then((versions) => versions?.[0] && setDdragonVersion(versions[0]))
      .catch(() => {});
  }, []);

  async function loadData() {
    try {
      const [playersRes, teamsRes, membersRes] = await Promise.all([
        fetch('/api/players').then((res) => res.json()),
        fetch('/api/teams').then((res) => res.json()),
        fetch('/api/team-members').then((res) => res.json()),
      ]);

      if (!playersRes.success) throw new Error('Impossible de charger les joueurs.');

      setPlayers(playersRes.data || []);
      setTeams(teamsRes.success ? teamsRes.data || [] : []);
      setTeamMembers(membersRes.success ? membersRes.data || [] : []);
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

  // Équipe de chaque joueur : par player_id, sinon par Riot ID.
  const teamByPlayer = useMemo(() => {
    const teamMap = new Map(teams.map((team) => [Number(team.id), team]));
    const result = new Map<number, any>();

    for (const player of players) {
      const riotId = String(player.riot_id || '').trim().toLowerCase();

      const member = teamMembers.find((m) =>
        m.player_id !== null && m.player_id !== undefined
          ? Number(m.player_id) === Number(player.id)
          : String(m.riot_id || '').trim().toLowerCase() === riotId
      );

      const team = member ? teamMap.get(Number(member.team_id)) : null;
      if (team) result.set(Number(player.id), team);
    }

    return result;
  }, [players, teams, teamMembers]);

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

  return (
    <>
      {/* =================================================
          EN-TÊTE
      ================================================= */}

      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerGrid}`}>
          <div>
            <div className={styles.sectionLabel}>Saison 1 · Joueurs</div>
            <h1 className={styles.h1}>Les joueurs</h1>
            <p className={styles.body}>
              Tous les joueurs inscrits à la CZF, leur rang SoloQ, leurs points CZF et leur
              champion pool. Les joueurs LFT cherchent une équipe.
            </p>

            <div className={styles.counters}>
              <div className={styles.counter}>
                <strong>{loading ? '—' : counts.total}</strong>
                <span>Inscrits</span>
              </div>
              <div className={styles.counter}>
                <strong>{loading ? '—' : counts.participants}</strong>
                <span>En équipe validée</span>
              </div>
              <div className={styles.counter}>
                <strong className={styles.teal}>{loading ? '—' : counts.lft}</strong>
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

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Rechercher un joueur, un pseudo Discord, une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className={styles.tabs}>
              <button
                type="button"
                className={participantsOnly ? styles.tabActive : styles.tab}
                onClick={() => setParticipantsOnly(!participantsOnly)}
                aria-pressed={participantsOnly}
              >
                Participants
              </button>

              <button
                type="button"
                className={lftOnly ? styles.tabActive : styles.tab}
                onClick={() => setLftOnly(!lftOnly)}
                aria-pressed={lftOnly}
              >
                <span className={styles.dot} />
                LFT
              </button>
            </div>
          </div>

          <div className={`${styles.tabs} ${styles.divisionTabs}`}>
            <button
              type="button"
              className={divisionFilter === null ? styles.tabActive : styles.tab}
              onClick={() => setDivisionFilter(null)}
            >
              Toutes les divisions
            </button>

            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                className={divisionFilter === division ? styles.tabActive : styles.tab}
                onClick={() => setDivisionFilter(divisionFilter === division ? null : division)}
              >
                <span className={styles.dot} style={{ background: DIVISION_COLORS[division] }} />
                {division}
              </button>
            ))}
          </div>

          <div className={`${styles.tabs} ${styles.roleTabs}`}>
            <button
              type="button"
              className={roleFilter === null ? styles.tabActive : styles.tab}
              onClick={() => setRoleFilter(null)}
            >
              Tous les rôles
            </button>

            {ROLES.map((role) => (
              <button
                key={role.name}
                type="button"
                className={roleFilter === role.name ? styles.tabActive : styles.tab}
                onClick={() => setRoleFilter(roleFilter === role.name ? null : role.name)}
              >
                <img src={role.image} alt="" className={styles.tabRoleIcon} />
                {role.label}
              </button>
            ))}
          </div>

          <div className={styles.card}>
            <div className={`${styles.row} ${styles.rowHead}`}>
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="riot_id" label="Joueur" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="main_role" label="Rôles" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="rank" label="Rang SoloQ" />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="points" label="Pts CZF" className={styles.alignRight} />
              <SortHeader sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} sort="wr" label="WR" className={`${styles.alignRight} ${styles.hideMobile}`} />
              <span className={`${styles.headLabel} ${styles.hideTablet}`}>Champion pool</span>
              <span className={styles.headLabel} />
            </div>

            {loading && <div className={styles.empty}>Chargement des joueurs…</div>}
            {loadError && <div className={styles.empty}>{loadError}</div>}

            {!loading && !loadError && filteredPlayers.length === 0 && (
              <div className={styles.empty}>Aucun joueur ne correspond à ces filtres.</div>
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
                          {isMe && <em className={styles.meChip}>Toi</em>}
                        </span>
                        <span className={styles.playerTeam}>
                          {teamDivision(team) && (
                            <span
                              className={styles.teamDot}
                              style={{ background: DIVISION_COLORS[teamDivision(team)!] }}
                              title={teamDivision(team)!}
                            />
                          )}
                          {team?.name || 'Sans équipe'}
                        </span>
                      </span>
                    </span>

                    <span className={styles.rolesCell}>
                      {main && <img src={main.image} alt={main.name} title={main.name} className={styles.roleIcon} />}
                      {secondary && (
                        <img
                          src={secondary.image}
                          alt={secondary.name}
                          title={`${secondary.name} (secondaire)`}
                          className={`${styles.roleIcon} ${styles.roleSecondary}`}
                        />
                      )}
                      {!main && !secondary && <span className={styles.muted}>—</span>}
                    </span>

                    <span className={styles.rankCell}>
                      {rank ? (
                        <>
                          <img src={TIERS[player.soloq_tier]?.icon} alt="" className={styles.rankIcon} />
                          <span>{rank}</span>
                        </>
                      ) : (
                        <span className={styles.muted}>Non classé</span>
                      )}
                    </span>

                    <span className={`${styles.points} ${styles.alignRight}`}>
                      {player.czf_points ?? '—'}
                    </span>

                    <span className={`${styles.wr} ${styles.alignRight} ${styles.hideMobile}`}>
                      {wr === null ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        <>
                          <b className={wr >= 50 ? styles.win : styles.loss}>{wr}%</b>
                          <small>{soloqGames(player)} games</small>
                        </>
                      )}
                    </span>

                    <span className={styles.hideTablet}>
                      <ChampionPool player={player} ddragonVersion={ddragonVersion} />
                    </span>

                    <span className={styles.endCell}>
                      {player.lft && <span className={styles.lftChip}>LFT</span>}
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

            {filteredPlayers.length > visibleCount && (
              <button
                type="button"
                className={styles.cardFooter}
                onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}
              >
                Afficher plus · {filteredPlayers.length - visibleCount} restants
              </button>
            )}
          </div>

          {!loading && filteredPlayers.length > 0 && (
            <p className={styles.resultCount}>
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
    <div className={styles.details}>
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

        <a href={dpmUrl(player.riot_id)} target="_blank" rel="noreferrer" className={styles.btnOutline}>
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
      <div className={`${styles.card} ${styles.profileCard}`}>
        <div className={styles.cardTitle}>Rejoindre la CZF</div>
        <p className={styles.body}>
          Connecte-toi avec Discord pour créer ton profil joueur et rejoindre une équipe.
        </p>
        <Link href="/login" className={styles.btnPrimary}>
          Se connecter avec Discord
        </Link>
      </div>
    );
  }

  if (myPlayer) {
    const { name, tag } = splitRiotId(myPlayer.riot_id);

    return (
      <div className={`${styles.card} ${styles.profileCard}`}>
        <div className={styles.cardTitle}>Mon profil</div>
        <div className={styles.myName}>
          {name}
          {tag && <small>#{tag}</small>}
        </div>
        <p className={styles.body}>Ton profil joueur est créé.</p>
        <Link href="/profile" className={styles.btnOutline}>
          Voir mon profil
        </Link>
      </div>
    );
  }

  // Connecté sans profil : le formulaire ne s'ouvre qu'au clic.
  if (!formOpen) {
    return (
      <div className={`${styles.card} ${styles.profileCard}`}>
        <div className={styles.cardTitle}>Rejoindre la CZF</div>
        <p className={styles.body}>
          Tu n&apos;as pas encore de profil joueur. Crée-le pour apparaître dans la liste et
          rejoindre une équipe.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={() => setFormOpen(true)}>
          Créer mon profil
        </button>
      </div>
    );
  }

  return (
    <form className={`${styles.card} ${styles.profileCard}`} onSubmit={handleSubmit}>
      <div className={styles.cardTitle}>Créer mon profil</div>

      <label className={styles.field}>
        <span>Riot ID</span>
        <input
          className={styles.input}
          placeholder="Pseudo#TAG"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          required
        />
      </label>

      <div className={styles.field}>
        <span>Rôle principal</span>
        <RolePicker value={mainRole} onChange={setMainRole} />
      </div>

      <div className={styles.field}>
        <span>Rôle secondaire (optionnel)</span>
        <RolePicker value={secondaryRole} onChange={setSecondaryRole} optional />
      </div>

      <label className={styles.field}>
        <span>Description (optionnel)</span>
        <textarea
          className={styles.input}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
          {submitting ? 'Recherche Riot…' : 'Créer mon profil'}
        </button>

        <button
          type="button"
          className={styles.btnOutline}
          disabled={submitting}
          onClick={() => {
            setFormOpen(false);
            setMessage('');
          }}
        >
          Annuler
        </button>
      </div>

      {message && <p className={error ? styles.formError : styles.formInfo}>{message}</p>}
    </form>
  );
}
