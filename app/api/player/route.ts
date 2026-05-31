import { NextResponse } from 'next/server';
import { calculateCzfScore } from '@/app/lib/czf-score';

export async function POST(req: Request) {
  const { riotId } = await req.json();
  // V1 scaffold: brancher ici Riot API.
  // 1) split Riot ID en gameName + tagLine
  // 2) account-v1 -> PUUID
  // 3) league-v4 -> rank/LP/WR/games
  // 4) match-v5/champion-mastery-v4 -> most played champs
  // 5) peak elo: à stocker en base ou à récupérer via une source externe si disponible.
  return NextResponse.json({
    status: 'todo',
    message: 'API Riot non branchée dans cette V1 locale.',
    riotId,
    exampleScoreFunctionReady: calculateCzfScore({ tier: 'EMERALD', division: 'II', lp: 60, winrate: 60, games: 80, peakTier: 'DIAMOND', peakDivision: 'IV' })
  });
}
