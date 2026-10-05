let handler;
export default async function romtech(req, res) {
  try {
    handler ||= import('../server/runtime.mjs').then(module => module.createApp());
    await (await handler)(req, res);
  } catch (error) {
    handler = undefined;
    const dependency = String(error.message || '').match(/Cannot find (?:package|module) ['"]([^'"]+)['"]/)?.[1]?.split(/[\\/]/).pop();
    const safeDependency = dependency && /^[a-zA-Z0-9_.-]{1,100}$/.test(dependency) ? dependency : undefined;
    const runtimeCode = /^[A-Z_]{3,60}$/.test(error.code || '') ? error.code : undefined;
    console.error('RomTech startup failure', error.name, runtimeCode, safeDependency);
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'server_startup', message: 'שירות החיבור אינו זמין כרגע. פנה לבעל האתר.', runtimeCode, dependency: safeDependency } }));
  }
}
