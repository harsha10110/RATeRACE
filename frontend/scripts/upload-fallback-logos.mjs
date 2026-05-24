import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC    = join(__dirname, '..', 'public');

const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY || 'private_hPsyf40k1GtAFmPqn3DUdaBdAAk=';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${PRIVATE_KEY}:`).toString('base64');
const UPLOAD_URL  = 'https://upload.imagekit.io/api/v1/files/upload';

async function upload(fileName) {
  const buf  = readFileSync(join(PUBLIC, fileName));
  const form = new FormData();
  form.append('file',              new Blob([buf]), fileName);
  form.append('fileName',          fileName);
  form.append('folder',            '/');
  form.append('useUniqueFileName', 'false');
  form.append('overwriteFile',     'true');

  const res  = await fetch(UPLOAD_URL, { method: 'POST', headers: { Authorization: AUTH_HEADER }, body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  console.log(`✓ ${fileName} → ${json.url}`);
  return json.url;
}

const [eduUrl, workUrl] = await Promise.all([
  upload('ed_institution.png'),
  upload('work_institution.png'),
]);

console.log('\nImageKit URLs:');
console.log('  EDU  :', eduUrl);
console.log('  WORK :', workUrl);
