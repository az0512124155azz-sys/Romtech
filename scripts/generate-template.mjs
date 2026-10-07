import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),files=[];
const dirs=new Set(['admin','api','assets','server','scripts']);
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=resolve(dir,entry.name),file=relative(root,full).split(sep).join('/');if(file==='server/template-source.mjs'||file==='server/runtime.mjs')continue;if(entry.isDirectory())await visit(full);else files.push({file,data:(await readFile(full)).toString('base64'),encoding:'base64'});}}
for(const entry of await readdir(root,{withFileTypes:true})){if(entry.isDirectory()&&dirs.has(entry.name))await visit(resolve(root,entry.name));if(entry.isFile()&&(/^(package(?:-lock)?\.json|vercel\.json|[^.]+\.(html|css|js|xml|txt))$/).test(entry.name))files.push({file:entry.name,data:(await readFile(resolve(root,entry.name))).toString('base64'),encoding:'base64'});}
await writeFile(resolve(root,'server/template-source.mjs'),`// Generated.\nexport const templateFiles=${JSON.stringify(files)};\n`);
