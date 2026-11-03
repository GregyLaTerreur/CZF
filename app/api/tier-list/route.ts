import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_KEYS, type TierKey, type TierListData } from '@/lib/tierList';

// Tier list des champions d'un joueur (table czf_player_tier_lists, une ligne par joueur).
// GET public ; PUT réservé au joueur connecté, pour sa propre tier list.

const MAX_CHAMPIONS = 250;
// Identifiant Data Dragon d'un champion (ex. « MonkeyKing »).
const CHAMPION_ID = /^[A-Za-z0-9]{2,40}$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const playerId = Number(request.nextUrl.searchParams.get('playerId'));

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return json({ success: false, error: 'Joueur invalide.' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('czf_player_tier_lists')
    .select('tiers, updated_at')
    .eq('player_id', playerId)
    .maybeSingle();

  if (error) {
    console.error('[TIER LIST]', error);
    return json({ success: false, error: 'Impossible de charger la tier list.' }, 500);
  }

  return json({
    success: true,
    tierList: data ? { tiers: normalizeTiers(data.tiers), updatedAt: data.updated_at } : null,
  });
}

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) return json({ success: false, error: 'Connexion requise.' }, 401);

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !auth.user) return json({ success: false, error: 'Session invalide.' }, 401);

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('profile_id', auth.user.id)
    .maybeSingle();

  if (!player) return json({ success: false, error: 'Aucun profil joueur lié à ce compte.' }, 403);

  let tiers: TierListData;

  try {
    tiers = validateTiers((await request.json())?.tiers);
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Tier list invalide.' }, 400);
  }

  const empty = TIER_KEYS.every((key) => tiers[key].length === 0);

  // Tier list vidée : on supprime la ligne, le profil repropose « Faire ma tier list ».
  const { error } = empty
    ? await supabaseAdmin.from('czf_player_tier_lists').delete().eq('player_id', player.id)
    : await supabaseAdmin
        .from('czf_player_tier_lists')
        .upsert({ player_id: player.id, tiers, updated_at: new Date().toISOString() });

  if (error) {
    console.error('[TIER LIST]', error);
    return json({ success: false, error: 'Impossible d’enregistrer la tier list.' }, 500);
  }

  return json({ success: true, tierList: empty ? null : { tiers } });
}

function validateTiers(value: unknown): TierListData {
  if (!value || typeof value !== 'object') throw new Error('Tier list invalide.');

  const seen = new Set<string>();
  const result = {} as TierListData;

  for (const key of TIER_KEYS) {
    const champions = (value as Record<string, unknown>)[key] ?? [];

    if (!Array.isArray(champions)) throw new Error(`Tier ${key} invalide.`);

    result[key] = champions.map((champion) => {
      if (typeof champion !== 'string' || !CHAMPION_ID.test(champion)) {
        throw new Error('Champion invalide.');
      }
      if (seen.has(champion)) throw new Error(`${champion} est placé deux fois.`);

      seen.add(champion);
      return champion;
    });
  }

  if (seen.size > MAX_CHAMPIONS) throw new Error('Trop de champions.');

  return result;
}

// Données en base tolérantes : tiers manquants ou inconnus ignorés.
function normalizeTiers(value: any): TierListData {
  const result = {} as TierListData;

  for (const key of TIER_KEYS as readonly TierKey[]) {
    result[key] = Array.isArray(value?.[key]) ? value[key].filter((id: unknown) => typeof id === 'string') : [];
  }

  return result;
}
