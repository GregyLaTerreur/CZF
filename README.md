# CZF V1 — Clash des Zéros de la Faille

Projet Next.js V1 pour le site du tournoi.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir : http://localhost:3000

## Déploiement Vercel

1. Créer un repo GitHub `czf-website`
2. Mettre tous ces fichiers dedans
3. Sur Vercel : Import Project
4. Choisir le repo
5. Deploy

## Ce qui est inclus dans cette V1

- DA visuelle CZF avec assets fournis
- Page accueil
- Rubrique Divisions : Targon / Ixtal / Yordle
- Rubrique Équipes vide prête à recevoir les équipes
- Rubrique Joueurs avec formulaire Riot ID `Pseudo#TAG`
- Rubrique Calendrier vide
- Rubrique Résultats vide
- Hall of Fame vide
- Rulebook prêt à remplir
- Fonction de calcul CZF dans `app/lib/czf-score.ts`
- Route API scaffold dans `app/api/player/route.ts`

## Ce qui n'est PAS encore inclus

- Connexion réelle à Riot API
- Base de données Supabase
- Panel admin
- Logos des équipes
- Données réelles joueurs/équipes/matchs
- Affichage réel des logos d'elo Riot
- Récupération automatique du peak elo
- Authentification staff

## Algo préparé

Le calcul prend en compte :
- Elo actuel
- Division
- LP
- Winrate
- Nombre de games
- Peak elo

Le poids exact pourra être ajusté plus tard.
