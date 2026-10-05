import { mkdir, readdir, copyFile, cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './generate-schema.mjs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');
// An explicit public-file allowlist keeps server source, tests and secrets out of static hosting.
await mkdir(output, { recursive: true });
for (const name of await readdir(output)) await rm(resolve(output,name), { recursive:true, force:true });
for (const name of await readdir(root)) {
  if (/\.(html|css)$/.test(name) || ['app.js','data.js','cloud.js','connection.js','admin.js','product.js','reviews.js','legal.js','sitemap.xml','robots.txt'].includes(name)) {
    await copyFile(resolve(root,name),resolve(output,name));
  }
}
for (const name of ['assets','admin']) await cp(resolve(root,name),resolve(output,name), { recursive:true });
console.log('Public site built in dist/. Server code and secrets excluded.');
