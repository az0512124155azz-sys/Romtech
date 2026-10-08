import { AppError } from './security.mjs';
import { templateFiles } from './template-source.mjs';

const api = 'https://api.vercel.com';
const authorize = 'https://vercel.com/oauth/authorize';

export function vercelHosting(env, request = fetch) {
  const projectId = String(env.VERCEL_PROJECT_ID || '').trim();
  const projectName = String(env.VERCEL_PROJECT_NAME || '').trim();
  const teamId = String(env.VERCEL_TEAM_ID || '').trim();
  const clientId = String(env.VERCEL_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(env.VERCEL_OAUTH_CLIENT_SECRET || '').trim();
  const integrationSlug = String(env.VERCEL_INTEGRATION_SLUG || '').trim();
  const templateRepository = String(env.ROMTECH_TEMPLATE_GITHUB_REPO_ID || '1397509289').trim();
  const integrationMode = !!integrationSlug;
  const ready = () => !!((projectId || projectName) && clientId && clientSecret && (!integrationMode || /^[a-z0-9-]{1,64}$/.test(integrationSlug)));
  const fail = (status, code, message) => { throw new AppError(status, code, message); };
  return {
    ready,
    releaseSha() {
      const sha = String(env.VERCEL_GIT_COMMIT_SHA || env.ROMTECH_TEMPLATE_GIT_SHA || '').trim();
      return /^[a-f0-9]{7,64}$/i.test(sha) ? sha : null;
    },
    authorizeUrl(redirectUri, state, codeChallenge) {
      if (!ready()) fail(503, 'vercel_setup_required', 'יש להשלים את הגדרת אפליקציית OAuth של Vercel לפני החיבור.');
      if (integrationMode) {
        const url = new URL(`https://vercel.com/integrations/${integrationSlug}/new`);
        url.searchParams.set('state', state);
        return url.href;
      }
      const url = new URL(authorize);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, code_challenge: codeChallenge, code_challenge_method: 'S256' }).toString();
      return url.href;
    },
    async exchange(code, redirectUri, codeVerifier) {
      let response;
      try {
        const body = integrationMode
          ? new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
          : new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, code_verifier: codeVerifier, redirect_uri: redirectUri });
        response = await request(`${api}${integrationMode ? '/v2/oauth/access_token' : '/login/oauth/token'}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      } catch { fail(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.'); }
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.access_token !== 'string') fail(response.status === 401 ? 401 : 502, 'vercel_oauth_failed', 'Vercel לא אישר את החיבור. נסה שוב.');
      const lifetime = Math.min(Number(body.expires_in) || 30 * 24 * 3600, 30 * 24 * 3600);
      return { accessToken: body.access_token, teamId: body.team_id || teamId || null, configurationId: body.configuration_id || null, expiresAt: Date.now() + lifetime * 1000 };
    },
    async createClaim(returnUrl, authorization) {
      if (!ready()) fail(503, 'vercel_setup_required', 'יש להשלים את הגדרת אפליקציית OAuth של Vercel לפני יצירת קישור ללקוח.');
      if (!authorization?.accessToken) fail(401, 'vercel_authorize_required', 'יש ללחוץ קודם על Authorize Vercel.');
      const sourceTeamId = authorization.teamId || teamId || null;
      const transferRequest = async (idOrName, scopedTeamId) => {
        const endpoint = new URL(`${api}/projects/${encodeURIComponent(idOrName)}/transfer-request`);
        if (scopedTeamId) endpoint.searchParams.set('teamId', scopedTeamId);
        return request(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${authorization.accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      };
      let response;
      try {
        for (const idOrName of [...new Set([projectId, projectName].filter(Boolean))]) {
          response = await transferRequest(idOrName, sourceTeamId);
          // Personal Vercel accounts do not always accept the installation team id.
          // A failed request has no side effect, so retry the documented unscoped form.
          if (!response.ok && sourceTeamId && (response.status === 400 || response.status === 404)) response = await transferRequest(idOrName, null);
          if (response.ok || response.status !== 404) break;
        }
      }
      catch { fail(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.'); }
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(body.code)) {
        console.error('Vercel transfer request failed', { status: response.status, scoped: Boolean(sourceTeamId), hasProjectName: Boolean(projectName) });
        const message = response.status === 401 || response.status === 403 ? 'ההרשאה ל־Vercel פגה או אינה מספיקה. לחץ שוב על Authorize Vercel.' : response.status === 404 ? 'לחשבון Vercel המחובר אין בעלות על הפרויקט. התחבר לחשבון בעל הפרויקט או בקש מבעליו להעביר אותו לחשבון שלך.' : response.status === 409 ? 'כבר נוצר קישור העברת בעלות פעיל. השתמש בקישור הקיים או נסה שוב לאחר שפג.' : 'Vercel לא הצליח ליצור קישור העברת בעלות. נסה שוב.';
        fail(response.status === 401 || response.status === 403 ? 403 : 502, 'vercel_transfer_failed', message);
      }
      const claim = new URL('https://vercel.com/claim-deployment');
      claim.search = new URLSearchParams({ code: body.code, returnUrl }).toString();
      return { url: claim.href, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
    },
    async deployCopy(name, authorization, release) {
      if (!authorization?.accessToken) fail(401, 'vercel_authorize_required', 'יש ללחוץ קודם על Authorize Vercel.');
      const project = String(name || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(project)) fail(400, 'vercel_project_name', 'בחר שם קצר באנגלית לפרויקט החדש.');
      let response;
      // A customer site is always pinned to a version explicitly released by its seller.
      // It must never follow the development branch in real time.
      const source = /^\d+$/.test(templateRepository) && /^[a-f0-9]{7,64}$/i.test(release?.sha || '')
        ? { gitSource:{ type:'github', repoId:Number(templateRepository), sha:release.sha } }
        : { files:templateFiles };
      try { response = await request(`${api}/v13/deployments`, { method:'POST', headers:{ Authorization:`Bearer ${authorization.accessToken}`, 'Content-Type':'application/json' }, body:JSON.stringify({ name:project, target:'production', ...source, projectSettings:{ framework:null, installCommand:'npm ci', buildCommand:'npm run build', outputDirectory:'dist', nodeVersion:'22.x' } }) }); }
      catch { fail(503, 'vercel_unavailable', 'לא ניתן להגיע ל־Vercel כרגע. נסה שוב בעוד רגע.'); }
      let body = {}; try { body = await response.json(); } catch {}
      if (!response.ok || typeof body.url !== 'string') fail(response.status === 401 || response.status === 403 ? 403 : 502, 'vercel_deploy_failed', response.status === 409 ? 'שם הפרויקט כבר קיים בחשבון Vercel.' : 'Vercel לא הצליח לפרסם את העותק. נסה שוב.');
      return { project:body.name || project, url:`https://${body.url}`, readyState:body.readyState || 'BUILDING' };
    }
  };
}
