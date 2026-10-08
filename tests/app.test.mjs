import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { encryption, digest, passwordMatches, passwordHash } from '../server/security.mjs';
import { createStore } from '../server/store.mjs';
import { memoryStore, mockProvider, mockHosting, testEnv, invoke, PASSWORD, REF, REF2, product } from './helpers.mjs';
async function fixture() {
  const store=memoryStore(),p=await mockProvider(),hosting=mockHosting(),app=createApp({env:testEnv,store,supabase:p,hosting});
  const login=await invoke(app,'login',{body:{password:PASSWORD}});
  const session=login.headers['set-cookie'].split(';')[0],sid=digest(session.split('=')[1]);
  async function authorize(){
    const start=await invoke(app,'oauth-start',{session,body:{}});assert.equal(start.status,200);
    const authorize=new URL(start.body.url);assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
    const response=await invoke(app,'oauth-callback',{session,query:`&code=test-code&state=${authorize.searchParams.get('state')}`});
    assert.equal(response.status,303);assert.equal(response.headers.location,'/admin/?supabase=connected');return authorize;
  }
  async function connect(ref=REF){await authorize();const setup=await invoke(app,'provision',{session,body:{ref}});assert.equal(setup.status,200,setup.text);const activate=await invoke(app,'activate',{session,body:{generation:setup.body.connection.generation}});assert.equal(activate.status,200);return activate.body.connection}
  return {store,p,hosting,app,session,sid,authorize,connect};
}
test('secure owner login, origin validation, cookie, encrypted durable store and rate limit',async()=>{
  const f=await fixture();
  try{
    assert.equal((await invoke(f.app,'login',{body:{password:'1234'}})).status,401);
    assert.equal((await invoke(f.app,'login',{body:{password:PASSWORD},origin:'https://evil.example'})).status,403);
    assert.equal((await invoke(f.app,'oauth-start',{body:{}})).status,401);
    assert.match((await invoke(f.app,'login',{body:{password:PASSWORD}})).headers['set-cookie'],/HttpOnly; SameSite=Lax/);
    assert.equal((await invoke(f.app,'session',{session:'rt_owner=forged'})).status,401);
    const crypt=encryption(testEnv),secret={token:'never-in-browser',key:'sb_secret_hidden'},sealed=crypt.seal(secret);
    assert.ok(!sealed.includes(secret.token));assert.deepEqual(crypt.open(sealed),secret);
    assert.throws(()=>crypt.open(sealed.slice(0,-8)+'AAAAAAAA'));
    const commands=[],redis=new Map();
    const fakeFetch=async(_,options)=>{const args=JSON.parse(options.body);commands.push(args);if(args[0]==='SET')redis.set(args[1],args[2]);return new Response(JSON.stringify({result:args[0]==='GET'?redis.get(args[1]):'OK'}),{status:200})};
    const one=createStore(testEnv,fakeFetch),two=createStore(testEnv,fakeFetch);
    await one.set('connection',secret);assert.deepEqual(await two.get('connection'),secret);assert.ok(!JSON.stringify(commands).includes('never-in-browser'));
    for(let i=0;i<12;i++)await invoke(f.app,'login',{body:{password:'wrong'},ip:'different-ip'});
    assert.equal((await invoke(f.app,'login',{body:{password:PASSWORD},ip:'different-ip'})).status,429);
  }finally{await f.p.close()}
});
test('OAuth state/PKCE is single-use, session-bound and cancellable; secrets never serialized',async()=>{
  const f=await fixture();
  try{
    const authorize=await f.authorize();
    assert.match(authorize.href,/https:\/\/api.supabase.com\/v1\/oauth\/authorize/);
    const repeated=await invoke(f.app,'oauth-callback',{session:f.session,query:`&state=${authorize.searchParams.get('state')}&code=test-code`});
    assert.equal(repeated.headers.location,'/admin/?supabase=error');
    const invalid=await invoke(f.app,'oauth-callback',{session:f.session,query:'&state=bad&code=test-code'});assert.equal(invalid.headers.location,'/admin/?supabase=error');
    const projects=await invoke(f.app,'projects',{session:f.session});assert.equal(projects.body.projects.length,2);
    assert.ok(!projects.text.includes('management-private-test'));
    const exchange=f.p.calls.find(x=>x.url?.endsWith('/oauth/token'));
    assert.ok(new URLSearchParams(exchange.options.body).get('code_verifier'));
    assert.ok(!JSON.stringify(await f.store.get(`oauth:${f.sid}`)).includes('refresh-private-test'));
  }finally{await f.p.close()}
});
test('Vercel ownership transfer creates one temporary claim link for the authenticated owner',async()=>{
  const f=await fixture();
  try{
    const config=await invoke(f.app,'config');
    assert.deepEqual(config.body.hosting,{provider:'vercel',transferReady:true,release:null});
    assert.equal((await invoke(f.app,'vercel-claim',{body:{confirmTransfer:true}})).status,401);
    assert.equal((await invoke(f.app,'vercel-claim',{session:f.session,body:{confirmTransfer:false}})).status,400);
    const first=await invoke(f.app,'vercel-claim',{session:f.session,body:{confirmTransfer:true}});
    assert.equal(first.status,200,first.text);assert.match(first.body.url,/^https:\/\/vercel\.com\/claim-deployment\?/);
    assert.equal(f.hosting.calls.length,1);assert.ok(!first.text.includes('vercel-private-test'));
    const repeat=await invoke(f.app,'vercel-claim',{session:f.session,body:{confirmTransfer:true}});
    assert.deepEqual(repeat.body,first.body);assert.equal(f.hosting.calls.length,1);
  }finally{await f.p.close()}
});
test('customer releases are explicitly approved and stored separately from main',async()=>{
  const f=await fixture();
  try{
    const published=await invoke(f.app,'vercel-publish-release',{session:f.session,body:{}});
    assert.equal(published.status,200,published.text);
    const config=await invoke(f.app,'config',{session:f.session});
    assert.ok(config.body.hosting.release?.publishedAt);
    assert.equal((await f.store.get('vercel-release')).sha,'abcdef1234567');
  }finally{await f.p.close()}
});
test('deleting a connected customer project requires confirmation and removes the active connection',async()=>{
  const f=await fixture();
  try{
    await f.connect();
    assert.equal((await invoke(f.app,'delete-customer-project',{session:f.session,body:{confirmDelete:false}})).status,400);
    const deleted=await invoke(f.app,'delete-customer-project',{session:f.session,body:{confirmDelete:true}});
    assert.equal(deleted.status,200,deleted.text);
    assert.equal((await invoke(f.app,'config')).body.mode,'local');
    assert.ok(f.p.calls.some(call=>call.method==='DELETE'&&call.path===`/projects/${REF}`));
  }finally{await f.p.close()}
});
test('full backend flow: provision, health, activation, migration, public orders/reviews, private admin and replacement',async()=>{
  const f=await fixture();
  try{
    const c=await f.connect();
    assert.match(c.publishableKey,/^sb_publishable_/);assert.ok(!JSON.stringify(c).includes('secret'));
    assert.equal((await invoke(f.app,'config')).body.mode,'cloud');
    assert.equal((await invoke(f.app,'patch',{body:{entity:'products',changes:[],deletes:[],generation:c.generation}})).status,401);
    const migrated=await invoke(f.app,'patch',{session:f.session,body:{entity:'products',changes:[{id:'rt-001',data:product()}],deletes:[],import:true,generation:c.generation}});
    assert.equal(migrated.status,200,migrated.text);
    const privateRows=await invoke(f.app,'snapshot',{session:f.session,query:'&admin=1'});assert.equal(privateRows.body.products.length,1);
    const publicRows=await invoke(f.app,'snapshot',{session:f.session});assert.ok(!('cost' in publicRows.body.products[0]));assert.ok(!('cost' in publicRows.body.products[0].data));
    const order=await invoke(f.app,'submit-order',{body:{generation:c.generation,record:{id:'ord-unique',productId:'rt-001',customerName:'Customer',phone:'0500000000',price:1,status:'completed',privacyConsent:true}}});assert.equal(order.status,200,order.text);
    const orders=(await invoke(f.app,'snapshot',{session:f.session,query:'&admin=1'})).body.orders;
    assert.equal(orders[0].data.price,500);assert.equal(orders[0].data.status,'new');
    assert.deepEqual((await invoke(f.app,'snapshot')).body.orders,[]);
    const review=await invoke(f.app,'submit-review',{body:{generation:c.generation,record:{id:'rev-unique',productId:'rt-001',name:'Reviewer',rating:5,text:'Great',status:'pending'}}});assert.equal(review.status,200,review.text);
    assert.equal((await invoke(f.app,'snapshot')).body.reviews[0].data.status,'approved');
    assert.equal((await invoke(f.app,'health',{session:f.session})).status,200);
    // Failed replacement never takes the old project offline.
    await f.authorize();f.p.state.failHealth=true;
    assert.equal((await invoke(f.app,'provision',{session:f.session,body:{ref:REF2}})).status,409);
    assert.equal((await invoke(f.app,'config')).body.connection.ref,REF);
    f.p.state.failHealth=false;
    const c2=await f.connect(REF2);assert.equal(c2.ref,REF2);
    assert.equal((await invoke(f.app,'patch',{session:f.session,body:{generation:c.generation,entity:'products',changes:[],deletes:[]}})).status,409);
    assert.equal((await invoke(f.app,'disconnect',{session:f.session,body:{generation:c2.generation}})).status,200);
    assert.equal((await invoke(f.app,'config')).body.mode,'disconnected');
    assert.equal((await invoke(f.app,'snapshot')).status,409);
  }finally{await f.p.close()}
});
test('password change invalidates other sessions; project creation retries cannot create duplicates',async()=>{
  const f=await fixture();
  try{
    const other=(await invoke(f.app,'login',{body:{password:PASSWORD}})).headers['set-cookie'].split(';')[0];
    assert.equal((await invoke(f.app,'password',{session:f.session,body:{currentPassword:PASSWORD,password:'new-owner-password-123'}})).status,200);
    assert.equal((await invoke(f.app,'session',{session:other})).status,401);
    assert.equal((await invoke(f.app,'session',{session:f.session})).status,200);
    await f.authorize();
    const body={requestId:'one-create-request',organization:'test-org',name:'Buyer project',confirmCosts:true};
    const one=await invoke(f.app,'create-project',{session:f.session,body}),two=await invoke(f.app,'create-project',{session:f.session,body});
    assert.equal(one.status,200,one.text);assert.deepEqual(one.body,two.body);
    assert.equal(f.p.calls.filter(x=>x.path==='/projects'&&x.body).length,1);
    assert.equal((await invoke(f.app,'create-project',{session:f.session,body:{...body,requestId:'other',confirmCosts:false}})).status,400);
  }finally{await f.p.close()}
});
test('invalid HTML/images and provider failures are contained without credential leaks',async()=>{
  const f=await fixture();
  try{
    const c=await f.connect();
    const content=await invoke(f.app,'patch',{session:f.session,body:{generation:c.generation,entity:'content',changes:[{id:'faq',data:{title:'FAQ',body:'<p onclick="steal()">Hello<script>attack()</script><a href="javascript:attack()">link</a></p>'}}],deletes:[]}});
    assert.equal(content.status,200,content.text);assert.ok(!content.text.includes('onclick'));assert.ok(!content.text.includes('<script>'));assert.ok(!content.text.includes('javascript:'));
    assert.equal((await invoke(f.app,'upload',{session:f.session,body:{generation:c.generation,image:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
    f.p.state.failWrites=true;
    const failed=await invoke(f.app,'patch',{session:f.session,body:{generation:c.generation,entity:'products',changes:[{id:'rt-001',data:product()}],deletes:[]}});
    assert.equal(failed.status,503);assert.ok(!failed.text.includes('sb_secret_'));
    assert.equal(passwordMatches('x',passwordHash('x')),true);
  }finally{await f.p.close()}
});
