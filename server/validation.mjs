import sanitizeHtml from 'sanitize-html';
import { AppError } from './security.mjs';
const fail = () => { throw new AppError(400, 'invalid_data', 'חלק מהפרטים חסרים או אינם תקינים. בדוק את השדות ונסה שוב.'); };
export function text(value, max = 500, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail();
  return value.trim();
}
export function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) fail();
  return value;
}
export function revision(value) {
  if (value == null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail();
  return value;
}
function number(value, max = 1e9, integer = false) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) fail();
  return value;
}
export function imageURL(value) {
  if (typeof value !== 'string' || value.length > 2048) fail();
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) fail(); return url.href; } catch { fail(); }
}
export function clean(entity, raw, rowId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail();
  const data = {};
  if (entity === 'products') {
    for (const k of ['name','short','full','court','category','sku','barcode','fur','lining','box','seoTitle','seoDescription','slug','video']) {
      data[k] = text(raw[k], k === 'full' ? 20000 : 2000, k === 'name');
    }
    for (const k of ['price','salePrice','stock','lowStock','height','teeth','embroideryPrice']) data[k] = number(raw[k]);
    if (data.price === null || data.stock === null || !Number.isInteger(data.stock)) fail();
    if (!['published','draft','hidden'].includes(raw.status)) fail();
    data.status = raw.status;
    data.embroidery = !!raw.embroidery;
    if (raw.tags != null && (!Array.isArray(raw.tags) || raw.tags.length > 30)) fail();
    data.tags = (raw.tags || []).map(x => text(x, 100));
    if (raw.images != null && (!Array.isArray(raw.images) || raw.images.length > 10)) fail();
    data.images = (raw.images || []).map(imageURL);
    data.id = rowId;
    return { data, cost: number(raw.cost) };
  }
  if (entity === 'orders') {
    for (const k of ['productId','productName','customerName','phone','email','city','address','notes','createdAt']) data[k] = text(raw[k], k === 'notes' ? 5000 : 500, ['customerName','phone','productId'].includes(k));
    if (!['new','contacted','confirmed','completed','cancelled'].includes(raw.status)) fail();
    data.status = raw.status; data.price = number(raw.price); data.id = rowId;
    data.privacyConsent = raw.privacyConsent === true;
    data.consentAt = text(raw.consentAt, 100);
  } else if (entity === 'reviews') {
    for (const k of ['productId','productName','name','text','createdAt']) data[k] = text(raw[k], k === 'text' ? 5000 : 500, ['productId','name','text'].includes(k));
    data.rating = number(raw.rating, 5, true);
    if (!data.rating || !['approved','pending'].includes(raw.status)) fail();
    data.status = raw.status; data.id = rowId;
  } else if (entity === 'settings') {
    if (rowId !== 'site') fail();
    for (const k of ['phone','whatsapp','email']) data[k] = text(raw[k], 254);
    data.footerLabels = {};
    for (const k of ['accessibility','privacy','terms','returns','shipping','cookies','faq','contact']) data.footerLabels[k] = text(raw.footerLabels?.[k], 100);
  } else if (entity === 'content') {
    if (!['accessibility','privacy','terms','returns','shipping','cookies','faq','contact'].includes(rowId)) fail();
    data.title = text(raw.title, 200);
    data.body = sanitizeHtml(text(raw.body, 100000), {
      allowedTags: ['p','h2','h3','h4','ul','ol','li','strong','b','em','i','a','br','blockquote'],
      allowedAttributes: { a: ['href','title'] }, allowedSchemes: ['https','http','mailto','tel'], allowProtocolRelative: false
    });
  } else fail();
  return { data };
}
export function patch(entity, body) {
  if (!Array.isArray(body.changes) || !Array.isArray(body.deletes) || body.changes.length + body.deletes.length > 300) fail();
  const seen = new Set();
  const checkId = value => { id(value); if (seen.has(value)) fail(); seen.add(value); return value; };
  return {
    p_entity: entity,
    p_changes: body.changes.map(item => ({ id: checkId(item.id), revision: revision(item.revision), ...clean(entity, item.data, item.id) })),
    p_deletes: body.deletes.map(item => ({ id: checkId(item.id), revision: revision(item.revision) })),
    p_import: body.import === true
  };
}
