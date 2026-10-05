import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provider } from '../server/supabase.mjs';
const c={url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_test',secretKey:'sb_secret_hidden'};
test('provider health uses public credentials for public checks and rejects readable orders',async()=>{
  let publicOrders=false;const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    if(url.includes('romtech_schema'))return Response.json([{version:1}]);
    if(url.includes('/bucket/'))return Response.json({public:true,file_size_limit:2097152,allowed_mime_types:['image/webp']});
    if(url.includes('romtech_orders')&&options.headers.apikey===c.publishableKey)return new Response('denied',{status:publicOrders?200:401});
    return Response.json([]);
  };
  const p=provider(fetcher);assert.equal((await p.health(c)).ok,true);
  assert.ok(calls.some(x=>x.url.includes('romtech_orders')&&x.options.headers.apikey===c.publishableKey));
  assert.ok(calls.some(x=>x.url.includes('romtech_schema')&&x.options.headers.apikey===c.secretKey));
  assert.ok(calls.every(x=>!x.options.headers.Authorization));
  publicOrders=true;await assert.rejects(p.health(c),error=>error.code==='privacy_check_failed');
});
test('provider paginates even when PostgREST row cap is below requested page size and sanitizes errors',async()=>{
  const dataset=Array.from({length:203},(_,i)=>({id:String(i),data:{}})),offsets=[];
  const p=provider(async(url)=>{const offset=Number(new URL(url).searchParams.get('offset'));offsets.push(offset);return Response.json(dataset.slice(offset,offset+100))});
  assert.equal((await p.rows(c,'products',false)).length,203);assert.deepEqual(offsets,[0,100,200,203]);
  const failed=provider(async()=>Response.json({message:'secret credential sb_secret_abc and SQL details'},{status:500}));
  await assert.rejects(failed.rest(c,'romtech_products'),error=>!error.message.includes('sb_secret_abc')&&error.code==='supabase_error');
});
