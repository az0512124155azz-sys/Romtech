import { createHash } from 'node:crypto';
import { AppError, randomId, digest, passwordHash, passwordMatches, cookie, sessionCookie, verifyOrigin } from './security.mjs';
import { createStore } from './store.mjs';
import { provider, publicConnection, validRef, ENTITIES, BUCKET, schemaSQL } from './supabase.mjs';
import { patch, clean, text, id } from './validation.mjs';

const REQUIRED = ['ROMTECH_ORIGIN','ROMTECH_STORE_PREFIX','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','ROMTECH_ENCRYPTION_KEY','ROMTECH_OWNER_PASSWORD_HASH'];
const OAUTH = ['SUPABASE_OAUTH_CLIENT_ID','SUPABASE_OAUTH_CLIENT_SECRET'];
export function createApp({ env = process.env, store: injectedStore, supabase = provider() } = {}) {
  let cachedStore;
  const ready = () => REQUIRED.every(k => !!env[k]);
  const oauthReady = () => OAUTH.every(k => !!env[k]);
  const store = () => injectedStore || (cachedStore ||= createStore(env));
  const origin = () => new URL(env.ROMTECH_ORIGIN).origin;
  const callbackURL = () => `${origin()}/api/romtech?action=oauth-callback`;
  async function owner(req, required = true) {
    const sid = cookie(req);
    const session = /^[A-Za-z0-9_-]{43}$/.test(sid) ? await store().get(`session:${digest(sid)}`) : null;
    const credentials = await store().get('owner');
    if (!session || session.epoch !== (credentials?.epoch || 'initial')) {
      if (required) throw new AppError(401, 'login_required', 'יש להיכנס מחדש עם סיסמת בעל האתר.');
      return null;
    }
    return digest(sid);
  }
  async function connection(body) {
    const c = await store().get('connection');
    if (!c || !c.active) throw new AppError(409, 'not_connected', 'האתר אינו מחובר לפרויקט. יש להשלים חיבור באזור הניהול.');
    if (body && body.generation !== c.generation) throw new AppError(409, 'project_changed', 'פרויקט האתר הוחלף. רענן את העמוד לפני המשך העבודה.');
    return c;
  }
  async function token(sid) {
    const value = await store().get(`oauth:${sid}`);
    if (!value || value.expiresAt <= Date.now()) throw new AppError(401, 'oauth_expired', 'ההרשאה ל־Supabase פגה. לחץ שוב על חבר Supabase.');
    return value.access_token;
  }
  async function accessibleProject(access, ref) {
    validRef(ref);
    const projects = await supabase.management(access, '/projects');
    const project = projects.find(x => x.id === ref || x.ref === ref);
    if (!project) throw new AppError(403, 'project_forbidden', 'הפרויקט אינו נגיש בחשבון שחובר.');
    if (project.status !== 'ACTIVE_HEALTHY') throw new AppError(409, 'project_starting', 'הפרויקט עדיין מוקם או מושהה. המתן ואז רענן את הרשימה ב־Supabase.');
    return project;
  }
  async function snapshot(c, admin) {
    const result = { generation: c.generation };
    await Promise.all(ENTITIES.map(async entity => { result[entity] = entity === 'orders' && !admin ? [] : await supabase.rows(c, entity, admin); }));
    return result;
  }
  return async function app(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    const redirect = path => { res.statusCode = 303; res.setHeader('Location', path); res.end(); };
    let action;
    try {
      const url = new URL(req.url, 'https://romtech.invalid');
      action = url.searchParams.get('action') || 'config';
      if (!['GET','POST'].includes(req.method)) throw new AppError(405, 'method_not_allowed', 'הפעולה אינה נתמכת.');
      const gets = ['config','session','projects','snapshot','health','oauth-callback'];
      if ((gets.includes(action) ? 'GET' : 'POST') !== req.method) throw new AppError(405, 'method_not_allowed', 'הפעולה אינה נתמכת.');
      if (action === 'config') {
        if (!ready()) return send(200, { mode: 'local', serverReady: false, oauthReady: false, authenticated: false, connection: null });
        const c = await store().get('connection'), authenticated = !!await owner(req, false);
        return send(200, { mode: c?.active ? 'cloud' : c ? 'disconnected' : 'local', serverReady: true, oauthReady: oauthReady(), authenticated, connection: c?.active ? publicConnection(c) : null });
      }
      if (!ready()) throw new AppError(503, 'setup_required', 'בעל האתר צריך להשלים את הגדרת השרת לפי מדריך ההתקנה.');
      if (req.method === 'POST') verifyOrigin(req, origin());
      const body = req.body || {};
      if (JSON.stringify(body).length > 3000000) throw new AppError(413, 'too_large', 'הבקשה גדולה מדי. פצל את הייבוא או בחר תמונה קטנה יותר.');
      // Vercel overwrites this header. Other hosts must use the TCP peer, not user-supplied X-Forwarded-For.
      const ip = digest(String(env.VERCEL ? req.headers['x-vercel-forwarded-for'] || 'unknown' : req.socket?.remoteAddress || 'local'));
      if (action === 'login') {
        await store().rate(`login:${ip}`, 10, 900);
        const credentials = await store().get('owner');
        if (!passwordMatches(body.password, credentials?.hash || env.ROMTECH_OWNER_PASSWORD_HASH)) throw new AppError(401, 'bad_password', 'סיסמת בעל האתר שגויה.');
        const previous = await owner(req, false);
        if (previous) { await store().del(`session:${previous}`); await store().del(`oauth:${previous}`); }
        const sid = randomId();
        await store().set(`session:${digest(sid)}`, { epoch: credentials?.epoch || 'initial' }, 28800);
        res.setHeader('Set-Cookie', sessionCookie(sid, origin()));
        return send(200, { ok: true });
      }
      if (action === 'snapshot') {
        const c = await connection();
        // Public pages never receive private data, even in an owner's browser.
        const admin = url.searchParams.get('admin') === '1';
        if (admin) await owner(req);
        return send(200, await snapshot(c, admin));
      }
      if (action === 'submit-order' || action === 'submit-review') {
        await store().rate(`submit:${ip}`, 15, 3600);
        const c = await connection(body), rowId = id(body.record?.id);
        const productId = id(body.record?.productId);
        const rows = await supabase.rest(c, `romtech_products?id=eq.${productId}&select=id,data`, false);
        if (!rows.length) throw new AppError(400, 'product_unavailable', 'המוצר אינו זמין כרגע. רענן את הקטלוג.');
        const product = rows[0].data, entity = action === 'submit-order' ? 'orders' : 'reviews';
        if (entity === 'orders' && body.record.privacyConsent !== true) throw new AppError(400, 'consent_required', 'יש לאשר שימוש בפרטים לצורך טיפול בהזמנה.');
        if (entity === 'orders' && Number(product.stock) <= 0) throw new AppError(409, 'out_of_stock', 'המוצר אזל מהמלאי. אפשר לפנות אלינו לבירור.');
        const canonical = { ...body.record, productName: product.name, price: product.salePrice || product.price,
          status: entity === 'orders' ? 'new' : 'approved', createdAt: new Date().toISOString(), consentAt: new Date().toISOString() };
        const record = clean(entity, canonical, rowId);
        // Stable caller-generated ID makes retries safe; existing rows are never overwritten.
        await supabase.rest(c, 'rpc/romtech_apply_patch', true, { p_entity: entity, p_changes: [{ id: rowId, ...record }], p_deletes: [], p_import: true });
        return send(200, { ok: true, id: rowId });
      }
      const sid = await owner(req);
      if (action === 'session') return send(200, { authenticated: true });
      if (action === 'logout') {
        await store().del(`session:${sid}`); await store().del(`oauth:${sid}`); await store().del(`pending:${sid}`);
        res.setHeader('Set-Cookie', sessionCookie('', origin(), 0));
        return send(200, { ok: true });
      }
      if (action === 'password') {
        const password = text(body.password, 256, true);
        if (password.length < 12) throw new AppError(400, 'weak_password', 'בחר סיסמה באורך 12 תווים לפחות.');
        const credentials = await store().get('owner');
        if (!passwordMatches(body.currentPassword, credentials?.hash || env.ROMTECH_OWNER_PASSWORD_HASH)) throw new AppError(401, 'bad_password', 'הסיסמה הנוכחית שגויה.');
        const epoch = randomId();
        await store().set('owner', { hash: passwordHash(password), epoch });
        await store().set(`session:${sid}`, { epoch }, 28800);
        return send(200, { ok: true });
      }
      if (action === 'oauth-start') {
        if (!oauthReady()) throw new AppError(503, 'oauth_setup_required', 'בעל האתר צריך לרשום אפליקציית OAuth ב־Supabase ולהשלים את הגדרת השרת.');
        const state = randomId(), verifier = randomId();
        await store().set(`state:${digest(state)}`, { sid, verifier }, 600);
        const authorize = new URL('https://api.supabase.com/v1/oauth/authorize');
        authorize.search = new URLSearchParams({ client_id: env.SUPABASE_OAUTH_CLIENT_ID, redirect_uri: callbackURL(), response_type: 'code', state,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        return send(200, { url: authorize.href });
      }
      if (action === 'oauth-callback') {
        const state = url.searchParams.get('state') || '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new AppError(400, 'oauth_state', 'החיבור פג או אינו תקין. נסה להתחבר שוב.');
        const saved = await store().take(`state:${digest(state)}`);
        if (!saved || saved.sid !== sid || url.searchParams.has('error')) throw new AppError(400, 'oauth_state', 'החיבור בוטל או פג. אפשר לנסות שוב.');
        const code = text(url.searchParams.get('code'), 4000, true);
        const tokens = await supabase.request('https://api.supabase.com/v1/oauth/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${env.SUPABASE_OAUTH_CLIENT_ID}:${env.SUPABASE_OAUTH_CLIENT_SECRET}`).toString('base64')}` },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackURL(), code_verifier: saved.verifier }).toString()
        });
        if (!tokens?.access_token) throw new AppError(502, 'oauth_invalid', 'לא התקבלה הרשאה תקינה מ־Supabase.');
        // Only needed during setup. Do not retain the refresh token or long-lived management access.
        const lifetime = Math.min(Number(tokens.expires_in) || 3600, 3600);
        await store().set(`oauth:${sid}`, { access_token: tokens.access_token, expiresAt: Date.now() + lifetime * 1000 }, lifetime);
        return redirect('/admin/?supabase=connected');
      }
      if (action === 'projects') {
        const access = await token(sid);
        const [projects, organizations] = await Promise.all([supabase.management(access, '/projects'), supabase.management(access, '/organizations')]);
        return send(200, { projects: projects.map(p => ({ ref: p.ref || p.id, name: p.name, status: p.status })), organizations: organizations.map(o => ({ slug: o.slug || o.id, name: o.name })) });
      }
      if (action === 'create-project') {
        const access = await token(sid), requestId = id(body.requestId);
        if (body.confirmCosts !== true) throw new AppError(400, 'cost_confirmation', 'יש לאשר יצירת פרויקט בהתאם לתוכנית החשבון שלך.');
        const organizations = await supabase.management(access, '/organizations');
        if (!organizations.some(o => (o.slug || o.id) === body.organization)) throw new AppError(403, 'organization_forbidden', 'בחר ארגון מתוך הרשימה.');
        return await store().lock('connection', async () => {
          const prior = await store().get(`create:${requestId}`);
          if (prior?.project) return send(200, prior.project);
          if (prior) throw new AppError(409, 'creation_unknown', 'בקשת יצירה כבר נשלחה. רענן את רשימת הפרויקטים לפני ניסיון נוסף, כדי למנוע כפילות.');
          const dbPass = randomId();
          await store().set(`create:${requestId}`, { dbPass, requestedAt: new Date().toISOString() }, 86400);
          const project = await supabase.management(access, '/projects', { name: text(body.name, 80, true), organization_slug: body.organization,
            db_pass: dbPass, region_selection: { type: 'smartGroup', code: 'emea' } });
          const result = { ref: project.ref || project.id, name: project.name, status: project.status };
          await store().set(`create:${requestId}`, { project: result, dbPass }, 86400);
          // Database credentials remain encrypted server-side; the buyer can rotate in Supabase.
          await store().set(`database:${result.ref}`, { password: dbPass });
          return send(200, result);
        });
      }
      if (action === 'provision') {
        const access = await token(sid), project = await accessibleProject(access, body.ref), ref = validRef(body.ref);
        return await store().lock('connection', async () => {
          await supabase.management(access, `/projects/${ref}/database/query`, { query: schemaSQL });
          const keys = await supabase.management(access, `/projects/${ref}/api-keys?reveal=true`);
          let publicKey = keys.find(k => k.type === 'publishable' && k.api_key?.startsWith('sb_publishable_'));
          if (!publicKey) publicKey = await supabase.management(access, `/projects/${ref}/api-keys?reveal=true`, { type: 'publishable', name: 'romtech_public' });
          let secret = keys.find(k => k.name === 'romtech_server' && k.type === 'secret' && k.api_key?.startsWith('sb_secret_'));
          if (!secret) secret = await supabase.management(access, `/projects/${ref}/api-keys?reveal=true`, { type: 'secret', name: 'romtech_server' });
          if (!publicKey?.api_key?.startsWith('sb_publishable_') || !secret?.api_key?.startsWith('sb_secret_')) throw new AppError(502, 'keys_unavailable', 'לא ניתן ליצור מפתחות לפרויקט. בדוק הרשאות Secrets באפליקציית OAuth.');
          const c = { ref, url: `https://${ref}.supabase.co`, publishableKey: publicKey.api_key, secretKey: secret.api_key, secretId: secret.id,
            name: project.name, generation: randomId(), active: true };
          const buckets = await supabase.storage(c, 'bucket');
          if (!buckets.some(b => b.id === BUCKET)) await supabase.storage(c, 'bucket', 'POST', { id: BUCKET, name: BUCKET, public: true, file_size_limit: 2097152, allowed_mime_types: ['image/png','image/jpeg','image/webp'] });
          const health = await supabase.health(c);
          const current = await store().get('connection');
          await store().set(`pending:${sid}`, { connection: c, previousGeneration: current?.generation || null }, 3600);
          return send(200, { connection: publicConnection(c), health, needsActivation: true });
        });
      }
      if (action === 'activate') {
        return await store().lock('connection', async () => {
          const pending = await store().get(`pending:${sid}`);
          if (!pending || pending.connection.generation !== body.generation) throw new AppError(409, 'setup_expired', 'ההגדרה פגה. בחר פרויקט והפעל הגדרה מחדש.');
          const current = await store().get('connection');
          if ((current?.generation || null) !== pending.previousGeneration) throw new AppError(409, 'project_changed', 'החיבור שונה במכשיר אחר. רענן ונסה שוב.');
          await supabase.health(pending.connection);
          await store().set('connection', pending.connection);
          await store().del(`pending:${sid}`); await store().del(`oauth:${sid}`);
          return send(200, { ok: true, connection: publicConnection(pending.connection) });
        });
      }
      if (action === 'disconnect') {
        return await store().lock('connection', async () => {
          const c = await connection(body);
          // Tombstone prevents fallback to stale local records on other devices.
          await store().set('connection', { active: false, generation: randomId() });
          await store().del(`pending:${sid}`); await store().del(`oauth:${sid}`);
          return send(200, { ok: true, retainedProject: c.ref });
        });
      }
      if (action === 'health') return send(200, await supabase.health(await connection()));
      if (action === 'patch') {
        return await store().lock('connection', async () => {
          const c = await connection(body);
          if (!ENTITIES.includes(body.entity)) throw new AppError(400, 'invalid_entity', 'סוג הנתונים אינו תקין.');
          const args = patch(body.entity, body);
          await supabase.rest(c, 'rpc/romtech_apply_patch', true, args);
          return send(200, { ok: true, rows: await supabase.rows(c, body.entity, true) });
        });
      }
      if (action === 'upload') {
        const c = await connection(body), data = text(body.image, 2900000, true);
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(data);
        if (!match) throw new AppError(400, 'invalid_image', 'בחר תמונה מסוג PNG, JPG או WebP.');
        const bytes = Buffer.from(match[2], 'base64'), type = match[1];
        const valid = type === 'png' ? bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) : type === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
        if (!valid || bytes.length > 2097152) throw new AppError(400, 'invalid_image', 'התמונה אינה תקינה או גדולה מ־2MB.');
        const path = `products/${digest(bytes)}.${type}`;
        await supabase.request(`${c.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST',
          headers: { ...supabase.headers(c, true), 'Content-Type': `image/${type}`, 'x-upsert': 'true' }, body: bytes });
        return send(200, { url: `${c.url}/storage/v1/object/public/${BUCKET}/${path}` });
      }
      throw new AppError(404, 'not_found', 'הפעולה המבוקשת לא נמצאה.');
    } catch (error) {
      // Never serialize provider bodies, SQL, credentials, tokens or stack traces.
      if (action === 'oauth-callback') return redirect('/admin/?supabase=error');
      const known = error instanceof AppError;
      return send(known ? error.status : 500, { error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'הפעולה לא הושלמה. הנתונים לא נשמרו; נסה שוב או פנה לבעל האתר.' } });
    }
  };
}
