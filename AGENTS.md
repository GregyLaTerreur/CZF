# AGENTS.md — CZF (Clash des Zéros de la Faille)

Instructions pour les agents de code (Codex / ChatGPT et autres) travaillant sur ce dépôt.

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
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | compte Cloudinary des images (`lib/assets.ts`) ; facultatif, `dn70nvtqk` par défaut |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | uniquement pour `npm run assets:upload` (pas besoin sur Vercel) |
| `CZF_SKIP_DISCORD_CHECK` | `true` en local seulement, sans le vrai bot : saute cette vérification (ignoré si `NODE_ENV=production`) |

`lib/supabase.ts` crée le client au chargement : sans URL Supabase valide, tout le site plante.

## Environnements & branches

- Remote : `github.com/GregyLaTerreur/CZF`. Branches `main` (PROD) et `dev` (DEV), chacune déployée sur Vercel avec sa propre base Supabase. Mainteneur principal : GregyLaTerreur (Grégoire).
- Base PROD Supabase : projet `ikxstcmjagiiwxijkgaj`.
- Branche `secret_project` : le TCG (voir la section dédiée), déployé en PROD en bêta (visible seulement des profils `is_betatest`).
- Le cron Vercel (`vercel.json`) appelle `/api/cron/sync-riot-ids` chaque jour à 4h.
- Le **schéma SQL n'est pas versionné** : tables, vues, fonctions et policies ont été créées à la main dans Supabase. Toute évolution de schéma doit être donnée comme SQL à exécuter à la main (et signalée pour DEV *et* PROD).

## Domaine métier

- **Joueur** (`players`) : Riot ID `Pseudo#TAG`, rôle principal/secondaire, rangs soloq/flex/peak synchronisés depuis Riot, `czf_points`. Lié à un compte via `profile_id` → `profiles.id` (= `auth.users.id`, connexion Discord uniquement).
- **Points CZF d'un joueur** : calculés dans `app/api/riot/player/route.ts` (`calculateCzfPoints` : points de rang soloq + bonus winrate si ≥ 30 games + bonus peak + bonus flex). `lib/czf-score.ts` est une **ancienne formule non utilisée**.
- **Équipe** (`teams` + `team_members`) : capitaine + membres avec rôle. La division est attribuée **à l'équipe** selon la somme des points des joueurs : Targon ≥ 6101, Ixtal ≥ 3901, sinon Yordle (`divisionFromPoints` dans `app/components/ds/lol.ts`). Un admin valide l'équipe (`validated_by_admin`, `validated_points`, `division`). Seules les équipes validées apparaissent dans les résultats/stats.
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
- **API collaborateurs** (`app/api/ext/*`, publique, GET seulement, CORS ouvert, helpers dans `lib/ext/games.ts`) : `/api/ext/matches` (BO → games → joueurs avec dégâts, vision, KP% ; `?id_team=`, `?team=`) et `/api/ext/joueurs` (stats agrégées par joueur : KDA, KP, DPM, vision/min… ; `?id_player=`, `?riot_id=`). Les deux acceptent `?division=`.
- `app/api/results/route.ts` : réponse complète historique (≈ 1 Mo), réutilise `lib/results/core.ts`. Encore utilisée par `/admin/results` pour les équipes avec roster et la liste des champions.
- `lib/riot/build-czf-game.ts`, `lib/riot/build-czf-bo.ts` : transforment une partie Riot en game CZF / calculent le score d'un BO.
- `app/components/Nav.tsx` : navigation commune (client ; affiche « Admin » si `is_admin`).
- `lib/data.ts` : vestiges de la V1 (tableaux vides), ne pas s'en servir.
- `app/test/page.tsx` (dump de `players`) et `app/calendar` / `app/hall-of-fame` (pages vides) sont des brouillons.

### Vues et fonctions SQL (hors repo)

- `czf_current_player_stats` : vue sur `czf_game_player_stats` limitée aux joueurs encore dans la même équipe, au même rôle, dans une équipe validée.
- `active_tournament_players` : vue (non utilisée par le code).
- `czf_publish_riot_bo(p_fixture_id, p_games jsonb, p_bracket, p_round)` : publication atomique d'un BO Riot.
- `czf_tcg_open_booster`, `czf_tcg_give_boosters` : ouverture et distribution des boosters TCG (voir la section TCG).

## TCG (cartes à collectionner) — branche `secret_project`, en bêta

Statut : **bêta**. Tout le TCG (page `/collection`, lien « Collection » du header, bouton « Voir sa collection » du profil, « Gérer le TCG » de l'admin, routes `/api/tcg/*` et `/api/admin/tcg/*`) n'est accessible qu'aux profils **`profiles.is_betatest = true`** (SQL `~/www/czf-import/beta-1-profiles-is-betatest.sql`, même garde-fou que `is_admin` : impossible de se l'attribuer depuis le navigateur). Côté serveur : `requireTcgBeta` / `requireTcgPlayer` / `requireTcgAdmin` (`lib/tcg/access.ts`) ; côté navigateur, `useIsBetaTester` (`app/components/beta.ts`) ne fait qu'afficher ou cacher. `is_betatest` est toujours lu dans une requête séparée de `is_admin`, pour qu'une colonne absente ne ferme que le TCG. Les visuels `_dev` sont provisoires (mention « Bêta » affichée).

- **Cartes** (`czf_tcg_cards`) créées à la main par un admin dans `/admin/tcg` (bouton « Gérer le TCG » sur `/admin`). Trois types : `joueur` (équipe, logo, rôle, division, stats, **pas de note**), `mvp` (pareil **avec** la note 0–99), `simple` (juste le nom et le personnage). Quatre raretés : `commune | rare | epique | legendaire`, **imposées par le type** (`TYPE_RARITIES`, contrainte SQL `czf_tcg_cards_type_rarity`) : joueur = toujours commune, MVP = rare ou épique (légendaire sur décision de l'admin, pour l'instant Greg et Mousstiiic), simple = toutes raretés. **Plus la carte est rare, plus l'artwork prend de place et moins il y a de texte** (légendaire = full art, stats au survol).
- **Joueur lié** : une carte peut être liée à un joueur (`player_id` → `players`). Dans le formulaire admin, « Lier un joueur » pré-remplit pseudo, équipe, logo, rôle, division, champion principal (`/api/admin/tcg/players`) et les stats CZF (`/api/ext/joueurs?id_player=`) ; tout reste modifiable. **Stats : en direct pour les cartes Joueur liées** (`withLiveStats` dans `lib/tcg/liveStats.ts`, appliqué par `/api/tcg/me`, `/api/tcg/open` et `/api/admin/tcg`, mêmes formules que `/api/ext/joueurs`), **figées pour les MVP et les cartes simples**.
- **Numérotation** : chaque carte affiche « n° / total » de sa saison (en haut à droite). Tant que la saison n'est pas figée, c'est calculé : communes, rares, épiques, légendaires (les plus rares ont les plus grands numéros), puis par création ; total = nombre de cartes. Le bouton admin **« Figer les numéros »** (`/api/admin/tcg/freeze` → fonction SQL `czf_tcg_freeze_numbers`) enregistre `czf_tcg_cards.number` et le total dans `czf_tcg_numbering` ; il ne se clique qu'une fois (débloquer = supprimer la ligne en base, cf. `~/www/czf-import/tcg-8-numero-fige.sql`), sauf pour les admins qui ont le droit `tcg.refiger_numeros` : pour eux, « Refiger les numéros » recalcule et refige la saison. Ensuite, une carte ajoutée prend le numéro suivant via trigger (91/90, voulu). Code : `withNumbers` (`lib/tcg/liveStats.ts`), qui retombe sur le calcul si le SQL tcg-8 manque. La collection est triée par numéro croissant ; l'admin, par rareté (plus rares d'abord) puis numéro.
- **Accès** (`lib/tcg/access.ts`) : parmi les bêta-testeurs, boosters et cartes réservés aux profils liés à un joueur avec Riot ID (`requireTcgPlayer` sur `/api/tcg/open`, `/api/tcg/me` ne renvoie que le catalogue sinon, distribution admin filtrée par `eligibleProfiles`, classement aussi). Un bêta-testeur sans Riot voit la collection globale (tout grisé), le classement et les collections des autres, avec un bandeau vers `/onboarding` ; un non bêta-testeur voit seulement « réservé aux bêta-testeurs ».
- **Collections des autres + classement** : `/collection?profil=<uuid>` affiche la collection d'un autre joueur en lecture seule (sans ses boosters) ; bouton « Voir sa collection » / « Ma collection » sur la page profil. L'entrée « Classement » de la sidebar affiche le classement des collectionneurs (cartes différentes, puis boosters acquis = ouvertures + non ouverts ; une ouverture = un `obtained_at` distinct, les cartes d'un booster étant insérées dans la même transaction). Le classement montre l'avatar Discord (lu dans les métadonnées des comptes via `supabaseAdmin.auth.admin.listUsers`, gardé 10 min en mémoire ; initiale du pseudo à défaut), un anneau et une barre de complétion, ta place épinglée, et filtre Tous / Mon équipe / Ma division + recherche. Code : `lib/tcg/collection.ts`, API `/api/tcg/collection/[profileId]` et `/api/tcg/leaderboard` (lecture seule, bêta-testeurs connectés).
- **Cadrage de l'illustration** : `art_x` / `art_y` (point gardé au centre, en %, comme `object-position`) et `art_zoom` (1 à 3) sur chaque carte (SQL `~/www/czf-import/tcg-10-cadrage-illustration.sql`, **requis** par le code : le formulaire les envoie). Réglés dans l'aperçu du formulaire admin en faisant glisser l'illustration + curseur de zoom, bouton « Recentrer » ; défaut 50 / 18 / 1 (cadrage automatique d'avant). **Cadrage partagé** (SQL `~/www/czf-import/tcg-12-cadrage-partage.sql`, facultatif : sans lui, chaque carte garde le sien) : `czf_tcg_art_framing` retient le cadrage par champion + skin + rareté (la zone d'illustration change selon la rareté) ; enregistrer une carte l'applique aux autres cartes de la même clé sans `art_url` (`shareFraming`, `lib/tcg/framing.ts`), et le formulaire le reprend dès qu'on choisit ce perso / skin / rareté.
- **Champion et skin choisis par le joueur** (SQL `~/www/czf-import/tcg-11-choix-skin-lancement.sql`) : chaque joueur choisit le champion et le skin de sa carte **par saison** (`czf_tcg_player_choices`, bloc « Ma carte TCG » de son profil, API `/api/tcg/my-choice`). Sans choix : son champion le plus maîtrisé (`players.top_champions[0]`, Riot trie par points de maîtrise), skin de base. « Lier un joueur » dans l'admin pré-remplit champion + skin avec ce choix (ou ce défaut) ; la carte retient le skin (`czf_tcg_cards.skin_num`, illustration `<Champion>_<skin>.jpg`). Le bouton admin **« Lancer la collection Sx »** (`/api/admin/tcg/launch` → `czf_tcg_launch_season`) fige les numéros s'ils ne le sont pas, enregistre le champion par défaut des joueurs sans choix, puis verrouille les choix (trigger `SAISON_LANCEE`) ; une seule fois, débloquer en base (`czf_tcg_season_launch`). Il remplace « Figer les numéros » ; « Refiger les numéros » reste pour le droit `tcg.refiger_numeros`.
- **Saison** : chaque carte et chaque booster a un `season_id` (→ `czf_seasons`, obligatoire). Sans choix explicite, l'API prend la saison active (`resolveSeasonId` dans `lib/tcg/seasons.ts`). **Un booster ne tire que des cartes de sa saison.** Filtre Saison dans l'admin et la collection (affiché dès qu'il y a plusieurs saisons).
- **Boosters** (`czf_tcg_boosters`) : nom, type de cartes (`tout` par défaut, ou `joueur | mvp | simple`), cartes par booster (1–100), chances par rareté en % (**total = 100**, contrainte SQL), illustration, actif. L'admin les distribue depuis une pop-in (`GiveBoostersModal`) : plusieurs joueurs cochés, une équipe entière (membres liés à un compte), ou tout le monde.
- **Possession** : chaque profil commence à **0 carte**. `czf_tcg_user_boosters` (profil + booster → quantité non ouverte) et `czf_tcg_user_cards` (une ligne par carte tirée, les doublons comptent). Suppression d'une carte → elle disparaît des collections (cascade) ; d'un booster → les non ouverts disparaissent, les cartes tirées restent (`booster_id` à null).
- **Fonctions SQL** (`security definer`, exécutables seulement par `service_role`) : `czf_tcg_open_booster(p_profile_id, p_booster_id)` retire 1 booster et tire les cartes dans la même transaction (rareté selon les %, puis carte au hasard du type ; s'il n'existe aucune carte de la rareté tirée, carte au hasard du type) ; `czf_tcg_give_boosters(p_booster_id, p_quantity, p_profile_ids uuid[] | null)` (null = tous les profils).
- **Mise en prod du TCG** : passer d'abord en PROD `saison-1-matchs.sql` (**obligatoire avant le déploiement** : `MATCH_COLUMNS` lit `season_id`), puis `tcg-1-cartes.sql`, `tcg-2-boosters.sql`, `tcg-6-saisons.sql`, `tcg-7-carte-joueur.sql` (tcg-3/4/5 sont des correctifs déjà inclus dans tcg-1/2, sans effet sur une base neuve) et `beta-1-profiles-is-betatest.sql`, puis mettre les bêta-testeurs (`update profiles set is_betatest = true …`). Les assets `_dev` sont déjà sur le Cloudinary utilisé en prod.
- **SQL hors repo**, à exécuter à la main dans l'ordre : `~/www/czf-import/tcg-1-cartes.sql`, `tcg-2-boosters.sql`, `tcg-3-distribution-multi.sql` (correctif si `tcg-2` a été lancé avec l'ancienne signature à un seul profil), `tcg-4-raretes-par-type.sql` (contrainte type/rareté, si `tcg-1` a été lancé avant le 14/11), `tcg-5-cartes-par-booster.sql` (plus de limite à 10 cartes par booster), `tcg-6-saisons.sql` (colonne `season_id` + tirage limité à la saison du booster ; **requis** par le code actuel), `tcg-7-carte-joueur.sql` (colonne `player_id` ; **requis**), `tcg-8-numero-fige.sql` (numéro figé), `tcg-9-correctif-numero.sql` (correctif : le trigger de tcg-8 vidait les numéros écrits par « Figer »), `tcg-10-cadrage-illustration.sql` (cadrage, **requis**), `tcg-11-choix-skin-lancement.sql` (choix champion/skin + lancement, **requis**). SQL lancé par moi via `~/www/czf-import/run-sql.mjs` (jeton Supabase dans `.env.db`). Les catalogues sont en lecture publique ; les tables `czf_tcg_user_*` et les fonctions ne sont accessibles qu'au serveur.
- **Code** : `lib/tcg/cards.ts` (types, `LAYOUTS` par rareté sur le gabarit 1500×2100, `TYPE_FIELDS`, `parseCardInput`), `lib/tcg/boosters.ts` (`parseBoosterInput`, `boosterSqlError`), `app/components/tcg/PlayerCard.tsx` (rendu d'une carte), `app/components/tcg/CardFilters.tsx` (filtres en cascade rareté + division → équipe → joueur, pages de 24, partagés par l'admin et la collection), `app/admin/tcg/*`, `app/collection/*`. API : `/api/admin/tcg` et `/api/admin/tcg/[id]` (cartes), `/api/admin/tcg/boosters`, `/[id]`, `/give` (admin), `/api/tcg/me` (collection du joueur connecté), `/api/tcg/open` (ouverture, limitée à 20/min).
- **Images** : tous les assets de test sur Cloudinary portent le suffixe **`_dev`** (utilisés seulement en dev) : `czf/cards/s1/cadres/{commune,rare,epique,legendaire}_dev`, `czf/cards/s1/divisions/{targon,ixtal,yordle}_dev`, `czf/cards/s1/boosters/booster_dev`. Le suffixe est défini une seule fois (`ASSET_SUFFIX` dans `lib/tcg/cards.ts`). **Cadres officiels de la graphiste** : sans suffixe, nommés par `LAYOUTS[rareté].frame` (commune : `czf/cards/s1/cadres/commune`, reçu le 17/11 en 750×1051, agrandi en 1500×2100 ; original dans `~/www/czf-tcg/graphiste/`). Sur ce cadre : illustration jusqu'à y = 1280, rond du haut = rôle (ou note MVP), 5 ronds du bas = stats dans l'ordre `STAT_CIRCLE_ORDER` (KDA au centre, dans le grand rond), pseudo et équipe dans la bande sombre, logos sur la ligne du pseudo ; positions mesurées sur son fichier. Cadres reçus le 25/11 (750×1051, agrandis ; fichiers d'origine dans `~/www/czf-tcg/graphiste/recus-2026-11-25/`) : **rare** (`cadres/rare`, illustration jusqu'à 1712, bande beige → texte sombre `ink: 'dark'`, pas de stats ; rond du haut = « STAFF » pour le type `staff`, sinon la note), **épique** (`cadres/epique`, pleine illustration fondue, note dans le grand rond — `DEFAULT_NOTE` 99 tant qu'elle est vide —, rôle dans le petit `roleCircle`, 5 stats en arc avec `y` / `labelY` par rond, vernis holographique : arc-en-ciel masqué par `cards/s1/effets/vernis_epique_masque` (le vernis de la graphiste converti en masque), en `color-dodge`, qui suit la souris), **épique événement** (`cadres/epique_evenement`, pour les cartes simples via `frameByType`, sans stats). Type de carte **`staff`** (toujours Rare, SQL `~/www/czf-import/tcg-13-type-staff.sql`, **requis en PROD avant le déploiement**), pas de booster dédié. La légendaire garde son cadre `_dev`. Sur les cadres de la graphiste, logo d'équipe et division sont des **badges empilés en haut à droite de l'illustration** (`badges`), le pseudo a toute la largeur et rétrécit s'il est long (`NAME_MAX_WIDTH`), le numéro de la carte est **en bas à droite**. La commune prend la **grande illustration** Riot (`splash`, 1215×717, `artSource` dans `LAYOUTS`) : l'image verticale (308×560) était floue dans la zone presque carrée. Les PNG de cadre ne contiennent que la bordure et l'habillage du bas : l'onglet note/rôle et la pilule des stats sont en CSS car ils dépendent du type. `LAYOUTS` doit rester aligné sur les PNG. Les générateurs des visuels provisoires sont hors repo, dans `~/www/czf-tcg` (`gen.mjs`, `gen-booster.mjs`). L'artwork par défaut est le *loading art* Data Dragon (308×560, basse définition) ; `art_url` (Cloudinary) permet une illustration perso.
- **Saison des stats** : `czf_matches.season_id` (SQL `~/www/czf-import/saison-1-matchs.sql`, sans risque pour la PROD actuelle : colonne facultative, remplie par un trigger avec la saison de la rencontre ou la saison active). `MATCH_COLUMNS` (`lib/results/load.ts`) lit cette colonne sur `secret_project` : **ce SQL doit être passé sur une base avant d'y faire tourner ce code**, sinon toutes les pages de résultats tombent. Les stats en direct d'une carte ne comptent que les matchs de la saison de la carte ; les stats du site ne filtrent pas encore par saison.
- **À décider** : calcul de la note, choix des stats, illustrations définitives, façon dont les joueurs gagnent des boosters.

## Styles & design system

- `app/globals.css` (~5000 lignes) : ancienne DA (police Anton, cream/navy, éclairs). Elle cible des **ids** (`#divisions`, `#resultats`, `#equipes`, `#discord`, `#compte`, `#hall-of-fame`, `#rulebook`) et le sélecteur `button` (`:hover`/`:active` avec `transform`). Ne pas réutiliser ces ids dans un nouveau composant, et prévoir des règles `:hover`/`:active` explicites sur les boutons qui ont leur propre `transform`.
- **Design system actuel** : `design-system_czf.html` à la racine (document de référence, à ne pas exposer en front). Il est appliqué sur la homepage (`app/page.tsx`, `app/home.module.css`, `app/components/home/*`) :
  - couleurs : cream `#F4E2C9`, beige `#D4B896`, dark `#081428`, darker `#040C18`, orange `#F05010` (accents, CTA), teal `#00C9A0` (Ixtal, positif), on-dark `#E0D8CC`, victoire `#2AAB5F`, défaite `#E05050` ; Targon `#8B9FD4`, Yordle `#51A677` ;
  - polices : Barlow Condensed 700/800 italique pour les titres et l'UI, Barlow pour le texte (via `next/font`) ;
  - éléments interactifs en `skewX(-8deg)` avec ombre `6px 6px` ; hover/press → ombre `2px 2px` + `translate(4px, 4px)` ;
  - règle des ombres : fond clair → ombre dark, fond sombre → ombre orange ;
  - onglets : inactif = cream + ombre dark, actif = dark + ombre orange ;
  - interrupteur : composant `app/components/ds/Switch.tsx` (styles `ds.switch*`), éteint = case cream + ombre dark, allumé = case dark + ombre orange et curseur orange ; utilisé pour la tier list (« Publique ») et la collection (« Non possédées ») ;
  - séparations beige/dark en diagonale (`clip-path`), bandeau orange en `skewY(-1deg)`.
- Pour une nouvelle page au design system : CSS Module dédié (comme `home.module.css`), sans toucher à `globals.css`.
- Une constante exportée d'un module `'use client'` vaut `undefined` côté composant serveur : mettre les constantes partagées dans un module sans directive (ex. `app/components/home/divisions.ts`).
- **Images du site** : sur Cloudinary (`czf/…`), **plus dans le repo** (`public/` ne garde que `riot.txt`, vérification Riot). Dans le code, toujours `asset('/assets/…')` de `lib/assets.ts` (le chemin est un nom logique → `czf/…` en `f_auto,q_auto`) ; dans le CSS, les variables `--asset-…` de `CSS_ASSETS` (injectées par `app/layout.tsx`). Images hors site (ex. cartes TCG) : `cdnImage('cards/s1/<nom>')`. Envoi / remplacement : `npm run assets:upload -- <dossier> [cible]` (ex. `~/Images/cartes-s1 cards/s1` → `czf/cards/s1/…`). Les originaux restent dans l'historique git (avant suppression de `public/assets`).
- Les logos d'équipe sont des URLs externes (imgur, noelshack…) : utiliser `<img>` (pas `next/image`, `images.unoptimized: true`).

## Pièges connus

- `/api/historique` et `/api/results` peuvent renvoyer `team1`/`team2` à `null` quand une équipe n'est plus validée : toujours gérer ce cas.
- En poules (BO2), `winner` peut être `null` (match nul 1-1).
- Les compteurs `mvp` de `/api/stats-joueurs` ne comptent que les joueurs encore dans leur roster (vue `czf_current_player_stats`), donc leur total peut être inférieur au nombre de matchs.
- **Droits d'admin nommés** : table `admin_grants` (profil + nom de droit, ex. `tcg.refiger_numeros` ; SQL `~/www/czf-import/admin-1-grants.sql`), pour tout le site. `is_admin` reste l'accès général à l'admin ; un droit ouvre une action sensible précise. Liste des droits connus et helpers `hasGrant` / `requireGrant` dans `lib/grants.ts` ; chacun ne lit que ses propres droits. Seuls les **superadmins** (`profiles.is_superadmin`, SQL `~/www/czf-import/admin-2-superadmin.sql`, protégé comme `is_admin`, `requireSuperAdmin`) les gèrent, depuis la page **Admin > Droits** (`/admin/droits`, API `/api/admin/grants`).
- **Sécurité** : toute route d'écriture doit vérifier l'appelant avec `requireUser` / `requireAdmin` (`lib/auth.ts`, token `Authorization: Bearer`) et écrire avec `supabaseAdmin`, comme `/api/mvp`, `/api/admin/riot-publish` ou `/api/admin/tcg`. Ne jamais écrire en base depuis une route sans authentification, ni ouvrir une policy RLS en écriture à `anon` (les tables `teams`, `team_members`, `team_join_requests`, `players` et `profiles` ont été verrouillées le 13/11/2026 : une écriture depuis le navigateur avec la clé anon y est refusée).
- En prod, `service_role` n'a pas le droit `SELECT` sur `team_join_requests`.
- En prod (nov. 2026), `service_role` n'avait pas le droit `DELETE` sur `czf_mvp_proposals` : la suppression d'un BO (`/api/admin/results/[id]`) échouait avec « permission denied ». À corriger par `GRANT DELETE`.
- **Carte TCG** : `container-type: inline-size` sur un élément ne s'applique qu'à ses enfants ; une unité `cqw` dans le style de l'élément lui-même est calculée sur un conteneur parent ou sur l'écran. D'où `border-radius` en `%` sur `.card`, et `cqw` seulement pour les enfants.
- **Visuels générés avec sharp** : le rendu SVG de sharp ignore les polices ajoutées (fontconfig) ; pour écrire en Barlow Condensed, convertir le texte en tracés (`opentype.js`, voir `~/www/czf-tcg/gen-booster.mjs`). Les images d'un SVG doivent être en `data:` URI.
- **Fonction SQL modifiée** : si sa signature change, l'API Supabase (PostgREST) renvoie `PGRST202 Could not find the function` tant que l'ancienne version est en base ; supprimer l'ancienne (`drop function … (types)`) puis `notify pgrst, 'reload schema';`.
- **Header (Nav) monté une seule fois dans `app/layout.tsx`** : une nouvelle page ne doit pas ajouter `<Nav />`, sinon le header apparaît en double (le Footer, lui, reste à ajouter dans chaque page).
- **Marge sous le header** : toutes les pages démarrent à `--space-block` sous le header, comme `ds.header` (`<header className={ds.header}><div className={ds.container}>…`). Ne pas poser un padding vertical sur le même élément que `ds.container` : son `padding: 0 32px` l'écrase selon l'ordre de chargement des CSS (utiliser un élément parent, ou `main .wrap` comme les pages TCG).
- **Menu admin** : `app/admin/layout.tsx` + `AdminShell.tsx` affichent le menu de gauche et le footer sur toutes les pages `/admin/*` (pour les admins). Une page admin ne remet donc ni `<main>`, ni `<Footer />`, ni bouton « Retour admin » ; une nouvelle page s'ajoute au menu dans `AdminShell`. Les vues Équipes / Joueurs de `/admin` sont pilotées par `?vue=`.
