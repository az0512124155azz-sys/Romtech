import { AppError } from './security.mjs';

const api = 'https://api.vercel.com';

export function vercelHosting(env, request = fetch) {
  const projectId = String(env.VERCEL_PROJECT_ID || '').trim();
  const teamId = String(env.VERCEL_TEAM_ID || '').trim();
  const accessToken = String(env.VERCEL_ACCESS_TOKEN || '').trim();
  const ready = () => !!(projectId && accessToken);

  return {
    ready,
    async createClaim(returnUrl) {
      if (!ready()) throw new AppError(503, 'vercel_setup_required', 'יש להשלים פעם אחת את הגדרת העברת הבעלות ב־Vercel לפני יצירת קישור ללקוח.');
      const endpoint = new URL(`${api}/projects/${encodeURIComponent(projectId)}/transfer-request`);
      if (teamId) endpoint.searchParams.set('teamId', teamId);
      let response;
      try {
        response = await request(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      } catch {
        throw new AppError(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.');
      }
      let body = {};
      try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(body.code)) {
        const message = response.status === 401 || response.status === 403
          ? 'למפתח Vercel אין הרשאה להעביר את הפרויקט. בדוק שהוא שייך לבעלים של הפרויקט.'
          : response.status === 409
            ? 'כבר נוצר קישור העברת בעלות פעיל. השתמש בקישור הקיים או נסה שוב לאחר שיפוג.'
            : 'Vercel לא הצליח ליצור קישור העברת בעלות. בדוק את הגדרות Vercel ונסה שוב.';
        throw new AppError(response.status === 401 || response.status === 403 ? 403 : 502, 'vercel_transfer_failed', message);
      }
      const claim = new URL('https://vercel.com/claim-deployment');
      claim.search = new URLSearchParams({ code: body.code, returnUrl }).toString();
      return { url: claim.href, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
    }
  };
}
