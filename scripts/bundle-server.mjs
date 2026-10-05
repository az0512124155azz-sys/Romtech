import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
// Bundle the sanitizer's ESM parser with its CommonJS caller. Some serverless
// runtimes disable require(esm), even on recent Node versions.
await build({
  absWorkingDir: root,
  entryPoints: ['server/app.mjs'],
  outfile: 'server/runtime.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as runtimeCreateRequire } from 'node:module'; const require = runtimeCreateRequire(import.meta.url);" }
});
