import { readFile, writeFile } from 'node:fs/promises';
const sql = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
await writeFile(new URL('../server/schema-source.mjs', import.meta.url),
  '// Generated from schema.sql. Runtime SQL is bundled as code, without a filesystem dependency.\nexport const schemaSQL = ' + JSON.stringify(sql) + ';\n');
