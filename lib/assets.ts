// Assets statiques (public/assets) servis par le CDN Cloudinary quand
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME est défini, sinon depuis /public (dev, fallback).
// Les fichiers sont envoyés sur Cloudinary par `npm run assets:upload`.

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const ROOT_FOLDER = 'czf';

// Format et qualité choisis par Cloudinary selon le navigateur (AVIF/WebP) : les PNG de plusieurs Mo fondent.
const DEFAULT_TRANSFORM = 'f_auto,q_auto';

// Chemin local (ex. "/assets/eclairs/eclair_czf_01.png") -> identifiant Cloudinary ("czf/eclairs/eclair_czf_01").
// Utilisé aussi par scripts/upload-assets.mjs : garder les deux en phase.
export function assetPublicId(path: string): string {
  const relative = path.replace(/^\/?assets\//, '');
  const isSvg = /\.svg$/i.test(relative);
  const id = (isSvg ? relative : relative.replace(/\.[a-z0-9]+$/i, '')).replace(/\s+/g, '_');
  return `${ROOT_FOLDER}/${id}`;
}

export function asset(path: string, transform: string = DEFAULT_TRANSFORM): string {
  if (!CLOUD_NAME || !path.startsWith('/assets/')) return path;

  const publicId = assetPublicId(path).split('/').map(encodeURIComponent).join('/');

  // Les SVG restent vectoriels : pas de transformation.
  if (/\.svg$/i.test(path)) return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`;

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

// Image rangée directement sur Cloudinary (hors public/assets), par son chemin sous "czf/".
// Ex. cdnImage('cards/s1/Dragon_Rouge', 'f_auto,q_auto,w_400'). Sans cloud configuré : chaîne vide.
export function cdnImage(path: string, transform: string = DEFAULT_TRANSFORM): string {
  if (!CLOUD_NAME) return '';
  const id = `${ROOT_FOLDER}/${path.replace(/^\/+|^czf\//g, '')}`.split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${id}`;
}

// Images utilisées en `background` dans le CSS : exposées en variables CSS (--asset-…) par app/layout.tsx.
export const CSS_ASSETS = {
  'bg-wide': '/assets/czf-bg-wide.png',
  'eclair-01': '/assets/eclairs/eclair_czf_01.png',
  'eclair-02': '/assets/eclairs/eclair_czf_02.png',
  'eclair-03': '/assets/eclairs/eclair_czf_03.png',
  'eclair-04': '/assets/eclairs/eclair_czf_04.png',
  'eclair-05': '/assets/eclairs/eclair_czf_05.png',
  'eclair-06': '/assets/eclairs/eclair_czf_06.png',
  'eclair-07': '/assets/eclairs/eclair_czf_07.png',
  'eclair-08': '/assets/eclairs/eclair_czf_08.png',
  'eclair-09': '/assets/eclairs/eclair_czf_09.png',
  'eclair-10': '/assets/eclairs/eclair_czf_10.png',
} as const;

export function cssAssetVariables(): string {
  const vars = Object.entries(CSS_ASSETS)
    .map(([name, path]) => `--asset-${name}:url("${asset(path)}");`)
    .join('');
  return `:root{${vars}}`;
}
