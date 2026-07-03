import { NextResponse } from 'next/server';

const RIOT_API_KEY = process.env.RIOT_API_KEY;

function getTierBase(tier: string | null) {
  switch (tier) {
    case 'IRON': return 0;
    case 'BRONZE': return 200;
    case 'SILVER': return 400;
    case 'GOLD': return 650;
    case 'PLATINUM': return 950;
    case 'EMERALD': return 1250;
    case 'DIAMOND': return 1500;
    case 'MASTER': return 1800;
    case 'GRANDMASTER': return 2150;
    case 'CHALLENGER': return 2500;
    default: return 0;
  }
}

function getRankBonus(rank: string | null) {
  switch (rank) {
    case 'III': return 15;
    case 'II': return 30;
    case 'I': return 45;
    default: return 0;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calculateRankPoints(
  tier: string | null,
  rank: string | null,
  lp: number | null
) {
  if (!tier) return 0;

  const rankBonus =
    ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)
      ? 0
      : getRankBonus(rank);

  return getTierBase(tier) + rankBonus + (lp || 0);
}

function calculateCzfPoints({
  soloqTier,
  soloqRank,
  soloqLp,
  wins,
  losses,
  flexTier,
  flexRank,
  flexLp,
  peakTier,
  peakRank,
  peakLp,
}: any) {
  const soloq = calculateRankPoints(soloqTier, soloqRank, soloqLp);
  const flex = calculateRankPoints(flexTier, flexRank, flexLp);
  const peak = calculateRankPoints(peakTier, peakRank, peakLp);

  const games = (wins || 0) + (losses || 0);

  let wrBonus = 0;

  if (games >= 30) {
    const winrate = ((wins || 0) / games) * 100;
    wrBonus = clamp((winrate - 50) * 15, -100, 150);
  }

  const peakBonus = clamp((peak - soloq) * 0.25, 0, 150);
  const flexBonus = clamp((flex - soloq) * 0.15, 0, 100);

  return Math.round(soloq + wrBonus + peakBonus + flexBonus);
}

async function getTopChampions(puuid: string) {
  const queues = [420, 440];
  const allMatchIds: string[] = [];

  for (const queue of queues) {
    const matchIdsRes = await fetch(
      `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&start=0&count=50`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY!,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (matchIdsRes.ok) {
      const ids = await matchIdsRes.json();
      allMatchIds.push(...ids);
    }
  }

  const championCounts: Record<
    string,
    {
      champion_id: number;
      champion_name: string;
      games: number;
    }
  > = {};

  for (const matchId of allMatchIds.slice(0, 70)) {
    const matchRes = await fetch(
      `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY!,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!matchRes.ok) continue;

    const match = await matchRes.json();

    const participant = match.info.participants.find(
      (p: any) => p.puuid === puuid
    );

    if (!participant) continue;

    const key = participant.championName;

    if (!championCounts[key]) {
      championCounts[key] = {
        champion_id: participant.championId,
        champion_name: participant.championName,
        games: 0,
      };
    }

    championCounts[key].games += 1;
  }

  return Object.values(championCounts)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);
}

export async function POST(request: Request) {
  try {
    if (!RIOT_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: 'RIOT_API_KEY manquante.',
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const peak_tier = body.peak_tier;
const peak_rank = body.peak_rank;
const peak_lp = body.peak_lp;

const riot_id = String(body.riot_id).trim();

    if (!riot_id || !riot_id.includes('#')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format attendu : Pseudo#TAG',
        },
        { status: 400 }
      );
    }

const [gameName, tagLine] = riot_id
  .split('#')
  .map((part) => part.trim());    
    

    const accountRes = await fetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
      }
    );

    if (!accountRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'Compte Riot introuvable.',
          status: accountRes.status,
        },
        { status: accountRes.status }
      );
    }

    const account = await accountRes.json();

    const summonerRes = await fetch(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
      }
    );

    if (!summonerRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'Summoner EUW introuvable.',
          status: summonerRes.status,
        },
        { status: summonerRes.status }
      );
    }

    const summoner = await summonerRes.json();

    const leagueRes = await fetch(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
      }
    );

    if (!leagueRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ranked introuvable.',
          status: leagueRes.status,
        },
        { status: leagueRes.status }
      );
    }

    const leagues = await leagueRes.json();

    const soloq =
      leagues.find(
        (entry: any) => entry.queueType === 'RANKED_SOLO_5x5'
      ) || null;

    const flex =
      leagues.find(
        (entry: any) => entry.queueType === 'RANKED_FLEX_SR'
      ) || null;

    const top_champions = body.skip_top_champions
  ? null
  : await getTopChampions(account.puuid);

    const czf_points = calculateCzfPoints({
      soloqTier: soloq?.tier || null,
      soloqRank: soloq?.rank || null,
      soloqLp: soloq?.leaguePoints || 0,
      wins: soloq?.wins || 0,
      losses: soloq?.losses || 0,
      flexTier: flex?.tier || null,
      flexRank: flex?.rank || null,
      flexLp: flex?.leaguePoints || 0,
      peakTier: peak_tier || soloq?.tier || null,
      peakRank: peak_rank || soloq?.rank || null,
      peakLp: peak_lp || 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        riot_id,
        puuid: account.puuid,
        summoner_level: summoner.summonerLevel,
        profile_icon_id: summoner.profileIconId,

        soloq_tier: soloq?.tier || null,
        soloq_rank: soloq?.rank || null,
        soloq_lp: soloq?.leaguePoints || 0,
        soloq_wins: soloq?.wins || 0,
        soloq_losses: soloq?.losses || 0,

        flex_tier: flex?.tier || null,
        flex_rank: flex?.rank || null,
        flex_lp: flex?.leaguePoints || 0,

        peak_tier: peak_tier || soloq?.tier || null,
        peak_rank: peak_rank || soloq?.rank || null,
        peak_lp: peak_lp || 0,

        top_champions,
        czf_points,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur serveur Riot.',
      },
      { status: 500 }
    );
  }
}