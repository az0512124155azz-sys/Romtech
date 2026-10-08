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

test('Vercel retries an unscoped transfer request for a personal account', async () => {
  const calls = [];
  const request = async url => {
    calls.push(String(url));
    return calls.length === 1
      ? new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 })
      : new Response(JSON.stringify({ code: 'claim-code-valid' }), { status: 200 });
  };
  const hosting = vercelHosting({ VERCEL_PROJECT_ID:'prj_test', VERCEL_INTEGRATION_SLUG:'romtech', VERCEL_OAUTH_CLIENT_ID:'oac_test', VERCEL_OAUTH_CLIENT_SECRET:'private' }, request);
  await hosting.createClaim('https://romtech.example/admin/', { accessToken:'vca_private', teamId:'team_personal' });
  assert.match(calls[0], /teamId=team_personal/);
  assert.doesNotMatch(calls[1], /teamId=/);
});

test('Vercel uses the project name when its internal project ID is not transferable', async () => {
  const calls = [];
  const request = async url => {
    calls.push(String(url));
    return calls.length === 1
      ? new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 })
      : new Response(JSON.stringify({ code: 'claim-code-valid' }), { status: 200 });
  };
  const hosting = vercelHosting({ VERCEL_PROJECT_ID:'prj_test', VERCEL_PROJECT_NAME:'romtech', VERCEL_INTEGRATION_SLUG:'romtech', VERCEL_OAUTH_CLIENT_ID:'oac_test', VERCEL_OAUTH_CLIENT_SECRET:'private' }, request);
  await hosting.createClaim('https://romtech.example/admin/', { accessToken:'vca_private' });
  assert.match(calls[0], /projects\/prj_test\/transfer-request/);
  assert.match(calls[1], /projects\/romtech\/transfer-request/);
});

test('customer copy is pinned to an approved commit and never follows main', async () => {
  let deployment;
  const request = async (_url, options) => {
    deployment = JSON.parse(options.body);
    return new Response(JSON.stringify({ name:'customer-store', url:'customer-store.vercel.app', readyState:'BUILDING' }), { status:200 });
  };
  const hosting = vercelHosting({ VERCEL_PROJECT_ID:'prj_test', VERCEL_INTEGRATION_SLUG:'romtech', VERCEL_OAUTH_CLIENT_ID:'oac_test', VERCEL_OAUTH_CLIENT_SECRET:'private', ROMTECH_TEMPLATE_GITHUB_REPO_ID:'1397509289' }, request);
  await hosting.deployCopy('customer-store', { accessToken:'vca_private' }, { sha:'abcdef1234567' });
  assert.equal(deployment.gitSource.sha, 'abcdef1234567');
  assert.equal('ref' in deployment.gitSource, false);
});
