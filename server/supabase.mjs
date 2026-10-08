import { AppError } from './security.mjs';
import { schemaSQL } from './schema-source.mjs';
export { schemaSQL };

export const BUCKET = 'romtech-images';
export const ENTITIES = ['products', 'orders', 'reviews', 'settings', 'content'];
const API = 'https://api.supabase.com/v1';
export function validRef(ref) {
  if (!/^[a-z]{20}$/.test(ref || '')) throw new AppError(400, 'invalid_project', 'בחר פרויקט תקין מהרשימה.');
  return ref;
}
export function publicConnection(c) {
  if (!c) return null;
  return { ref: c.ref, url: c.url, publishableKey: c.publishableKey, generation: c.generation, name: c.name };
}
export function provider(fetcher = fetch) {
  async function request(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(35000) }); }
    catch { throw new AppError(503, 'provider_unavailable', 'לא ניתן להגיע ל־Supabase כרגע. נסה שוב; חיבור קיים לא הוחלף.'); }
    const text = await response.text();
    let body; try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!response.ok) {
      if (body?.code === '40001' || body?.code === '23505') throw new AppError(409, 'conflict', 'הנתונים השתנו במכשיר אחר. רענן ובצע מחדש את השינוי.');
      const status = response.status;
      const message = status === 401 || status === 403 ? 'ההרשאה חסרה או פגה. התחבר שוב ל־Supabase ובדוק הרשאות.'
        : status === 429 ? 'Supabase מגביל בקשות כרגע. המתן ונסה שוב.'
        : /limit|quota|maximum/i.test(text) ? 'החשבון הגיע למכסת הפרויקטים או המשאבים. בחר פרויקט קיים או בדוק את המכסה ב־Supabase.'
        : 'Supabase לא הצליח להשלים את הפעולה. בדוק שהפרויקט פעיל ושההרשאות ניתנו, ונסה שוב.';
      throw new AppError(status === 429 ? 429 : 502, 'supabase_error', message);
    }
    return body;
  }
  const management = (token, path, body, method = body === undefined ? 'GET' : 'POST') => request(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  function headers(c, admin) {
    const key = admin ? c.secretKey : c.publishableKey;
    return { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' };
  }
  const rest = (c, path, admin = false, body) => request(`${c.url}/rest/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: headers(c, admin),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  async function rows(c, entity, admin) {
    const result = [];
    // Read every page, including installations larger than PostgREST's default cap.
    for (let offset = 0; ;) {
      const page = await rest(c, `romtech_${entity}?select=${entity === 'products' && admin ? '*' : 'id,data,revision,updated_at'}&order=id&limit=500&offset=${offset}`, admin);
      result.push(...page);
      if (!page.length) return result;
      offset += page.length;
      if (result.length >= 50000) throw new AppError(413, 'too_many_rows', 'כמות הנתונים גדולה מדי לטעינה אחת. פנה לבעל האתר.');
    }
  }
  async function storage(c, path, method = 'GET', body) {
    return request(`${c.url}/storage/v1/${path}`, { method, headers: headers(c, true), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function health(c) {
    const version = await rest(c, 'romtech_schema?select=version&id=eq.1', true);
    if (version?.[0]?.version !== 1) throw new AppError(409, 'schema_version', 'גרסת מסד הנתונים אינה מתאימה. יש להריץ את ההגדרה שוב.');
    await Promise.all(ENTITIES.map(e => rest(c, `romtech_${e}?select=id&limit=1`, true)));
    await rest(c, 'romtech_products?select=id,data&limit=1', false);
    // A successful anonymous order query would be a privacy failure, even if empty.
    const response = await fetcher(`${c.url}/rest/v1/romtech_orders?select=id&limit=1`, { headers: headers(c, false), signal: AbortSignal.timeout(10000) });
    if (![401, 403].includes(response.status)) throw new AppError(409, 'privacy_check_failed', 'בדיקת פרטיות ההזמנות נכשלה. החיבור לא יופעל.');
    const bucket = await storage(c, `bucket/${BUCKET}`);
    if (!bucket.public || Number(bucket.file_size_limit) !== 2097152 || !bucket.allowed_mime_types?.includes('image/webp')) {
      throw new AppError(409, 'bucket_check_failed', 'הגדרות אחסון התמונות אינן תואמות. יש להפעיל הגדרה מחדש.');
    }
    return { ok: true, checkedAt: new Date().toISOString(), checks: ['schema', 'tables', 'catalog', 'order-privacy', 'storage'] };
  }
  return { request, management, rest, rows, storage, health, headers };
}
