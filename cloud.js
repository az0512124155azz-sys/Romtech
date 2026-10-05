/* Shared data adapter. Local mode is explicit; cloud failures never become local writes. */
(() => {
  'use strict';
  const D = window.RomTechData, local = { ...D }, copy = value => JSON.parse(JSON.stringify(value));
  const names = { products: 'Products', orders: 'Orders', reviews: 'Reviews', settings: 'SiteSettings', content: 'LegalContent' };
  let rows = {}, config = { mode: 'loading', serverReady: false }, adminView = false, queue = Promise.resolve();
  const isAdminPage = () => location.pathname === '/admin/' || location.pathname.endsWith('/admin/index.html');
  const empty = { products: [], orders: [], reviews: [], settings: [], content: [] };
  function notice(message) {
    let el = document.getElementById('cloudNotice');
    if (!el) { el = document.createElement('div'); el.id = 'cloudNotice'; el.className = 'cloud-notice'; el.setAttribute('role','status'); document.body.prepend(el); }
    el.textContent = message; el.hidden = !message;
  }
  async function api(action, body, query = '') {
    let response;
    try { response = await fetch(`/api/romtech?action=${action}${query}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(65000)
    }); } catch { throw new Error('אין חיבור לשרת. השינוי לא אושר. בדוק את החיבור ונסה שוב.'); }
    if (action === 'config' && response.status === 404) return { mode: 'local', serverReady: false, oauthReady: false, authenticated: false };
    let result; try { result = await response.json(); } catch { throw new Error('שרת החיבור אינו מוגדר כראוי. פנה לבעל האתר.'); }
    if (!response.ok) {
      const error = new Error(result.error?.message || 'הפעולה לא הושלמה. נסה שוב.'); error.code = result.error?.code;
      if (error.code === 'login_required') window.dispatchEvent(new Event('romtech-session-expired'));
      throw error;
    }
    return result;
  }
  async function refresh() {
    const next = await api('config');
    if (config.connection?.generation && next.connection?.generation !== config.connection.generation) rows = copy(empty);
    config = next; D.config = config;
    adminView = isAdminPage() && config.authenticated;
    if (config.mode === 'cloud') {
      rows = await api('snapshot', undefined, adminView ? '&admin=1' : '');
      if (rows.generation !== config.connection.generation) throw new Error('הפרויקט הוחלף במהלך הטעינה. רענן את העמוד.');
      notice('');
    } else if (config.mode === 'disconnected') { rows = copy(empty); notice('האתר מנותק ממסד הנתונים. יש לחבר פרויקט באזור הניהול.'); }
    else { notice('מצב מקומי: השינויים נשמרים רק בדפדפן הזה. חבר Supabase באזור הניהול לסנכרון בין מכשירים.'); }
    return config;
  }
  function values(entity) { return (rows[entity] || []).map(r => ({ ...r.data, ...(entity === 'products' && adminView ? { cost: r.cost } : {}) })); }
  for (const [entity, name] of Object.entries(names)) {
    D[`load${name}`] = () => {
      if (config.mode === 'local') return copy(local[`load${name}`]());
      if (entity === 'settings') return { ...D.DEFAULT_SITE_SETTINGS, ...(values(entity)[0] || {}), footerLabels: { ...D.DEFAULT_SITE_SETTINGS.footerLabels, ...(values(entity)[0]?.footerLabels || {}) } };
      if (entity === 'content') return Object.fromEntries((rows.content || []).map(r => [r.id, copy(r.data)]));
      return copy(values(entity));
    };
    D[`save${name}`] = async value => {
      await D.ready;
      if (config.mode === 'local') { local[`save${name}`](value); return value; }
      if (config.mode !== 'cloud') throw new Error('אין פרויקט מחובר. השינוי לא נשמר.');
      if (!adminView) throw new Error('יש להיכנס לניהול כדי לערוך נתונים.');
      const desired = copy(entity === 'settings' ? [{ id: 'site', data: value }] : entity === 'content' ? Object.entries(value).map(([id,data]) => ({ id,data })) : value.map(data => ({ id: data.id, data })));
      const base = copy(rows[entity] || []);
      const operation = async () => {
        const changes = desired.filter(item => {
          const prev = base.find(x => x.id === item.id);
          return !prev || JSON.stringify({ ...prev.data, ...(entity === 'products' ? { cost: prev.cost } : {}) }) !== JSON.stringify(item.data);
        }).map(item => ({ ...item, revision: base.find(x => x.id === item.id)?.revision || null }));
        const deletes = base.filter(item => !desired.some(x => x.id === item.id)).map(({ id, revision }) => ({ id, revision }));
        if (!changes.length && !deletes.length) return value;
        if (changes.length + deletes.length > 300) throw new Error('ניתן לשנות עד 300 רשומות בכל פעולה. פצל את הייבוא.');
        for (const item of changes) if (entity === 'products') item.data.images = await uploadImages(item.data.images || []);
        const result = await api('patch', { entity, changes, deletes, generation: config.connection.generation });
        rows[entity] = result.rows;
        return value;
      };
      const pending = queue.then(operation); queue = pending.catch(() => {});
      return pending;
    };
  }
  async function uploadImages(images) {
    const result = [];
    for (const image of images) result.push(image.startsWith('data:') ? (await api('upload', { image, generation: config.connection.generation })).url : image);
    return result;
  }
  D.submitOrder = async record => {
    await D.ready;
    if (config.mode === 'local') throw new Error('החנות עדיין אינה מחוברת לקבלת הזמנות. אפשר לפנות דרך WhatsApp.');
    if (config.mode !== 'cloud') throw new Error('החנות אינה זמינה לקבלת הזמנות כרגע. נסה שוב מאוחר יותר.');
    return api('submit-order', { record, generation: config.connection.generation });
  };
  D.submitReview = async record => {
    await D.ready;
    if (config.mode !== 'cloud') throw new Error('יש לחבר את החנות לפני שליחת ביקורות.');
    await api('submit-review', { record, generation: config.connection.generation });
    rows.reviews = (await api('snapshot')).reviews;
  };
  D.migrationSummary = () => Object.fromEntries(Object.entries(names).map(([entity,name]) => {
    const value = local[`load${name}`]();
    return [entity, entity === 'settings' ? 1 : entity === 'content' ? Object.keys(value).length : value.length];
  }));
  D.migrate = async progress => {
    if (!adminView || config.mode !== 'cloud') throw new Error('יש להתחבר לניהול ולפרויקט לפני העברה.');
    const generation = config.connection.generation;
    for (const [entity,name] of Object.entries(names)) {
      const data = local[`load${name}`]();
      const records = entity === 'settings' ? [{ id:'site', data }] : entity === 'content' ? Object.entries(data).map(([id,data]) => ({id,data})) : data.map(data => ({id:data.id,data}));
      let done = 0;
      for (const record of records) {
        if (entity === 'products') record.data.images = await uploadImages(record.data.images || []);
        const result = await api('patch', { entity, changes: [record], deletes: [], import: true, generation });
        rows[entity] = result.rows;
        progress?.(entity, ++done, records.length);
      }
    }
    // Keep the original local data intact so interrupted migrations can be retried safely.
    await refresh();
  };
  D.api = api; D.refresh = refresh; D.notice = notice;
  D.newId = prefix => `${prefix}-${crypto.randomUUID()}`;
  D.ready = refresh().catch(error => { config = { mode:'error', serverReady:false }; D.config = config; rows = copy(empty); notice(error.message); });
  // Error messages are displayed centrally; callers only show success after awaited writes.
  window.addEventListener('unhandledrejection', event => { event.preventDefault(); notice(event.reason?.message || 'הפעולה לא הושלמה. נסה שוב.'); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && config.mode === 'cloud' && !isAdminPage()) refresh().then(() => window.dispatchEvent(new Event('romtech-data-changed'))).catch(error => notice(error.message));
  });
  setInterval(() => {
    if (!document.hidden && config.mode === 'cloud' && !isAdminPage()) refresh().then(() => window.dispatchEvent(new Event('romtech-data-changed'))).catch(error => notice(error.message));
  }, 30000);
})();
