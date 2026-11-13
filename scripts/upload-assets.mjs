// Envoie public/assets sur Cloudinary (dossier "czf/"), en écrasant les versions existantes.
// Usage : npm run assets:upload   (lit .env.local : NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
//         CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Relancer après tout ajout/modif d'un asset.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'public', 'assets');
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

async function loadEnv(file) {
  try {
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}

// Même règle que assetPublicId() dans lib/assets.ts.
function publicId(rel) {
  const isSvg = /\.svg$/i.test(rel);
  return `czf/${(isSvg ? rel : rel.replace(/\.[a-z0-9]+$/i, '')).replace(/\s+/g, '_')}`;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (IMAGE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

await loadEnv('.env.local');
const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;

if (!cloud || !key || !secret) {
  console.error('Manque NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET dans .env.local');
  process.exit(1);
}

const files = await walk(ASSETS_DIR);
let failed = 0;

for (const file of files) {
  const rel = relative(ASSETS_DIR, file).split(sep).join('/');
  const params = { invalidate: 'true', overwrite: 'true', public_id: publicId(rel), timestamp: String(Math.floor(Date.now() / 1000)) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const signature = createHash('sha1').update(toSign + secret).digest('hex');

  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', key);
  form.append('signature', signature);
  form.append('file', new Blob([await readFile(file)]), rel.split('/').pop());

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const body = await res.json();

  if (!res.ok) {
    failed++;
    console.error(`ECHEC ${rel} : ${body.error?.message ?? res.status}`);
  } else {
    console.log(`ok  ${rel} -> ${body.public_id} (${Math.round(body.bytes / 1024)} Ko)`);
  }
}

console.log(`\n${files.length - failed}/${files.length} assets envoyés sur Cloudinary.`);
process.exit(failed ? 1 : 0);
