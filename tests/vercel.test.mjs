import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vercelHosting } from '../server/vercel.mjs';

test('Vercel Integration install exchanges server-side credentials and creates a scoped claim', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/v2/oauth/access_token')) return new Response(JSON.stringify({ access_token:'vca_private', team_id:'team_installed' }), { status:200 });
    return new Response(JSON.stringify({ code:'claim-code-valid' }), { status:200 });
  };
  const hosting = vercelHosting({ VERCEL_PROJECT_ID:'prj_test', VERCEL_TEAM_ID:'team_fallback', VERCEL_INTEGRATION_SLUG:'romtech', VERCEL_OAUTH_CLIENT_ID:'oac_test', VERCEL_OAUTH_CLIENT_SECRET:'private' }, request);
  const install = new URL(hosting.authorizeUrl('https://romtech.example/api/romtech', 'state-test', 'unused'));
  assert.equal(install.href, 'https://vercel.com/integrations/romtech/new?state=state-test');
  const auth = await hosting.exchange('code-test', 'https://romtech.example/api/romtech', 'unused');
  assert.equal(calls[0].url, 'https://api.vercel.com/v2/oauth/access_token');
  assert.equal(new URLSearchParams(calls[0].options.body).get('code_verifier'), null);
  assert.equal(auth.teamId, 'team_installed');
  const claim = await hosting.createClaim('https://romtech.example/admin/', auth);
  assert.match(calls[1].url, /teamId=team_installed/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer vca_private');
  assert.match(claim.url, /^https:\/\/vercel\.com\/claim-deployment\?/);
});
