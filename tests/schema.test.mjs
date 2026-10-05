import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers.mjs';
import { schemaSQL } from '../server/supabase.mjs';
test('real Postgres schema: RLS, private costs/orders, anonymous writes, conflicts and retry-safe migration',async()=>{
  const db=await database();
  try{
    await db.exec(schemaSQL);await db.exec(schemaSQL);
    await db.exec('set role service_role');
    const insert=(entity,changes,importMode=false)=>db.query('select romtech_apply_patch($1,$2,$3,$4)',[entity,JSON.stringify(changes),'[]',importMode]);
    await insert('products',[
      {id:'visible',data:{id:'visible',name:'Public',price:500,status:'published'},cost:100},
      {id:'draft',data:{id:'draft',name:'Private',status:'draft'},cost:99}
    ]);
    await insert('orders',[{id:'private-order',data:{customerName:'Private Customer',phone:'0555555555'}}]);
    await insert('reviews',[{id:'approved',data:{status:'approved'}},{id:'pending',data:{status:'pending'}}]);
    await db.exec('set role anon');
    assert.deepEqual((await db.query('select id,data from romtech_products')).rows.map(x=>x.id),['visible']);
    assert.deepEqual((await db.query('select id from romtech_reviews')).rows.map(x=>x.id),['approved']);
    await assert.rejects(db.query('select cost from romtech_products'),/permission denied/);
    await assert.rejects(db.query('select * from romtech_orders'),/permission denied/);
    await assert.rejects(insert('products',[{id:'attack',data:{status:'published'}}]),/permission denied/);
    await assert.rejects(db.query("insert into romtech_reviews(id,data) values ('attack','{}')"),/permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from romtech_orders'),/permission denied/);
    await assert.rejects(insert('products',[{id:'attack',data:{}}]),/permission denied/);
    await db.exec('set role service_role');
    const rev=(await db.query("select revision from romtech_products where id='visible'")).rows[0].revision;
    await insert('products',[{id:'visible',revision:rev,data:{id:'visible',name:'Updated',status:'published'},cost:111}]);
    await assert.rejects(insert('products',[{id:'visible',revision:rev,data:{name:'Stale'},cost:0}]),/ROMTECH_CONFLICT/);
    // A later conflict rolls back earlier records in the same patch.
    await assert.rejects(insert('products',[{id:'aaa-new',data:{name:'Must roll back'},cost:0},{id:'visible',revision:rev,data:{name:'Stale'}}]),/ROMTECH_CONFLICT/);
    assert.equal((await db.query("select count(*)::int as n from romtech_products where id='aaa-new'")).rows[0].n,0);
    await insert('products',[{id:'visible',data:{name:'Old local data'},cost:0},{id:'imported',data:{name:'Imported'},cost:20}],true);
    await insert('products',[{id:'imported',data:{name:'Repeat'},cost:999}],true);
    assert.equal((await db.query("select data->>'name' as name from romtech_products where id='visible'")).rows[0].name,'Updated');
    assert.equal((await db.query("select cost from romtech_products where id='imported'")).rows[0].cost,'20');
    const rls=await db.query("select relname,relrowsecurity from pg_class where relname like 'romtech_%' and relkind='r'");
    assert.equal(rls.rows.length,6);assert.ok(rls.rows.every(x=>x.relrowsecurity));
    const funcs=await db.query("select prosecdef from pg_proc where proname='romtech_apply_patch'");assert.equal(funcs.rows[0].prosecdef,false);
  }finally{await db.close()}
});
