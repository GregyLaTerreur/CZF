// Logos d'équipe servis redimensionnés par /api/logo (les originaux pèsent jusqu'à plusieurs Mo).

// 2x la taille d'affichage : 96 pour les petites icônes (≤ 48 px), 192 pour l'en-tête d'équipe.
export const LOGO_SIZES = [96, 192] as const;

export type LogoSize = (typeof LOGO_SIZES)[number];

export function logoSrc(url: string | null | undefined, size: LogoSize = 96): string {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return url;

  return `/api/logo?w=${size}&u=${encodeURIComponent(url)}`;
}

// Hébergeurs d'images acceptés pour un logo d'équipe (évite de faire appeler n'importe quelle adresse au serveur).
export const LOGO_HOSTS = [
  'imgur.com',
  'i.imgur.com',
  'image.noelshack.com',
  'cdn.phototourl.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.ibb.co',
  'res.cloudinary.com',
];

export function isAllowedLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && LOGO_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
