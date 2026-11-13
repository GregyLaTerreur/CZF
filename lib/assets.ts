// Images du site servies par le CDN Cloudinary (dossier racine "czf/"). Elles ne sont plus dans le repo :
// on les envoie avec `npm run assets:upload -- <dossier> [cible]`.
// Les chemins "/assets/…" du code sont conservés comme noms logiques et convertis en URL Cloudinary.

// Le cloud name n'est pas secret (il apparaît dans chaque URL d'image) : valeur par défaut = compte CZF.
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dn70nvtqk';
const ROOT_FOLDER = 'czf';

// Format et qualité choisis par Cloudinary selon le navigateur (AVIF/WebP) : les PNG de plusieurs Mo fondent.
const DEFAULT_TRANSFORM = 'f_auto,q_auto';

// Chemin local (ex. "/assets/eclairs/eclair_czf_01.png") -> identifiant Cloudinary ("czf/eclairs/eclair_czf_01").
// Même règle que publicId() dans scripts/upload-assets.mjs : garder les deux en phase.
export function assetPublicId(path: string): string {
  const relative = path.replace(/^\/?assets\//, '');
  const id = relative.replace(/\.[a-z0-9]+$/i, '').replace(/\s+/g, '_');
  return `${ROOT_FOLDER}/${id}`;
}

export function asset(path: string, transform: string = DEFAULT_TRANSFORM): string {
  if (!path.startsWith('/assets/')) return path;

  const publicId = assetPublicId(path).split('/').map(encodeURIComponent).join('/');

  // Les SVG restent vectoriels : pas de transformation (servis en image/svg+xml).
  if (/\.svg$/i.test(path)) return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`;

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

// Image rangée directement sur Cloudinary (hors public/assets), par son chemin sous "czf/".
// Ex. cdnImage('cards/s1/Dragon_Rouge', 'f_auto,q_auto,w_400').
export function cdnImage(path: string, transform: string = DEFAULT_TRANSFORM): string {
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
