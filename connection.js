(() => {
  'use strict';
  const D = window.RomTechData, $ = selector => document.querySelector(selector);
  let pending = null, creationId = null;
  function status(message, error = false) {
    const el = $('#connectionStatus'); el.textContent = message; el.classList.toggle('error-text', error);
  }
  async function busy(button, task) {
    const controls = [...$('#connectionPanel').querySelectorAll('button')];
    controls.forEach(x => { x.disabled = true; });
    $('#connectionPanel').setAttribute('aria-busy','true');
    try { await task(); }
    catch (error) { status(error.message, true); }
    finally { controls.forEach(x => { x.disabled = false; }); $('#connectionPanel').removeAttribute('aria-busy'); update(); }
  }
  function update() {
    const c = D.config || {};
    $('#connectSupabase').disabled = !c.serverReady || !c.oauthReady || !c.authenticated;
    $('#connectionProject').textContent = c.connection ? `${c.connection.name} · ${c.connection.ref}` : c.mode === 'disconnected' ? 'האתר מנותק' : 'טרם חובר פרויקט';
    $('#connectionSetupHelp').hidden = c.serverReady && c.oauthReady;
    $('#connectionActions').hidden = c.mode !== 'cloud';
    $('#activateProject').hidden = !pending;
    $('#connectSupabase').textContent = c.mode === 'cloud' ? 'החלף פרויקט Supabase' : 'חבר Supabase';
    const hosting = c.hosting || {};
    const transferReady = hosting.provider === 'vercel' && hosting.transferReady;
    $('#authorizeVercel').disabled = !c.authenticated || !hosting.authorizeReady;
    $('#vercelAuthorizeStatus').textContent = hosting.authorized ? 'Vercel מחובר' : hosting.authorizeReady ? 'נדרש אישור חד־פעמי' : 'נדרשת הגדרת OAuth בשרת';
    $('#startCustomerConnection').disabled = c.mode === 'cloud' || !c.authenticated || !hosting.authorizeReady || !c.oauthReady;
    $('#startCustomerConnection').textContent = c.mode === 'cloud' ? 'האתר מחובר' : 'חבר אתר לקוח';
    $('#deleteCustomerProject').disabled = c.mode !== 'cloud';
    $('#publishVercelRelease').disabled = !c.authenticated || !hosting.authorizeReady;
    $('#vercelReleaseStatus').textContent = hosting.release?.publishedAt ? `גרסה מאושרת: ${new Date(hosting.release.publishedAt).toLocaleString('he-IL')}` : 'עדיין לא פורסמה גרסה מאושרת; העותק ייווצר כצילום קבוע של הגרסה הנוכחית.';
    $('#vercelTransferStatus').textContent = transferReady
      ? 'הכול מוכן לפרסום עותק עצמאי בחשבון Vercel של הלקוח.'
      : hosting.provider === 'vercel'
        ? 'לחץ על Authorize Vercel כדי לאשר את החשבון שלך. אין צורך להעתיק טוקן.'
        : 'האתר אינו רץ כעת ב־Vercel, לכן פרסום עותק אוטומטי אינו זמין.';
    $('#createVercelClaim').disabled = !transferReady || !c.authenticated;
    const counts = D.migrationSummary();
    $('#migrationSummary').textContent = `נתונים מקומיים להעברה: ${counts.products} מוצרים, ${counts.orders} הזמנות, ${counts.reviews} ביקורות, הגדרות ותוכן. רשומות בעלות אותו מזהה שכבר קיימות בפרויקט יישארו ללא שינוי.`;
  }
  async function listProjects() {
    status('טוען את הפרויקטים מהחשבון שלך…');
    const result = await D.api('projects');
    const select = $('#supabaseProject'); select.replaceChildren();
    for (const p of result.projects) {
      const option = new Option(`${p.name} · ${p.status === 'ACTIVE_HEALTHY' ? 'פעיל' : 'בהקמה או מושהה'}`, p.ref);
      option.disabled = p.status !== 'ACTIVE_HEALTHY'; select.add(option);
    }
    const org = $('#supabaseOrganization'); org.replaceChildren();
    result.organizations.forEach(o => org.add(new Option(o.name, o.slug)));
    $('#projectChooser').hidden = false;
    status(result.projects.length ? 'בחר פרויקט קיים או צור פרויקט חדש. עד להפעלה, חיבור קיים של האתר ימשיך לפעול.' : 'אין פרויקטים בחשבון המחובר. אפשר ליצור פרויקט חדש.');
  }
  async function runCustomerConnection() {
    const config = D.config || {}, hosting = config.hosting || {};
    if (config.mode === 'cloud') {
      status('האתר מחובר ל־Supabase ול־Vercel. החיבור נשמר גם לאחר סגירת הדפדפן.');
      return;
    }
    if (!hosting.authorized) {
      status('מעביר אותך לאישור Vercel. מיד לאחריו נמשיך אוטומטית לאישור Supabase…');
      location.assign((await D.api('vercel-oauth-start', { next:'supabase' })).url);
      return;
    }
    let result;
    try { result = await D.api('projects'); }
    catch {
      status('מעביר אותך לאישור Supabase…');
      location.assign((await D.api('oauth-start', {})).url);
      return;
    }
    const active = result.projects.filter(project => project.status === 'ACTIVE_HEALTHY');
    const project = active.find(item => /romtech/i.test(item.name)) || active[0];
    if (!project) {
      const organization = result.organizations[0];
      if (!organization) throw new Error('לא נמצא ארגון זמין ב־Supabase עבור יצירת הפרויקט.');
      creationId ||= crypto.randomUUID();
      status('יוצר אוטומטית פרויקט RomTech בחשבון Supabase. ההקמה עשויה להימשך כמה דקות…');
      await D.api('create-project', { name:'RomTech', organization:organization.slug, confirmCosts:true, requestId:creationId });
      status('פרויקט RomTech נוצר. כשהוא יסיים הקמה, לחץ שוב על אותו כפתור כדי להמשיך.');
      return;
    }
    status('מכין את Supabase: טבלאות, הרשאות ואחסון תמונות…');
    const setup = await D.api('provision', { ref:project.ref });
    await D.api('activate', { generation:setup.connection.generation });
    await D.refresh();
    window.dispatchEvent(new Event('romtech-data-changed'));
    status(`האתר מחובר ומוכן · ${setup.connection.name}`);
  }
  document.addEventListener('DOMContentLoaded', async () => {
    await D.ready;
    if (!$('#connectionPanel')) return;
    update();
    $('#connectSupabase').addEventListener('click', e => busy(e.currentTarget, async () => {
      status('מעביר אותך להתחברות המאובטחת ב־Supabase…');
      location.assign((await D.api('oauth-start', {})).url);
    }));
    $('#startCustomerConnection').addEventListener('click', e => busy(e.currentTarget, runCustomerConnection));
    $('#deleteCustomerProject').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!confirm('האם אתה בטוח? הפעולה תמחק לצמיתות את פרויקט Supabase המחובר ואת עותק ה־Vercel שנוצר דרך RomTech. לא ניתן לשחזר נתונים לאחר המחיקה.')) return;
      status('מוחק את פרויקט Supabase ואת עותק Vercel…');
      await D.api('delete-customer-project', { confirmDelete:true });
      await D.refresh();
      status('הפרויקטים נמחקו והאתר נותק.');
    }));
    $('#refreshProjects').addEventListener('click', e => busy(e.currentTarget, listProjects));
    $('#createProject').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!$('#projectCostConsent').checked) throw new Error('יש לאשר יצירת פרויקט לפי תנאי ומכסת החשבון.');
      creationId ||= crypto.randomUUID();
      status('שולח בקשת יצירת פרויקט. ההקמה ב־Supabase עשויה להימשך כמה דקות…');
      const project = await D.api('create-project', { name: $('#newProjectName').value, organization: $('#supabaseOrganization').value, confirmCosts:true, requestId:creationId });
      status(`הפרויקט ${project.name} נוצר. המתן עד שיהיה פעיל ואז לחץ על רענן פרויקטים. אין צורך ליצור אותו שוב.`);
    }));
    $('#setupProject').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!$('#supabaseProject').value) throw new Error('בחר פרויקט פעיל מהרשימה.');
      status('מכין טבלאות, הרשאות ואחסון תמונות, ובודק את החיבור…');
      const result = await D.api('provision', { ref: $('#supabaseProject').value });
      pending = result.connection;
      status(`הפרויקט ${pending.name} מוכן והבדיקות עברו. לחץ על הפעל חיבור כדי להעביר אליו את האתר. נתוני הפרויקט הקודם לא יימחקו.`);
    }));
    $('#activateProject').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!pending) return;
      await D.api('activate', { generation:pending.generation }); pending = null;
      await D.refresh(); $('#projectChooser').hidden = true;
      window.dispatchEvent(new Event('romtech-data-changed'));
      status('האתר מחובר. הנתונים משותפים לכל המכשירים. אפשר כעת להעביר את הנתונים המקומיים מהדפדפן הזה.');
    }));
    $('#checkConnection').addEventListener('click', e => busy(e.currentTarget, async () => {
      status('בודק טבלאות, גישה לקטלוג, פרטיות הזמנות ואחסון תמונות…');
      const result = await D.api('health');
      status(`כל בדיקות החיבור עברו בהצלחה · ${new Date(result.checkedAt).toLocaleString('he-IL')}`);
    }));
    $('#disconnectSupabase').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!confirm('לנתק את האתר מהפרויקט? הקטלוג וקבלת הזמנות יושבתו עד לחיבור מחדש. הנתונים ב־Supabase לא יימחקו.')) return;
      await D.api('disconnect', { generation:D.config.connection.generation }); await D.refresh();
      window.dispatchEvent(new Event('romtech-data-changed')); status('האתר נותק. נתוני הפרויקט נשמרו ב־Supabase. ניתן לחבר אותו שוב או לבחור פרויקט אחר.');
    }));
    $('#authorizeVercel').addEventListener('click', e => busy(e.currentTarget, async () => {
      status('מעביר אותך לאישור המאובטח של Vercel…');
      location.assign((await D.api('vercel-oauth-start', {})).url);
    }));
    $('#publishVercelRelease').addEventListener('click', e => busy(e.currentTarget, async () => {
      const release = await D.api('vercel-publish-release', {});
      await D.refresh();
      status(`הגרסה אושרה ללקוחות · ${new Date(release.publishedAt).toLocaleString('he-IL')}`);
    }));
    $('#createVercelClaim').addEventListener('click', e => busy(e.currentTarget, async () => {
      status('מפרסם עותק חדש בחשבון Vercel שאושר…');
      const claim = await D.api('vercel-deploy-copy', { name: $('#vercelCopyName').value });
      const link = $('#vercelClaimLink'); link.href = claim.url; link.hidden = false;
      $('#vercelTransferStatus').textContent = `העותק ${claim.project} נשלח לפרסום. פתח את האתר החדש לאחר שהבנייה מסתיימת.`;
      status('העותק נוצר בחשבון Vercel שאושר.');
    }));
    $('#migrateLocal').addEventListener('click', e => busy(e.currentTarget, async () => {
      if (!confirm($('#migrationSummary').textContent + '\nלהעביר כעת? הגיבוי המקומי יישמר.')) return;
      const labels = {products:'מוצרים',orders:'הזמנות',reviews:'ביקורות',settings:'הגדרות',content:'עמודי תוכן'};
      await D.migrate((entity,done,total) => status(`מעביר ${labels[entity]}: ${done} מתוך ${total}…`));
      window.dispatchEvent(new Event('romtech-data-changed'));
      status('ההעברה הושלמה. רשומות קיימות לא הוחלפו והנתונים המקומיים נשמרו כגיבוי.');
    }));
    window.addEventListener('romtech-data-changed', update);
    const result = new URLSearchParams(location.search).get('supabase');
    if (result) {
      document.querySelector('[data-module="connection"]')?.click();
      history.replaceState(null,'',location.pathname);
      if (result === 'connected') await busy($('#startCustomerConnection'), runCustomerConnection);
      else status('החיבור בוטל, פג או לא הושלם. לחץ שוב על חבר Supabase.', true);
    }
    if (new URLSearchParams(location.search).get('vercel') === 'returned') {
      document.querySelector('[data-module="connection"]')?.click();
      history.replaceState(null,'',location.pathname);
      status('חזרת מ־Vercel. העותק החדש נפרס בחשבון שאושר.', false);
    }
    if (new URLSearchParams(location.search).get('vercel') === 'authorized') {
      document.querySelector('[data-module="connection"]')?.click();
      const next = new URLSearchParams(location.search).get('next');
      history.replaceState(null,'',location.pathname);
      if (next === 'supabase') {
        status('חשבון Vercel אושר. מעביר אותך לחיבור Supabase…');
        location.assign((await D.api('oauth-start', {})).url);
      } else status('חשבון Vercel אושר. אפשר לפרסם עכשיו עותק חדש.', false);
    }
    if (new URLSearchParams(location.search).get('vercel') === 'error') {
      document.querySelector('[data-module="connection"]')?.click();
      history.replaceState(null,'',location.pathname);
      status('החיבור ל־Vercel לא הושלם. בדוק שהאינטגרציה פעילה ושיש לה הרשאת Project Read/Write.', true);
    }
  });
})();
