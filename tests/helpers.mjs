import { PGlite } from '@electric-sql/pglite';
import { AppError, passwordHash } from '../server/security.mjs';
import { schemaSQL, BUCKET } from '../server/supabase.mjs';
export const REF = 'abcdefghijklmnopqrst';
export const REF2 = 'tsrqponmlkjihgfedcba';
export const PASSWORD = 'test-owner-password-123';
export const testEnv = {
  ROMTECH_ORIGIN:'http://127.0.0.1:4173',ROMTECH_STORE_PREFIX:'test',UPSTASH_REDIS_REST_URL:'https://store.invalid',
  UPSTASH_REDIS_REST_TOKEN:'redis-private-test',ROMTECH_ENCRYPTION_KEY:Buffer.alloc(32,17).toString('base64'),
  ROMTECH_OWNER_PASSWORD_HASH:passwordHash(PASSWORD),SUPABASE_OAUTH_CLIENT_ID:'oauth-client-test',SUPABASE_OAUTH_CLIENT_SECRET:'oauth-private-test',VERCEL:'1',VERCEL_PROJECT_ID:'prj_test',VERCEL_ACCESS_TOKEN:'vercel-private-test'
};
export function mockHosting() {
  const calls=[];
  return { calls, ready:()=>true, releaseSha:()=> 'abcdef1234567', async createClaim(returnUrl) { calls.push({returnUrl}); return {url:`https://vercel.com/claim-deployment?code=claim-code-test&returnUrl=${encodeURIComponent(returnUrl)}`,expiresAt:'2030-01-01T00:00:00.000Z'}; } };
}
export function memoryStore() {
  const items=new Map(),locks=new Set(),rates=new Map();
  const get=name=>{const v=items.get(name);if(v?.expires<Date.now()){items.delete(name);return null}return v?structuredClone(v.value):null};
  return {
    items,async get(name){return get(name)},async take(name){const value=get(name);items.delete(name);return value},
    async set(name,value,ttl){items.set(name,{value:structuredClone(value),expires:ttl?Date.now()+ttl*1000:Infinity})},
    async del(name){items.delete(name)},async rate(name,max){const count=(rates.get(name)||0)+1;rates.set(name,count);if(count>max)throw new AppError(429,'rate_limit','Too many requests')},
    async lock(name,fn){if(locks.has(name))throw new AppError(409,'busy','Busy');locks.add(name);try{return await fn()}finally{locks.delete(name)}}
  };
}
export async function database() {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;`);
  return db;
}
export async function mockProvider() {
  const databases=new Map(),buckets=new Map(),projects=[{id:REF,name:'RomTech test',status:'ACTIVE_HEALTHY'},{id:REF2,name:'RomTech replacement',status:'ACTIVE_HEALTHY'}];
  const calls=[],keys=[], state={failHealth:false,failQuery:false,failWrites:false};
  let chain=Promise.resolve();
  async function run(ref,admin,fn) {
    const operation=chain.then(async()=>{
      let db=databases.get(ref);if(!db){db=await database();databases.set(ref,db)}
      await db.exec(`set role ${admin?'service_role':'anon'}`);
      try{return await fn(db)}finally{await db.exec('reset role')}
    });chain=operation.catch(()=>{});return operation;
  }
  const p={
    state,calls,databases,buckets,projects,
    async request(url,options){calls.push({url,options});if(url.endsWith('/oauth/token'))return {access_token:'management-private-test',refresh_token:'refresh-private-test',expires_in:3600};if(url.includes('/storage/v1/object/'))return {Key:'ok'};throw new Error('Unexpected request '+url)},
    async management(token,path,body,method){
      calls.push({path,body,token,method});
      if(path==='/projects'&&!body)return projects;
      if(path==='/organizations')return [{slug:'test-org',name:'Test org'}];
      if(path==='/projects'&&body){const project={id:'zzzzzzzzzzzzzzzzzzzz',name:body.name,status:'ACTIVE_HEALTHY'};projects.push(project);return project}
      const ref=path.split('/')[2];
      if(method==='DELETE'&&path===`/projects/${ref}`){const index=projects.findIndex(project=>project.id===ref);if(index>=0)projects.splice(index,1);return null}
      if(path.endsWith('/database/query')){
        if(state.failQuery)throw new AppError(502,'supabase_error','Cannot query');
        let db=databases.get(ref);if(!db){db=await database();databases.set(ref,db)}
        await db.exec(body.query);return [];
      }
      if(path.includes('/api-keys')){
        if(body){const k={...body,id:body.name,api_key:body.type==='publishable'?'sb_publishable_public_test':'sb_secret_private_test'};keys.push(k);return k}
        return keys;
      }
      throw new Error('Unexpected management '+path);
    },
    headers(){return {apikey:'sb_secret_private_test'}},
    async storage(c,path,method='GET',body){
      if(path==='bucket'&&method==='GET')return buckets.get(c.ref)?[buckets.get(c.ref)]:[];
      if(path==='bucket'&&method==='POST'){buckets.set(c.ref,body);return body}
      if(path===`bucket/${BUCKET}`)return buckets.get(c.ref);
      throw new Error('Unexpected storage');
    },
    async rows(c,entity,admin){return run(c.ref,admin,async db=>(await db.query(`select id,data,revision,updated_at${entity==='products'&&admin?',cost':''} from public.romtech_${entity} order by id`)).rows)},
    async rest(c,path,admin=false,body){
      if(state.failWrites&&body)throw new AppError(503,'network_error','Write unavailable');
      return run(c.ref,admin,async db=>{
        if(path==='rpc/romtech_apply_patch'){
          try{await db.query('select public.romtech_apply_patch($1,$2,$3,$4)',[body.p_entity,JSON.stringify(body.p_changes),JSON.stringify(body.p_deletes),body.p_import]);return null}
          catch(e){if(['40001','23505'].includes(e.code))throw new AppError(409,'conflict','הנתונים השתנו במכשיר אחר. רענן ובצע מחדש את השינוי.');throw e}
        }
        if(path.startsWith('romtech_products?id=eq.'))return (await db.query('select id,data from public.romtech_products where id=$1',[path.split('eq.')[1].split('&')[0]])).rows;
        throw new Error('Unexpected REST '+path);
      });
    },
    async health(c){
      if(state.failHealth)throw new AppError(409,'health_failed','Health check failed');
      const version=await run(c.ref,true,async db=>(await db.query('select version from public.romtech_schema')).rows[0]?.version);
      if(version!==1||!buckets.get(c.ref)?.public)throw new AppError(409,'health_failed','Health check failed');
      return {ok:true,checkedAt:new Date().toISOString(),checks:['schema','tables','catalog','order-privacy','storage']};
    },
    async close(){for(const db of databases.values())await db.close()}
  };
  return p;
}
export const product = (id='rt-001',status='published') => ({id,name:'שטריימל בדיקה',short:'תיאור',full:'תיאור מלא',price:500,salePrice:null,cost:200,stock:3,status,images:[],tags:[]});
export async function invoke(app,action,{method,body,session,origin=testEnv.ROMTECH_ORIGIN,query='',ip='127.0.0.1'}={}) {
  const headers={origin,'content-type':'application/json',...(session?{cookie:session}:{})};
  const req={url:`/api/romtech?action=${action}${query}`,method:method||(['config','projects','snapshot','session','health','oauth-callback'].includes(action)?'GET':'POST'),headers,body,socket:{remoteAddress:ip}};
  const result={headers:{}};
  const res={statusCode:200,setHeader(k,v){result.headers[k.toLowerCase()]=v},end(value){result.status=this.statusCode;result.text=value||'';try{result.body=JSON.parse(value)}catch{}}};
  await app(req,res);return result;
}
