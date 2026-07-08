'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

const roles = [
  { name: 'Top', image: '/assets/roles/top.png' },
  { name: 'Jungle', image: '/assets/roles/jungle.png' },
  { name: 'Mid', image: '/assets/roles/mid.png' },
  { name: 'ADC', image: '/assets/roles/adc.png' },
  { name: 'Support', image: '/assets/roles/sup.png' },
];

const tiers = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
];

const ranks = ['IV', 'III', 'II', 'I'];

type SortKey =
  | 'riot_id'
  | 'main_role'
  | 'secondary_role'
  | 'rank'
  | 'points'
  | 'lft';

export default function PlayersPage() {
  const [user, setUser] = useState<any>(null);
  const [myPlayer, setMyPlayer] = useState<any>(null);

  const [riotId, setRiotId] = useState('');
  const [mainRole, setMainRole] = useState('');
  const [secondaryRole, setSecondaryRole] = useState('');
  const [description, setDescription] = useState('');
;

  const [message, setMessage] = useState('');
  const [loadingRiot, setLoadingRiot] = useState(false);

  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [showLftOnly, setShowLftOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('riot_id');
  const [sortDirection, setSortDirection] =
    useState<'asc' | 'desc'>('asc');

  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  useEffect(() => {
    loadUser();
    fetchPlayers();
    fetchTeams();
    fetchTeamMembers();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (!user) return;

    const { data: players } = await supabase
      .from('players')
      .select('*');

    const linkedPlayer = players?.find(
      (p: any) => p.profile_id === user.id
    );

    setMyPlayer(linkedPlayer || null);
  }

  async function fetchPlayers() {
  const res = await fetch('/api/players');
  const data = await res.json();

  console.log(data.data);

  if (data.success) {
    setPlayers(data.data);
  }
}

  async function fetchTeams() {
    const res = await fetch('/api/teams');
    const data = await res.json();

    if (data.success) {
      setTeams(data.data);
    }
  }

  async function fetchTeamMembers() {
    const res = await fetch('/api/team-members');
    const data = await res.json();

    if (data.success) {
      setTeamMembers(data.data);
    }
  }

  async function fetchRiotData() {
  const res = await fetch('/api/riot/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      riot_id: riotId,
    }),
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message || 'Erreur Riot API');
  }

  return data.data;
}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setMessage('Tu dois être connecté avec Discord.');
      return;
    }

    if (!mainRole) {
      setMessage('Choisis un rôle principal.');
      return;
    }

    if (!riotId.includes('#')) {
      setMessage('Riot ID invalide. Format attendu : Pseudo#TAG');
      return;
    }

    setLoadingRiot(true);
    setMessage('Recherche Riot en cours...');

    try {
      const riotData = await fetchRiotData();

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
console.log('Réponse création profil :', data);
      if (data.success) {
        setMessage('Profil créé avec succès ✅');
        setRiotId('');
        setMainRole('');
        setSecondaryRole('');
        setDescription('');

        await fetchPlayers();
        await loadUser();
      } else {
  const errorMessage =
    data.message ||
    data.error?.message ||
    data.error?.details ||
    JSON.stringify(data.error) ||
    'Erreur inconnue.';

  setMessage(`Erreur création profil ❌ ${errorMessage}`);
}
    } catch (error: any) {
  setMessage(`Erreur création profil ❌ ${error.message || 'Erreur inconnue'}`);
}

    setLoadingRiot(false);
  }

  function getRoleIcon(role: string) {
    if (!role) return null;

    return role === 'Support'
      ? '/assets/roles/sup.png'
      : `/assets/roles/${role.toLowerCase()}.png`;
  }

function getRankIcon(player: any) {
  switch (player.soloq_tier) {
    case 'IRON':
      return '/assets/ranks/iron.webp';

    case 'BRONZE':
      return '/assets/ranks/bronze.webp';

    case 'SILVER':
      return '/assets/ranks/silver.webp';

    case 'GOLD':
      return '/assets/ranks/gold.webp';

    case 'PLATINUM':
      return '/assets/ranks/platine.webp';

    case 'EMERALD':
      return '/assets/ranks/Emerald.webp';

    case 'DIAMOND':
      return '/assets/ranks/diamant.webp';

    case 'MASTER':
      return '/assets/ranks/master.webp';

    case 'GRANDMASTER':
      return '/assets/ranks/gm.webp';

    case 'CHALLENGER':
      return '/assets/ranks/chall.webp';

    default:
      return '/assets/ranks/iron.webp';
  }
}


function getRankText(player: any) {
  if (!player.soloq_tier) return 'Unranked';

  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(player.soloq_tier)) {
    return `${player.soloq_tier} ${player.soloq_lp || 0} LP`;
  }

  return `${player.soloq_tier} ${player.soloq_rank || ''} ${player.soloq_lp || 0} LP`;
}
  function getChampionIconUrl(championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${championName}.png`;
}

function renderChampionPool(player: any) {
  const champions = player.top_champions || [];

  if (!champions.length) return <span>-</span>;

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {champions.map((champion: any) => (
        <img
          key={champion.champion_id}
          src={getChampionIconUrl(champion.champion_name)}
          alt={champion.champion_name}
          title={`${champion.champion_name} - ${champion.games} games`}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ))}
    </div>
  );
}

  function getPlayerPoints(player: any) {
    return player.czf_points ?? null;
  }

  function getPlayerRankValue(player: any) {
  const tierOrder: Record<string, number> = {
    IRON: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLATINUM: 4,
    EMERALD: 5,
    DIAMOND: 6,
    MASTER: 7,
    GRANDMASTER: 8,
    CHALLENGER: 9,
  };

  const rankOrder: Record<string, number> = {
    IV: 0,
    III: 1,
    II: 2,
    I: 3,
  };

  const tier = player.soloq_tier;
  const rank = player.soloq_rank;
  const lp = player.soloq_lp || 0;

  return (
    (tierOrder[tier] ?? -1) * 10000 +
    (rankOrder[rank] ?? 0) * 1000 +
    lp
  );
}



  function getPlayerRank(player: any) {
    if (!player.soloq_tier) return '-';

    if (
      ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(
        player.soloq_tier
      )
    ) {
      return `${player.soloq_tier} ${player.soloq_lp || 0} LP`;
    }

    return `${player.soloq_tier} ${player.soloq_rank || ''} ${
      player.soloq_lp || 0
    } LP`;
  }

  function getPeakRank(player: any) {
    if (!player.peak_tier) return '-';

    if (
      ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(
        player.peak_tier
      )
    ) {
      return `${player.peak_tier} ${player.peak_lp || 0} LP`;
    }

    return `${player.peak_tier} ${player.peak_rank || ''} ${
      player.peak_lp || 0
    } LP`;
  }

  function getFlexRank(player: any) {
    if (!player.flex_tier) return '-';

    if (
      ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(
        player.flex_tier
      )
    ) {
      return `${player.flex_tier} ${player.flex_lp || 0} LP`;
    }

    return `${player.flex_tier} ${player.flex_rank || ''} ${
      player.flex_lp || 0
    } LP`;
  }

  function getPlayerWR(player: any) {
    const wins = player.soloq_wins || 0;
    const losses = player.soloq_losses || 0;
    const total = wins + losses;

    if (total === 0) return '-';

    return `${Math.round((wins / total) * 100)}%`;
  }

  function getPlayerGames(player: any) {
    const wins = player.soloq_wins || 0;
    const losses = player.soloq_losses || 0;
    return wins + losses;
  }

  function getPlayerTeam(player: any) {
    const member = teamMembers.find(
      (m) => m.riot_id === player.riot_id
    );

    if (!member) return null;

    return teams.find((team) => team.id === member.team_id) || null;
  }

function getDpmUrl(riotId: string) {
  return `https://dpm.lol/${riotId.replace('#', '-')}`;
}

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection(
        sortDirection === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  function getSortLabel(key: SortKey, label: string) {
  if (sortKey !== key) return `${label} ↕`;

  return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
}

  const displayedPlayers = useMemo(() => {
    let list = [...players];

    if (showLftOnly) {
      list = list.filter((player) => player.lft);
    }

    list.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortKey === 'points') {
        aValue = getPlayerPoints(a) ?? -1;
        bValue = getPlayerPoints(b) ?? -1;
      } else if (sortKey === 'rank') {
  aValue = getPlayerRankValue(a);
  bValue = getPlayerRankValue(b);

      } else if (sortKey === 'lft') {
        aValue = a.lft ? 1 : 0;
        bValue = b.lft ? 1 : 0;
      } else {
        aValue = a[sortKey] || '';
        bValue = b[sortKey] || '';
      }

      if (typeof aValue === 'number') {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return list;
  }, [
    players,
    showLftOnly,
    sortKey,
    sortDirection,
    teams,
    teamMembers,
  ]);

  return (
    <>
      <Nav />

      <main className="section">
        <div className="sectionTitle">
          <span></span>
          <h2>Joueurs</h2>
        </div>

        <div className="card">
          <h3>Créer mon profil</h3>

          {!user && (
            <p>
              Tu dois te connecter avec Discord avant de créer ton profil.
            </p>
          )}

          {user && myPlayer && (
            <p>
              Profil déjà créé : <strong>{myPlayer.riot_id}</strong>
            </p>
          )}

          {user && !myPlayer && (
            <form onSubmit={handleSubmit} className="fakeForm">
              <input
                placeholder="Riot ID (Pseudo#TAG)"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                required
              />

              <div className="rolesContainer">
                <div className="roleSection">
                  <h4>RÔLE PRINCIPAL</h4>

                  <div className="rolePicker">
                    {roles.map((role) => (
                      <button
                        key={role.name}
                        type="button"
                        className={
                          mainRole === role.name
                            ? 'roleBtn active'
                            : 'roleBtn'
                        }
                        onClick={() => setMainRole(role.name)}
                      >
                        <img src={role.image} alt={role.name} />
                        <span>{role.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="roleSection">
                  <h4>RÔLE SECONDAIRE (OPTIONNEL)</h4>

                  <div className="rolePicker">
                    {roles.map((role) => (
                      <button
                        key={`secondary-${role.name}`}
                        type="button"
                        className={
                          secondaryRole === role.name
                            ? 'roleBtn active'
                            : 'roleBtn'
                        }
                        onClick={() => setSecondaryRole(role.name)}
                      >
                        <img src={role.image} alt={role.name} />
                        <span>{role.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>


              <textarea
                placeholder="Description (optionnel)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button type="submit" disabled={loadingRiot}>
                {loadingRiot
                  ? 'Recherche Riot...'
                  : 'Créer mon profil'}
              </button>
            </form>
          )}

          {message && <p>{message}</p>}
        </div>

        <br />

        <div className="card">
          <h3>Liste des joueurs</h3>

          <button
            type="button"
            className="joinTeamBtn"
            onClick={() => setShowLftOnly(!showLftOnly)}
          >
            {showLftOnly
              ? 'Voir tous les joueurs'
              : 'Afficher seulement les LFT'}
          </button>

          <br />
          <br />

          <div className="playersTable">
            <div className="playersHeader">
              <div onClick={() => handleSort('riot_id')}>
                {getSortLabel('riot_id', 'Riot ID')}
              </div>

              <div onClick={() => handleSort('main_role')}>
                {getSortLabel('main_role', 'Rôle principal')}
              </div>

              <div onClick={() => handleSort('secondary_role')}>
                {getSortLabel('secondary_role', 'Rôle secondaire')}
              </div>

              <div onClick={() => handleSort('rank')}>
                {getSortLabel('rank', 'Rank')}
              </div>

              <div onClick={() => handleSort('points')}>
                {getSortLabel('points', 'Points')}
              </div>

              <div>WR</div>
              <div>Pool</div>

              <div onClick={() => handleSort('lft')}>
                {getSortLabel('lft', 'LFT')}
              </div>
            </div>

            {displayedPlayers.map((player) => {
  const points = getPlayerPoints(player);

  return (
    <div key={player.id}>
      <div
        className="playerRow"
        onClick={() =>
          setSelectedPlayer(
            selectedPlayer?.id === player.id ? null : player
          )
        }
        style={{ cursor: 'pointer' }}
      >
                  <div>{player.riot_id}</div>

                  <div>
                    {player.main_role && (
                      <img
                        className="roleIcon"
                        src={getRoleIcon(player.main_role) || ''}
                        alt={player.main_role}
                      />
                    )}
                  </div>

                  <div>
                    {player.secondary_role && (
                      <img
                        className="roleIcon"
                        src={getRoleIcon(player.secondary_role) || ''}
                        alt={player.secondary_role}
                      />
                    )}
                  </div>

                  <div className="rankCell">
  <img
    src={getRankIcon(player)}
    alt={getRankText(player)}
    className="rankIcon"
  />
  <span>{getRankText(player)}</span>
</div>

                  <div>{points ?? '-'}</div>

                  <div>{getPlayerWR(player)}</div>
                  <div>{renderChampionPool(player)}</div>

                  <div>{player.lft ? '🟢' : '-'}</div>
                      </div>

      {selectedPlayer?.id === player.id && (
        <div className="card">
          <h3>{player.riot_id}</h3>

          <p><strong>Nom Discord :</strong> {player.profiles?.discord_name || '-'}</p>
          <p style={{ color: '#5865F2', fontWeight: 'bold' }}>
  💬 {player.profiles?.discord_name || 'Non lié'}
</p>

          {player.profile_icon_id && (
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/profileicon/${player.profile_icon_id}.png`}
              alt="Icone Riot"
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          )}

          <p><strong>Rôle principal :</strong> {player.main_role || '-'}</p>
          <p><strong>Rôle secondaire :</strong> {player.secondary_role || '-'}</p>

          <div>
            <strong>Champion pool :</strong>
            <div style={{ marginTop: '8px' }}>
              {renderChampionPool(player)}
            </div>
          </div>

          <p><strong>Rank SoloQ :</strong> {getPlayerRank(player)}</p>
          <p><strong>Peak :</strong> {getPeakRank(player)}</p>
          <p><strong>Flex :</strong> {getFlexRank(player)}</p>
          <p><strong>WR SoloQ :</strong> {getPlayerWR(player)}</p>
          <p><strong>Games SoloQ :</strong> {getPlayerGames(player)}</p>
          <p><strong>Niveau :</strong> {player.summoner_level || '-'}</p>
          <p><strong>Points CZF :</strong> {getPlayerPoints(player) ?? '-'}</p>
          <p><strong>Équipe :</strong> {getPlayerTeam(player)?.name || 'Aucune'}</p>
          <p><strong>Description :</strong> {player.description || '-'}</p>

          <p>
            <a
              href={getDpmUrl(player.riot_id)}
              target="_blank"
              rel="noreferrer"
              className="multiggLink"
            >
              Voir le profil DPM →
            </a>
          </p>

          <button
            className="joinTeamBtn"
            onClick={() => setSelectedPlayer(null)}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
            })}
          </div>
        </div>
      </main>
    </>
  );
}