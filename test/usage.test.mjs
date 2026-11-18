import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import {parseUsage,mapRequests,normalizeId,UsageSource} from '../data.mjs';
const code=await readFile(new URL('../vendor/statusline.js',import.meta.url),'utf8');
const ctx=vm.createContext({Date,document:{documentElement:{lang:'zh-CN'}},navigator:{language:'zh-CN'}});
vm.runInContext(code+'\nthis.calc={snapshot:codexPlusUsageSnapshot,decode:codexPlusUsageDecodeRate,ttft:codexPlusUsageFirstTokenMs,display:codexPlusUsageSpeedDisplay};',ctx);
const id='test-thread-001';
function count(t,turn,total,last={input_tokens:1000,cached_input_tokens:800,output_tokens:100,total_tokens:1100}) {
 return JSON.stringify({timestamp:t,type:'event_msg',payload:{type:'token_count',info:{last_token_usage:last,total_token_usage:{output_tokens:total},model_context_window:10000}}});
}
test('upstream speed math, cache and context remain intact',()=>{
 const requests=mapRequests([{agent:'codex',session:id,status:200,out:100,ms:3000,ttft_ms:1000},{agent:'codex',session:id,status:200,out:900,ms:4000,ttft_ms:1000},{agent:'codex',session:'other-thread',status:200,out:9999,ms:1000,ttft_ms:1}]);
 assert.equal(ctx.calc.decode(requests,id),200);
 assert.equal(ctx.calc.ttft(requests,id),1000);
 const events=parseUsage(JSON.stringify({type:'turn_context',payload:{turn_id:'turn1'}})+'\n'+count(new Date().toISOString(),null,100));
 const snapshot=ctx.calc.snapshot({threadId:id,events,requests});
 assert.equal(snapshot.cache,80);assert.equal(snapshot.context,11);assert.equal(snapshot.decodeSpeed,200);
});
test('rollout tail keeps turn boundaries and repairs truncated initial turn',()=>{
 const text='partial line\n'+count('2026-11-17T12:00:00Z',null,100)+'\n'+JSON.stringify({type:'event_msg',payload:{type:'task_complete',turn_id:'old'}})+'\n'+JSON.stringify({type:'event_msg',payload:{type:'task_started',turn_id:'new'}})+'\n'+count('2026-11-17T12:00:20Z',null,200)+'\n'+count('2026-11-17T12:00:25Z',null,300)+'\n{"incomplete":';
 const events=parseUsage(text,20);
 assert.deepEqual(events.map(e=>e.turn_id),['old','new','new']);
 assert.equal(ctx.calc.snapshot({events}).outputThroughput,20);
});
test('missing first-token timing and failed samples never invent decode TPS',()=>{
 const rows=[{agent:'codex',session:id,status:200,out:100,ms:3000},{agent:'codex',session:id,status:500,out:500,ms:2000,ttft_ms:500},{agent:'codex',session:id,status:200,out:500,ms:1001,ttft_ms:1000}];
 assert.equal(ctx.calc.decode(mapRequests(rows),id),null);
 assert.equal(ctx.calc.display({decodeSpeed:null,outputThroughput:12.5}).source,'throughput');
});
test('strict thread IDs; endpoint allowlist',async()=>{
 assert.equal(normalizeId('../../secrets'),'');assert.equal(normalizeId('local:'+id),id);
 await assert.rejects(new UsageSource().call('/settings/set',{}),/Unsupported/);
});
test('reads normal and Windows namespaced rollout paths within CODEX_HOME', async () => {
 const tempRoot = await realpath(os.tmpdir());
 const fixture = await mkdtemp(path.join(tempRoot, 'ribbon-usage-'));
 const root = path.join(fixture, 'profile');
 const outside = path.join(fixture, 'outside.jsonl');
 const source = new UsageSource(root);
 try {
  await mkdir(root);
  const current = path.join(root, 'current.jsonl');
  const event = count(new Date().toISOString(), null, 100);
  await Promise.all([writeFile(current, event), writeFile(outside, event)]);
  const db = new DatabaseSync(path.join(root, 'state_5.sqlite'));
  try {
   db.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL)');
   const insert = db.prepare('INSERT INTO threads VALUES (?, ?)');
   insert.run('normal-thread', current);
   insert.run('namespaced-thread', path.toNamespacedPath(current));
   insert.run('external-thread', path.toNamespacedPath(outside));
  } finally { db.close(); }
  for (const thread of ['normal-thread', 'namespaced-thread']) {
   const usage = await source.live(thread);
   assert.equal(usage.status, 'ok');
   assert.equal(usage.events[0].cached_input_tokens, 800);
  }
  assert.deepEqual(await source.live('external-thread'), {status:'unavailable',events:[]});
 } finally {
  source.close();
  if (path.dirname(await realpath(fixture)) === tempRoot) await rm(fixture, {recursive:true,force:true});
 }
});
test('live local source returns only allowed usage fields and maps current thread',async()=>{
 const src=new UsageSource();await src.init();
 try{
  const row=src.db.prepare('SELECT id FROM threads ORDER BY updated_at DESC LIMIT 1').get();
  const result=await src.live(row.id);assert.equal(result.status,'ok');assert.ok(result.events.length>0);
  for(const e of result.events)for(const k of Object.keys(e))assert.ok(['t','context_window','turn_output_tokens','turn_id','input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'].includes(k));
  const requests=await src.recent();assert.equal(requests.status,'ok');assert.ok(requests.entries.some(e=>e.threadId===row.id));
 }finally{src.close();}
});
