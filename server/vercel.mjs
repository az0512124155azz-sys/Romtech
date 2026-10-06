import { AppError } from './security.mjs';

const api = 'https://api.vercel.com';
const authorize = 'https://vercel.com/oauth/authorize';

export function vercelHosting(env, request = fetch) {
  const projectId = String(env.VERCEL_PROJECT_ID || '').trim();
  const teamId = String(env.VERCEL_TEAM_ID || '').trim();
  const clientId = String(env.VERCEL_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(env.VERCEL_OAUTH_CLIENT_SECRET || '').trim();
  const ready = () => !!(projectId && clientId && clientSecret);
  const fail = (status, code, message) => { throw new AppError(status, code, message); };
  return {
    ready,
    authorizeUrl(redirectUri, state) {
      if (!ready()) fail(503, 'vercel_setup_required', 'יש להשלים את הגדרת אפליקציית OAuth של Vercel לפני החיבור.');
      const url = new URL(authorize);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state }).toString();
      return url.href;
    },
    async exchange(code, redirectUri) {
      let response;
      try {
        response = await request(`${api}/login/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }) });
      } catch { fail(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.'); }
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.access_token !== 'string') fail(response.status === 401 ? 401 : 502, 'vercel_oauth_failed', 'Vercel לא אישר את החיבור. נסה שוב.');
      const lifetime = Math.min(Number(body.expires_in) || 30 * 24 * 3600, 30 * 24 * 3600);
      return { accessToken: body.access_token, expiresAt: Date.now() + lifetime * 1000 };
    },
    async createClaim(returnUrl, accessToken) {
      if (!ready()) fail(503, 'vercel_setup_required', 'יש להשלים את הגדרת אפליקציית OAuth של Vercel לפני יצירת קישור ללקוח.');
      if (!accessToken) fail(401, 'vercel_authorize_required', 'יש ללחוץ קודם על Authorize Vercel.');
      const endpoint = new URL(`${api}/projects/${encodeURIComponent(projectId)}/transfer-request`);
      if (teamId) endpoint.searchParams.set('teamId', teamId);
      let response;
      try { response = await request(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' }); }
      catch { fail(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.'); }
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(body.code)) {
        const message = response.status === 401 || response.status === 403 ? 'ההרשאה ל־Vercel פגה או אינה מספיקה. לחץ שוב על Authorize Vercel.' : response.status === 409 ? 'כבר נוצר קישור העברת בעלות פעיל. השתמש בקישור הקיים או נסה שוב לאחר שפג.' : 'Vercel לא הצליח ליצור קישור העברת בעלות. נסה שוב.';
        fail(response.status === 401 || response.status === 403 ? 403 : 502, 'vercel_transfer_failed', message);
      }
      const claim = new URL('https://vercel.com/claim-deployment');
      claim.search = new URLSearchParams({ code: body.code, returnUrl }).toString();
      return { url: claim.href, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
    }
  };
}
