import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { webHandler } from '../server/web-handler.mjs';
import { createApp } from '../server/app.mjs';
test('web hosting adapter preserves origin, cookies, response and redirects',async()=>{
  const handler=webHandler(async(req,res)=>{
    assert.equal(req.headers.origin,'https://site.test');assert.equal(req.body.password,'secret');assert.equal(req.socket.remoteAddress,'1.2.3.4');
    res.setHeader('Set-Cookie','rt_owner=opaque; HttpOnly');res.setHeader('Cache-Control','no-store');res.statusCode=200;res.end('{"ok":true}');
  });
  const response=await handler(new Request('https://site.test/api/romtech?action=login',{method:'POST',headers:{origin:'https://site.test','Content-Type':'application/json'},body:'{"password":"secret"}'}),{ip:'1.2.3.4'});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.deepEqual(await response.json(),{ok:true});
  const offline=webHandler(createApp({env:{}}));assert.equal((await (await offline(new Request('https://site.test/api/romtech?action=config'))).json()).mode,'local');
  assert.equal((await offline(new Request('https://site.test/api/romtech?action=login',{method:'POST',body:'broken-json'}))).status,400);
});
test('public output contains no backend, environment files or test credentials',async()=>{
  await import('../scripts/build.mjs');
  const files=await readdir('dist');
  for(const privateName of ['server','api','tests','scripts','node_modules','.env.example','.env.local','package.json','netlify','docs'])assert.ok(!files.includes(privateName),privateName);
  for(const name of files.filter(f=>/\.(js|html)$/.test(f))) {
    const text=await readFile(`dist/${name}`,'utf8');
    assert.ok(!/sb_secret_|management-private-test|oauth-private-test|ROMTECH_ENCRYPTION_KEY/.test(text),name);
  }
});
