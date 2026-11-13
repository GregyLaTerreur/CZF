// Envoie des images sur Cloudinary, tout sous le dossier racine "czf/", en écrasant les versions existantes.
// Lit .env.local : NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
//
//   npm run assets:upload                          public/assets          -> czf/…
//   npm run assets:upload -- <dossier> <cible>     ex. ~/Images/cartes-s1 cards/s1 -> czf/cards/s1/…
//
// Les sous-dossiers sont conservés, les espaces des noms deviennent des "_", l'extension est retirée.
// Ex. cartes-s1/rare/Dragon Rouge.png -> czf/cards/s1/rare/Dragon_Rouge.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix, relative, resolve, sep } from 'node:path';

const [sourceArg, targetArg = ''] = process.argv.slice(2);
const ASSETS_DIR = sourceArg ? resolve(sourceArg.replace(/^~(?=\/|$)/, homedir())) : join(process.cwd(), 'public', 'assets');
const TARGET = targetArg.replace(/^\/+|\/+$/g, '').replace(/^czf\//, '');
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
  const id = rel.replace(/\.[a-z0-9]+$/i, '').replace(/\s+/g, '_');
  return posix.join('czf', TARGET, id);
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
  const id = publicId(rel);
  // asset_folder : range le fichier dans le bon dossier de la médiathèque Cloudinary (comptes en "dynamic folders").
  const params = { asset_folder: posix.dirname(id), invalidate: 'true', overwrite: 'true', public_id: id, timestamp: String(Math.floor(Date.now() / 1000)) };
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
