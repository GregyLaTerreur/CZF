// Logos d'équipe servis redimensionnés par /api/logo (les originaux pèsent jusqu'à plusieurs Mo).

// 2x la taille d'affichage : 96 pour les petites icônes (≤ 48 px), 192 pour l'en-tête d'équipe.
export const LOGO_SIZES = [96, 192] as const;

export type LogoSize = (typeof LOGO_SIZES)[number];

export function logoSrc(url: string | null | undefined, size: LogoSize = 96): string {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return url;

  return `/api/logo?w=${size}&u=${encodeURIComponent(url)}`;
}
