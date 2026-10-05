import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { webHandler } from '../server/web-handler.mjs';
import { createApp } from '../server/app.mjs';
import { execFileSync } from 'node:child_process';
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
  // Match serverless runtimes that explicitly disable CommonJS require(esm).
  execFileSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e',
    "import handler from './api/romtech.js'; const headers={}; let body; const res={setHeader(k,v){headers[k]=v},end(v){body=v}}; await handler({url:'/api/romtech?action=config',method:'GET',headers:{},socket:{}},res); if(res.statusCode!==200 || JSON.parse(body).mode!=='local') throw new Error(body);"
  ], { env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('ROMTECH_') && !key.startsWith('SUPABASE_') && !key.startsWith('UPSTASH_'))) });
  const files=await readdir('dist');
  for(const privateName of ['server','api','tests','scripts','node_modules','.env.example','.env.local','package.json','netlify','docs'])assert.ok(!files.includes(privateName),privateName);
  for(const name of files.filter(f=>/\.(js|html)$/.test(f))) {
    const text=await readFile(`dist/${name}`,'utf8');
    assert.ok(!/sb_secret_|management-private-test|oauth-private-test|ROMTECH_ENCRYPTION_KEY/.test(text),name);
  }
});
test('Vercel Upstash integration variable names are accepted automatically',async()=>{
  const app=createApp({store:{get:async()=>null},env:{
    ROMTECH_ORIGIN:'https://site.test',ROMTECH_STORE_PREFIX:'alias-test',
    KV_REST_API_URL:'https://store.invalid',KV_REST_API_TOKEN:'token',
    ROMTECH_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),
    ROMTECH_OWNER_PASSWORD_HASH:'salt:'+''.padEnd(128,'0')
  }});
  const req={url:'/api/romtech?action=config',method:'GET',headers:{},socket:{}};
  let body='';const res={statusCode:200,setHeader(){},end(value){body=value}};
  await app(req,res);
  assert.equal(JSON.parse(body).serverReady,true);
});
