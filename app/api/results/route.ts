import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnyObject = Record<string, any>;

type ResultPlayer = {
  id: string | number | null;
  riotId: string;
  discordName: string | null;
  role: string | null;
  avatar: string | null;
};

type ResultTeam = {
  id: string | number;
  name: string;
  shortName: string;
  logo: string | null;
  division: 'Yordle' | 'Ixtal' | 'Targon' | null;
  wins: number;
  losses: number;
  roster: ResultPlayer[];
};

type Champion = {
  id: string;
  key: string;
  name: string;
  image: string;
};

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;

    /*
      On récupère les données déjà existantes du site.

      Cette route ne recrée PAS les équipes / joueurs :
      elle centralise simplement les API actuelles.
    */

    const [teamsResult, membersResult, playersResult] =
      await Promise.allSettled([
        fetch(`${origin}/api/teams`, {
          cache: 'no-store',
        }),

        fetch(`${origin}/api/team-members`, {
          cache: 'no-store',
        }),

        fetch(`${origin}/api/players`, {
          cache: 'no-store',
        }),
      ]);

    const teamsData =
      await readSettledResponse(teamsResult);

    const membersData =
      await readSettledResponse(membersResult);

    const playersData =
      await readSettledResponse(playersResult);

    const rawTeams = extractArray(
      teamsData,
      [
        'teams',
        'data',
      ]
    );

    const rawMembers = extractArray(
      membersData,
      [
        'members',
        'teamMembers',
        'team_members',
        'data',
      ]
    );

    const rawPlayers = extractArray(
      playersData,
      [
        'players',
        'data',
      ]
    );

    /* =====================================================
       ÉQUIPES VALIDÉES
    ===================================================== */

    const validatedTeams =
      rawTeams.filter(
        (team: AnyObject) =>
          isValidated(team)
      );

    /* =====================================================
       CONSTRUCTION DES ROSTERS
    ===================================================== */

    const resultTeams: ResultTeam[] =
      validatedTeams.map(
        (team: AnyObject) => {
          const teamId =
            getValue(
              team,
              [
                'id',
                'team_id',
                'teamId',
              ]
            );

          const teamMembers =
            rawMembers.filter(
              (
                member: AnyObject
              ) => {
                const memberTeamId =
                  getValue(
                    member,
                    [
                      'team_id',
                      'teamId',
                      'team',
                    ]
                  );

                return (
                  String(
                    memberTeamId
                  ) ===
                  String(teamId)
                );
              }
            );

          const roster =
            teamMembers
              .map(
                (
                  member: AnyObject
                ): ResultPlayer => {
                  const riotId =
                    String(
                      getValue(
                        member,
                        [
                          'riot_id',
                          'riotId',
                          'summoner_name',
                          'summonerName',
                        ]
                      ) ?? ''
                    );

                  const player =
                    findPlayer(
                      rawPlayers,
                      riotId,
                      member
                    );

                  return {
                    id:
                      getValue(
                        player,
                        [
                          'id',
                          'player_id',
                          'playerId',
                        ]
                      ) ??
                      getValue(
                        member,
                        [
                          'player_id',
                          'playerId',
                          'id',
                        ]
                      ) ??
                      null,

                    riotId:
                      riotId ||
                      String(
                        getValue(
                          player,
                          [
                            'riot_id',
                            'riotId',
                            'summoner_name',
                            'summonerName',
                          ]
                        ) ??
                        'Joueur'
                      ),

                    discordName:
                      stringOrNull(
                        getValue(
                          player,
                          [
                            'discord_name',
                            'discordName',
                            'discord_username',
                            'discordUsername',
                            'username',
                          ]
                        )
                      ),

                    role:
                      normalizeRole(
                        getValue(
                          member,
                          [
                            'role',
                            'position',
                          ]
                        ) ??
                        getValue(
                          player,
                          [
                            'role',
                            'position',
                          ]
                        )
                      ),

                    avatar:
                      stringOrNull(
                        getValue(
                          player,
                          [
                            'avatar',
                            'avatar_url',
                            'avatarUrl',
                            'discord_avatar',
                          ]
                        )
                      ),
                  };
                }
              )
              .sort(
                (
                  a: ResultPlayer,
                  b: ResultPlayer
                ) =>
                  roleOrder(
                    a.role
                  ) -
                  roleOrder(
                    b.role
                  )
              );

          return {
            id: teamId,

            name:
              getTeamName(
                team
              ),

            shortName:
              getTeamShortName(
                team
              ),

            logo:
              getTeamLogo(
                team
              ),

            division:
              normalizeDivision(
                getValue(
                  team,
                  [
                    'division',
                    'division_name',
                    'divisionName',
                  ]
                )
              ),

            /*
              Pour l'instant on met 0-0
              tant que le vrai système de games
              CZF n'est pas branché.

              Plus tard ces deux valeurs seront
              calculées à partir des matchs enregistrés.
            */
            wins: 0,
            losses: 0,

            roster,
          };
        }
      );

    /* =====================================================
       CHAMPIONS LEAGUE OF LEGENDS
    ===================================================== */

    const champions =
      await getChampions();

    /* =====================================================
       DIVISIONS
    ===================================================== */

    const divisions = {
      Yordle: resultTeams.filter(
        (team) =>
          team.division ===
          'Yordle'
      ),

      Ixtal: resultTeams.filter(
        (team) =>
          team.division ===
          'Ixtal'
      ),

      Targon: resultTeams.filter(
        (team) =>
          team.division ===
          'Targon'
      ),
    };

    /* =====================================================
       RÉPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        divisions,

        teams: resultTeams,

        champions,

        divisionAssets: {
          Yordle: {
            color:
              '#51a677',

            /*
              Mets ton logo ici plus tard
              si tu as un PNG dédié.
            */
            logo:
              '/assets/divisions/yordle.png',
          },

          Ixtal: {
            color:
              '#4387d8',

            logo:
              '/assets/divisions/ixtal.png',
          },

          Targon: {
            color:
              '#8f6bc7',

            logo:
              '/assets/divisions/targon.png',
          },
        },

        roles: [
          {
            id: 'Top',
            label: 'TOP',
            icon:
              '/assets/roles/top.png',
          },

          {
            id: 'Jungle',
            label: 'JGL',
            icon:
              '/assets/roles/jungle.png',
          },

          {
            id: 'Mid',
            label: 'MID',
            icon:
              '/assets/roles/mid.png',
          },

          {
            id: 'ADC',
            label: 'ADC',
            icon:
              '/assets/roles/adc.png',
          },

          {
            id: 'Support',
            label: 'SUP',
            icon:
              '/assets/roles/sup.png',
          },
        ],

        debug: {
          rawTeams:
            rawTeams.length,

          validatedTeams:
            resultTeams.length,

          members:
            rawMembers.length,

          players:
            rawPlayers.length,

          champions:
            champions.length,

          yordle:
            divisions.Yordle.length,

          ixtal:
            divisions.Ixtal.length,

          targon:
            divisions.Targon.length,
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error(
      '[RESULTS API]',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'Impossible de charger les données de la page Résultats.',

        teams: [],

        champions: [],

        divisions: {
          Yordle: [],
          Ixtal: [],
          Targon: [],
        },
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   CHAMPIONS RIOT / DATA DRAGON
========================================================= */

async function getChampions(): Promise<
  Champion[]
> {
  try {
    /*
      On récupère automatiquement
      la version actuelle de Data Dragon.
    */

    const versionsResponse =
      await fetch(
        'https://ddragon.leagueoflegends.com/api/versions.json',
        {
          next: {
            revalidate: 86400,
          },
        }
      );

    if (
      !versionsResponse.ok
    ) {
      return [];
    }

    const versions =
      await versionsResponse.json();

    const version =
      versions?.[0];

    if (!version) {
      return [];
    }

    const championsResponse =
      await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`,
        {
          next: {
            revalidate: 86400,
          },
        }
      );

    if (
      !championsResponse.ok
    ) {
      return [];
    }

    const championsData =
      await championsResponse.json();

    const championsObject =
      championsData?.data ??
      {};

    return Object.values(
      championsObject
    )
      .map(
        (
          champion: any
        ): Champion => ({
          id:
            champion.id,

          key:
            champion.key,

          name:
            champion.name,

          image:
            `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
        })
      )
      .sort(
        (
          a: Champion,
          b: Champion
        ) =>
          a.name.localeCompare(
            b.name,
            'fr'
          )
      );
  } catch (error) {
    console.error(
      '[RESULTS CHAMPIONS]',
      error
    );

    return [];
  }
}

/* =========================================================
   EXTRACTION DES RÉPONSES API
========================================================= */

async function readSettledResponse(
  result:
    | PromiseSettledResult<Response>
): Promise<any> {
  if (
    result.status !==
    'fulfilled'
  ) {
    return null;
  }

  const response =
    result.value;

  if (!response.ok) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractArray(
  data: any,
  possibleKeys: string[]
): AnyObject[] {
  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    !data ||
    typeof data !==
      'object'
  ) {
    return [];
  }

  for (
    const key
    of possibleKeys
  ) {
    if (
      Array.isArray(
        data[key]
      )
    ) {
      return data[key];
    }
  }

  return [];
}

/* =========================================================
   HELPERS GÉNÉRIQUES
========================================================= */

function getValue(
  object: AnyObject | null | undefined,
  keys: string[]
) {
  if (!object) {
    return undefined;
  }

  for (
    const key
    of keys
  ) {
    if (
      object[key] !==
        undefined &&
      object[key] !==
        null
    ) {
      return object[key];
    }
  }

  return undefined;
}

function stringOrNull(
  value: any
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  return String(value);
}

/* =========================================================
   ÉQUIPE VALIDÉE
========================================================= */

function isValidated(
  team: AnyObject
) {
  const value =
    getValue(
      team,
      [
        'is_validated',
        'isValidated',
        'validated',
      ]
    );

  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    String(value)
      .toLowerCase() ===
      'true'
  );
}

/* =========================================================
   TEAM
========================================================= */

function getTeamName(
  team: AnyObject
) {
  return String(
    getValue(
      team,
      [
        'name',
        'team_name',
        'teamName',
      ]
    ) ??
    'Équipe'
  );
}

function getTeamShortName(
  team: AnyObject
) {
  const existing =
    getValue(
      team,
      [
        'short_name',
        'shortName',
        'tag',
        'acronym',
      ]
    );

  if (existing) {
    return String(
      existing
    ).toUpperCase();
  }

  const name =
    getTeamName(team);

  const words =
    name
      .trim()
      .split(/\s+/);

  if (
    words.length > 1
  ) {
    return words
      .map(
        (word) =>
          word.charAt(0)
      )
      .join('')
      .slice(0, 4)
      .toUpperCase();
  }

  return name
    .slice(0, 4)
    .toUpperCase();
}

function getTeamLogo(
  team: AnyObject
): string | null {
  return stringOrNull(
    getValue(
      team,
      [
        'logo',
        'logo_url',
        'logoUrl',
        'image',
        'image_url',
        'imageUrl',
      ]
    )
  );
}

/* =========================================================
   DIVISION
========================================================= */

function normalizeDivision(
  value: any
):
  | 'Yordle'
  | 'Ixtal'
  | 'Targon'
  | null {
  if (!value) {
    return null;
  }

  const division =
    String(value)
      .trim()
      .toLowerCase();

  if (
    division ===
    'yordle'
  ) {
    return 'Yordle';
  }

  if (
    division ===
    'ixtal'
  ) {
    return 'Ixtal';
  }

  if (
    division ===
    'targon'
  ) {
    return 'Targon';
  }

  return null;
}

/* =========================================================
   JOUEURS
========================================================= */

function normalizeRiotId(
  value: any
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function findPlayer(
  players: AnyObject[],
  riotId: string,
  member: AnyObject
) {
  /*
    1. On essaie d'abord avec player_id.
  */

  const memberPlayerId =
    getValue(
      member,
      [
        'player_id',
        'playerId',
      ]
    );

  if (
    memberPlayerId !==
      undefined &&
    memberPlayerId !== null
  ) {
    const byId =
      players.find(
        (player) =>
          String(
            getValue(
              player,
              [
                'id',
                'player_id',
                'playerId',
              ]
            )
          ) ===
          String(
            memberPlayerId
          )
      );

    if (byId) {
      return byId;
    }
  }

  /*
    2. Sinon avec Riot ID.
  */

  const normalized =
    normalizeRiotId(
      riotId
    );

  if (!normalized) {
    return {};
  }

  return (
    players.find(
      (player) =>
        normalizeRiotId(
          getValue(
            player,
            [
              'riot_id',
              'riotId',
              'summoner_name',
              'summonerName',
            ]
          )
        ) === normalized
    ) ?? {}
  );
}

/* =========================================================
   ROLES
========================================================= */

function normalizeRole(
  value: any
): string | null {
  if (!value) {
    return null;
  }

  const role =
    String(value)
      .trim()
      .toLowerCase();

  if (
    role === 'top' ||
    role === 'toplane'
  ) {
    return 'Top';
  }

  if (
    role === 'jungle' ||
    role === 'jgl' ||
    role === 'jg'
  ) {
    return 'Jungle';
  }

  if (
    role === 'mid' ||
    role === 'middle'
  ) {
    return 'Mid';
  }

  if (
    role === 'adc' ||
    role === 'bot' ||
    role === 'bottom'
  ) {
    return 'ADC';
  }

  if (
    role === 'support' ||
    role === 'sup'
  ) {
    return 'Support';
  }

  return String(value);
}

function roleOrder(
  role: string | null
) {
  switch (role) {
    case 'Top':
      return 0;

    case 'Jungle':
      return 1;

    case 'Mid':
      return 2;

    case 'ADC':
      return 3;

    case 'Support':
      return 4;

    default:
      return 99;
  }
}