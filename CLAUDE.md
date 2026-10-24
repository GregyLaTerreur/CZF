# CZF — Clash des Zéros de la Faille

Site de la ligue communautaire League of Legends CZF (saison 1 / « CZF Édition 1 »).
Next.js (App Router, Turbopack) + Supabase (Postgres, Auth Discord) + API Riot. Déployé sur Vercel.
Tout le produit est en **français** : UI, messages d'erreur, commentaires, messages de commit.

> Le `README.md` est obsolète (il dit que Supabase et Riot ne sont pas branchés) : se fier à ce fichier.

## Règles à respecter

> **IMPORTANT — JAMAIS D'EMOJI. QUE DES SVG.**
> Aucun emoji nulle part : UI, textes, boutons, titres, CSS (`content: …`), messages d'erreur, commentaires. Pas de ✅ ⏳ 🎉 🚀, ni de symboles décoratifs (→ ★ ✓…) à la place d'une icône. Chaque icône est un SVG (voir ci-dessous). Toute page touchée qui contient encore des emoji doit en ressortir sans.

- **Design system obligatoire** : avant toute refonte ou tout ajout d'interface, lire `design-system_czf.html` (racine du repo) et l'appliquer : couleurs, typo, boutons, ombres, onglets, cartes. Voir la section « Styles & design system » plus bas.
- **Pas d'emoji**, ni dans l'UI, ni dans le CSS (`content: …`), ni dans les textes. Toute icône est un **SVG** : composant dans `app/components/icons/` (ex. `BoltIcon.tsx`) ou fichier dans `public/assets/`. Le design system montre un éclair emoji comme séparateur de bandeau : utiliser `BoltIcon` à la place. Les anciennes pages contiennent encore des emoji (médailles, fusée…) : les remplacer par des SVG quand on y touche.
- **Commentaires simples et courts** : une ligne qui dit le *pourquoi*, pas de pavé ni de commentaire qui répète le code.

## Commandes

```bash
npm install
npm run dev        # next dev (port 3000, ou le suivant s'il est pris)
npm run build
npx tsc --noEmit   # pas de tests automatisés dans le repo ; c'est la vérification minimale
```

`package.json` utilise `"latest"` pour next/react/typescript : `npm install` peut monter de version et modifier `package-lock.json`. Ne pas committer un lockfile modifié sans le signaler.

## Environnement (`.env.local`, jamais commité — `.gitignore` couvre `.env*`)

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client navigateur (`lib/supabase.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | client serveur qui contourne la RLS (`lib/supabaseAdmin.ts`) |
| `NEXT_PUBLIC_SITE_URL` | appels internes serveur → `/api/riot/player` |
| `RIOT_API_KEY` | API Riot (EUW1 / europe) |
| `RIOT_CALLBACK_SECRET` | authentifie les callbacks de tournoi Riot |
| `CRON_SECRET` | protège les routes cron / traitement Riot |
| `CZF_ENABLE_RIOT_CRON` | `true` uniquement en PROD ; sinon `/api/cron/sync-riot-ids` répond 403 |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | vérifie qu'un joueur est sur le serveur Discord avant de créer son profil |
| `CZF_SKIP_DISCORD_CHECK` | `true` en local seulement, sans le vrai bot : saute cette vérification (ignoré si `NODE_ENV=production`) |

`lib/supabase.ts` crée le client au chargement : sans URL Supabase valide, tout le site plante.

## Environnements & branches

- Remote : `github.com/GregyLaTerreur/CZF`. Branches `main` (PROD) et `dev` (DEV), chacune déployée sur Vercel avec sa propre base Supabase. Mainteneur principal : GregyLaTerreur (Grégoire).
- Base PROD Supabase : projet `ikxstcmjagiiwxijkgaj`.
- Le cron Vercel (`vercel.json`) appelle `/api/cron/sync-riot-ids` chaque jour à 4h.
- Le **schéma SQL n'est pas versionné** : tables, vues, fonctions et policies ont été créées à la main dans Supabase. Toute évolution de schéma doit être donnée comme SQL à exécuter à la main (et signalée pour DEV *et* PROD).

## Domaine métier

- **Joueur** (`players`) : Riot ID `Pseudo#TAG`, rôle principal/secondaire, rangs soloq/flex/peak synchronisés depuis Riot, `czf_points`. Lié à un compte via `profile_id` → `profiles.id` (= `auth.users.id`, connexion Discord uniquement).
- **Points CZF d'un joueur** : calculés dans `app/api/riot/player/route.ts` (`calculateCzfPoints` : points de rang soloq + bonus winrate si ≥ 30 games + bonus peak + bonus flex). `lib/czf-score.ts` est une **ancienne formule non utilisée**.
- **Équipe** (`teams` + `team_members`) : capitaine + membres avec rôle. La division est attribuée **à l'équipe** selon la somme des points des joueurs : Targon ≥ 6101, Ixtal ≥ 3901, sinon Yordle (`getDivisionFromPoints` dans `app/admin/page.tsx`). Un admin valide l'équipe (`validated_by_admin`, `validated_points`, `division`). Seules les équipes validées apparaissent dans les résultats/stats.
- **Saison** (`czf_seasons`, une seule `active`) → `czf_season_teams` (équipe + division pour la saison).
- **Rencontre planifiée** (`czf_fixtures`) : poules = BO2 obligatoire (1-1 possible → pas de vainqueur), playoffs = BO3/BO5 avec bracket `winner|loser|grand_final`.
- **Match joué** (`czf_matches`) → `czf_games` → `czf_game_player_stats` (une ligne par joueur officiel et par game). Les remplaçants (subs) ne vont **que** dans `czf_games.substitute_stats` et ne comptent pas dans les stats.
- **MVP** : un par match/BO (`czf_matches.mvp_player_id`). Le capitaine propose (`czf_mvp_proposals`), un admin approuve ou corrige (`/api/mvp`).
- **Divisions** : Targon (élite), Ixtal (intermédiaire), Yordle (développement). Valeurs littérales `'Targon' | 'Ixtal' | 'Yordle'` partout (contraintes CHECK en base).
- **Rôles** : `'Top' | 'Jungle' | 'Mid' | 'ADC' | 'Support'` (CHECK en base), affichés TOP/JGL/MID/ADC/SUP.

### Pipeline des matchs Riot (codes de tournoi)

1. Le capitaine prépare les slots de games d'une rencontre depuis `/my-team` (`/api/my-fixtures/games`) → `czf_tournament_game_slots` (un slot par game, avec `tournament_code`). D'après le code, aucun code n'est encore exposé aux joueurs tant que le système Riot n'est pas opérationnel.
2. Riot appelle `/api/riot/callback` en fin de partie → `czf_riot_callbacks` (brut, pour audit) ; le slot passe en traitement.
3. `/api/riot/process-matches` (protégé par `CRON_SECRET`) télécharge la partie → `czf_riot_match_imports`.
4. `/api/riot/validate-rosters` compare les joueurs Riot (par **PUUID**, pas par pseudo) au roster CZF → `czf_riot_roster_validations` (`verified` ou `pending_review`).
5. Un admin revoit (`/admin/riot`, `/api/admin/riot-review`) puis publie (`/api/admin/riot-publish`) via la fonction SQL **`czf_publish_riot_bo`**, qui crée le match, les games et les stats dans une seule transaction.

Les résultats peuvent aussi être saisis à la main par un admin (`/admin/results`, `/api/admin/results`).

## Architecture du code

- `app/<page>/page.tsx` : pages, presque toutes des composants client (`'use client'`) très longs et autonomes (`results` ~3700 l, `admin/results` ~3400 l, `my-team` ~2200 l). Elles appellent les routes `/api/*` avec `fetch` ; certaines lisent Supabase directement avec la clé anon.
- `app/api/**/route.ts` : route handlers. Les routes protégées lisent `Authorization: Bearer <access_token>` (envoyé par le front via `supabase.auth.getSession()`), vérifient l'utilisateur avec `supabaseAdmin.auth.getUser(token)`, puis `profiles.is_admin` pour l'admin.
- **Données publiques** : routes dédiées, toutes filtrables par `?division=` : `/api/classement` (classement des poules), `/api/historique` (liste des BO sans détail, `?limit=`), `/api/historique/[id]` (games d'un BO, chargées à l'ouverture), `/api/stats-joueurs` (stats par rôle, vue `czf_current_player_stats` + exclusions), `/api/stats-champions`. La homepage et `/results` n'utilisent qu'elles.
- Les calculs sont dans `lib/results/core.ts` (fonctions pures) et les requêtes dans `lib/results/load.ts` (`fetchAll` gère la limite de 1000 lignes de Supabase, `fetchByIds` découpe les filtres `in`). Toute règle de classement ou de stats se modifie là.
- `app/api/results/route.ts` : réponse complète historique (≈ 1 Mo), réutilise `lib/results/core.ts`. Encore utilisée par `/admin/results` pour les équipes avec roster et la liste des champions.
- `lib/riot/build-czf-game.ts`, `lib/riot/build-czf-bo.ts` : transforment une partie Riot en game CZF / calculent le score d'un BO.
- `app/components/Nav.tsx` : navigation commune (client ; affiche « Admin » si `is_admin`).
- `lib/data.ts` : vestiges de la V1 (tableaux vides), ne pas s'en servir.
- `app/test/page.tsx` (dump de `players`) et `app/calendar` / `app/hall-of-fame` (pages vides) sont des brouillons.

### Vues et fonctions SQL (hors repo)

- `czf_current_player_stats` : vue sur `czf_game_player_stats` limitée aux joueurs encore dans la même équipe, au même rôle, dans une équipe validée.
- `active_tournament_players` : vue (non utilisée par le code).
- `czf_publish_riot_bo(p_fixture_id, p_games jsonb, p_bracket, p_round)` : publication atomique d'un BO Riot.

## Styles & design system

- `app/globals.css` (~5000 lignes) : ancienne DA (police Anton, cream/navy, éclairs). Elle cible des **ids** (`#divisions`, `#resultats`, `#equipes`, `#discord`, `#compte`, `#hall-of-fame`, `#rulebook`) et le sélecteur `button` (`:hover`/`:active` avec `transform`). Ne pas réutiliser ces ids dans un nouveau composant, et prévoir des règles `:hover`/`:active` explicites sur les boutons qui ont leur propre `transform`.
- **Design system actuel** : `design-system_czf.html` à la racine (document de référence, à ne pas exposer en front). Il est appliqué sur la homepage (`app/page.tsx`, `app/home.module.css`, `app/components/home/*`) :
  - couleurs : cream `#F4E2C9`, beige `#D4B896`, dark `#081428`, darker `#040C18`, orange `#F05010` (accents, CTA), teal `#00C9A0` (Ixtal, positif), on-dark `#E0D8CC`, victoire `#2AAB5F`, défaite `#E05050` ; Targon `#8B9FD4`, Yordle `#51A677` ;
  - polices : Barlow Condensed 700/800 italique pour les titres et l'UI, Barlow pour le texte (via `next/font`) ;
  - éléments interactifs en `skewX(-8deg)` avec ombre `6px 6px` ; hover/press → ombre `2px 2px` + `translate(4px, 4px)` ;
  - règle des ombres : fond clair → ombre dark, fond sombre → ombre orange ;
  - onglets : inactif = cream + ombre dark, actif = dark + ombre orange ;
  - séparations beige/dark en diagonale (`clip-path`), bandeau orange en `skewY(-1deg)`.
- Pour une nouvelle page au design system : CSS Module dédié (comme `home.module.css`), sans toucher à `globals.css`.
- Une constante exportée d'un module `'use client'` vaut `undefined` côté composant serveur : mettre les constantes partagées dans un module sans directive (ex. `app/components/home/divisions.ts`).
- Les logos d'équipe sont des URLs externes (imgur, noelshack…) : utiliser `<img>` (pas `next/image`, `images.unoptimized: true`).

## Pièges connus

- `/api/historique` et `/api/results` peuvent renvoyer `team1`/`team2` à `null` quand une équipe n'est plus validée : toujours gérer ce cas.
- En poules (BO2), `winner` peut être `null` (match nul 1-1).
- Les compteurs `mvp` de `/api/stats-joueurs` ne comptent que les joueurs encore dans leur roster (vue `czf_current_player_stats`), donc leur total peut être inférieur au nombre de matchs.
- **Sécurité, existant à ne pas aggraver** : plusieurs routes modifient les données **sans authentification**, avec le client anon (`/api/teams` POST/PATCH, `/api/teams/delete`, `/api/admin/validate-team`, `/api/team-members`, `/api/team-join-requests`, `/api/players/riot-refresh`, `/api/players/champions-refresh`, `/api/riot/player`). Les policies RLS de `teams`, `team_members`, `team_join_requests` et `players` sont ouvertes à `anon`, et `profiles` accepte n'importe quel INSERT (dont `is_admin`). Toute nouvelle route d'écriture doit vérifier le token et utiliser `supabaseAdmin`, comme `/api/mvp` ou `/api/admin/riot-publish`.
- En prod, `service_role` n'a pas le droit `SELECT` sur `team_join_requests`.
