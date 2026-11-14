// Message d'erreur base pour l'admin TCG : signale une base pas à jour plutôt qu'un échec muet.
export function tcgDbMessage(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return `${fallback} La base n’est pas à jour (colonne manquante) : lancer les SQL czf-import/tcg-6-saisons.sql et tcg-7-carte-joueur.sql.`;
  }
  if (error?.code === '23514') return `${fallback} Valeur refusée par la base (contrainte) : vérifier que les SQL czf-import/tcg-4 et tcg-5 ont été lancés.`;
  return fallback;
}
