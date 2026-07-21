import { NextResponse } from 'next/server';

const RIOT_API_KEY = process.env.RIOT_API_KEY?.trim();

function getTierBase(tier: string | null) {
  switch (tier) {
    case 'IRON':
      return 0;
    case 'BRONZE':
      return 200;
    case 'SILVER':
      return 400;
    case 'GOLD':
      return 650;
    case 'PLATINUM':
      return 950;
    case 'EMERALD':
      return 1250;
    case 'DIAMOND':
      return 1500;
    case 'MASTER':
      return 1800;
    case 'GRANDMASTER':
      return 2150;
    case 'CHALLENGER':
      return 2500;
    default:
      return 0;
  }
}

function getRankBonus(rank: string | null) {
  switch (rank) {
    case 'III':
      return 15;
    case 'II':
      return 30;
    case 'I':
      return 45;
    default:
      return 0;
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

  const rankBonus = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(
    tier
  )
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
  const soloq = calculateRankPoints(
    soloqTier,
    soloqRank,
    soloqLp
  );

  const flex = calculateRankPoints(
    flexTier,
    flexRank,
    flexLp
  );

  const peak = calculateRankPoints(
    peakTier,
    peakRank,
    peakLp
  );

  const games = (wins || 0) + (losses || 0);

  let wrBonus = 0;

  if (games >= 30) {
    const winrate = ((wins || 0) / games) * 100;

    wrBonus = clamp(
      (winrate - 50) * 15,
      -100,
      150
    );
  }

  const peakBonus = clamp(
    (peak - soloq) * 0.25,
    0,
    150
  );

  const flexBonus = clamp(
    (flex - soloq) * 0.15,
    0,
    100
  );

  return Math.round(
    soloq + wrBonus + peakBonus + flexBonus
  );
}

async function getChampionIdToNameMap() {
  const versionsRes = await fetch(
    'https://ddragon.leagueoflegends.com/api/versions.json',
    {
      cache: 'no-store',
    }
  );

  if (!versionsRes.ok) {
    throw new Error(
      `Impossible de récupérer la version Data Dragon (${versionsRes.status}).`
    );
  }

  const versions: string[] = await versionsRes.json();
  const latestVersion = versions[0];

  const championsRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`,
    {
      cache: 'no-store',
    }
  );

  if (!championsRes.ok) {
    throw new Error(
      `Impossible de récupérer les champions Data Dragon (${championsRes.status}).`
    );
  }

  const championsData = await championsRes.json();

  const championMap: Record<number, string> = {};

  Object.values(championsData.data).forEach(
    (champion: any) => {
      championMap[Number(champion.key)] = champion.id;
    }
  );

  return championMap;
}

async function getTopChampions(puuid: string) {
  const masteryRes = await fetch(
    `https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
      puuid
    )}`,
    {
      headers: {
        'X-Riot-Token': RIOT_API_KEY!,
      },
      cache: 'no-store',
    }
  );

  if (!masteryRes.ok) {
    const riotError = await masteryRes.text();

    console.log('RIOT MASTERY ERROR:', {
      status: masteryRes.status,
      body: riotError,
    });

    throw new Error(
      masteryRes.status === 401
        ? 'Clé Riot non transmise ou refusée.'
        : masteryRes.status === 403
          ? 'Clé Riot invalide ou expirée.'
          : masteryRes.status === 429
            ? 'Trop de requêtes Riot pour les maîtrises.'
            : `Impossible de récupérer les maîtrises (${masteryRes.status}).`
    );
  }

  const masteries = await masteryRes.json();
  const championMap = await getChampionIdToNameMap();

  return masteries
    .slice(0, 5)
    .map((champion: any) => ({
      champion_id: champion.championId,
      champion_name:
        championMap[champion.championId] ||
        String(champion.championId),
      champion_points: champion.championPoints,
      champion_level: champion.championLevel,
    }));
}

function getRiotErrorMessage(status: number) {
  switch (status) {
    case 400:
      return 'Requête Riot invalide.';
    case 401:
      return 'Clé Riot non transmise ou refusée.';
    case 403:
      return 'Clé Riot invalide, expirée ou sans autorisation.';
    case 404:
      return 'Compte Riot introuvable.';
    case 429:
      return 'Trop de requêtes envoyées à Riot. Réessaie dans quelques instants.';
    default:
      return `Erreur Riot (${status}).`;
  }
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

    console.log('BODY RIOT:', body);

    console.log('RIOT KEY CHECK:', {
      exists: Boolean(RIOT_API_KEY),
      prefix: RIOT_API_KEY.slice(0, 6),
      length: RIOT_API_KEY.length,
      hasWhitespace:
        process.env.RIOT_API_KEY !==
        process.env.RIOT_API_KEY?.trim(),
    });

    const peakTier = body.peak_tier || null;
    const peakRank = body.peak_rank || null;
    const peakLp = Number(body.peak_lp) || 0;

    const riotId = String(body.riot_id || '').trim();

    if (!riotId || !riotId.includes('#')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format attendu : Pseudo#TAG',
        },
        { status: 400 }
      );
    }

    const riotIdParts = riotId
      .split('#')
      .map((part) => part.trim());

    if (riotIdParts.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          message: 'Riot ID invalide. Format attendu : Pseudo#TAG',
        },
        { status: 400 }
      );
    }

    const [gameName, tagLine] = riotIdParts;

    if (!gameName || !tagLine) {
      return NextResponse.json(
        {
          success: false,
          message: 'Riot ID incomplet.',
        },
        { status: 400 }
      );
    }

    console.log('RIOT SPLIT:', {
      riot_id: riotId,
      gameName,
      tagLine,
    });

    const accountRes = await fetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
        cache: 'no-store',
      }
    );

    if (!accountRes.ok) {
      const riotError = await accountRes.text();

      console.log('RIOT ACCOUNT ERROR:', {
        status: accountRes.status,
        body: riotError,
      });

      return NextResponse.json(
        {
          success: false,
          message: getRiotErrorMessage(accountRes.status),
          status: accountRes.status,
        },
        { status: accountRes.status }
      );
    }

    const account = await accountRes.json();

    const summonerRes = await fetch(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(
        account.puuid
      )}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
        cache: 'no-store',
      }
    );

    if (!summonerRes.ok) {
      const riotError = await summonerRes.text();

      console.log('RIOT SUMMONER ERROR:', {
        status: summonerRes.status,
        body: riotError,
      });

      return NextResponse.json(
        {
          success: false,
          message: getRiotErrorMessage(summonerRes.status),
          status: summonerRes.status,
        },
        { status: summonerRes.status }
      );
    }

    const summoner = await summonerRes.json();

    const leagueRes = await fetch(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(
        account.puuid
      )}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY,
        },
        cache: 'no-store',
      }
    );

    if (!leagueRes.ok) {
      const riotError = await leagueRes.text();

      console.log('RIOT LEAGUE ERROR:', {
        status: leagueRes.status,
        body: riotError,
      });

      return NextResponse.json(
        {
          success: false,
          message: getRiotErrorMessage(leagueRes.status),
          status: leagueRes.status,
        },
        { status: leagueRes.status }
      );
    }

    const leagues = await leagueRes.json();

    const soloq =
      leagues.find(
        (entry: any) =>
          entry.queueType === 'RANKED_SOLO_5x5'
      ) || null;

    const flex =
      leagues.find(
        (entry: any) =>
          entry.queueType === 'RANKED_FLEX_SR'
      ) || null;

    const topChampions = body.skip_top_champions
      ? null
      : await getTopChampions(account.puuid);

    const currentSoloqPoints = calculateRankPoints(
      soloq?.tier || null,
      soloq?.rank || null,
      soloq?.leaguePoints || 0
    );

    const oldPeakPoints = calculateRankPoints(
      peakTier,
      peakRank,
      peakLp
    );

    let finalPeakTier =
      peakTier || soloq?.tier || null;

    let finalPeakRank =
      peakRank || soloq?.rank || null;

    let finalPeakLp =
      peakTier || peakRank || peakLp
        ? peakLp
        : soloq?.leaguePoints || 0;

    if (currentSoloqPoints > oldPeakPoints) {
      finalPeakTier = soloq?.tier || null;
      finalPeakRank = soloq?.rank || null;
      finalPeakLp = soloq?.leaguePoints || 0;
    }

    const czfPoints = calculateCzfPoints({
      soloqTier: soloq?.tier || null,
      soloqRank: soloq?.rank || null,
      soloqLp: soloq?.leaguePoints || 0,
      wins: soloq?.wins || 0,
      losses: soloq?.losses || 0,

      flexTier: flex?.tier || null,
      flexRank: flex?.rank || null,
      flexLp: flex?.leaguePoints || 0,

      peakTier: finalPeakTier,
      peakRank: finalPeakRank,
      peakLp: finalPeakLp,
    });

    return NextResponse.json({
      success: true,
      data: {
        riot_id: riotId,

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

        peak_tier: finalPeakTier,
        peak_rank: finalPeakRank,
        peak_lp: finalPeakLp,

        top_champions: topChampions,
        czf_points: czfPoints,
      },
    });
  } catch (error: any) {
    console.log('RIOT SERVER ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          'Erreur serveur Riot inconnue.',
      },
      { status: 500 }
    );
  }
}