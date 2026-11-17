import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import path from 'node:path';
import { UsageSource } from './data.mjs';
import { CDP } from './cdp.mjs';

const root=import.meta.dirname, port=Number(process.argv.find(x=>x.startsWith('--port='))?.split('=')[1]||9337);
const world='codex-usage-bar-only';
const code='(() => { if (window !== window.top || window.__usageBarOnly) return;\n'+await readFile(path.join(root,'vendor/statusline.js'),'utf8')+'\n'+await readFile(path.join(root,'adapter.js'),'utf8')+'\n})();';
const source=new UsageSource(); await source.init();
const clients=new Map(); let ending=false,misses=0;
await mkdir(path.join(root,'runtime'),{recursive:true});
const stateFile=path.join(root,'runtime',`host-${port}.json`),stopFile=path.join(root,'runtime',`stop-${port}`);
try {await unlink(stopFile);}catch{}

async function attach(target) {
  const c=new CDP(target.webSocketDebuggerUrl);const state={c,contexts:new Set()};clients.set(target.id,state);
  c.on('closed',()=>clients.delete(target.id));
  c.on('Runtime.executionContextCreated',p=>{if(p.context.name===world)state.contexts.add(p.context.id);});
  c.on('Runtime.executionContextDestroyed',p=>state.contexts.delete(p.executionContextId));
  c.on('Runtime.executionContextsCleared',()=>state.contexts.clear());
  c.on('Runtime.bindingCalled',async p=>{
    if(p.name!=='__usageBarCall')return;
    let request;try{request=JSON.parse(p.payload);}catch{return;}
    if(!Number.isSafeInteger(request.id))return;
    let data=null,error=null;
    try {data=await source.call(request.route,request.payload);}catch{error='Usage data unavailable';}
    c.send('Runtime.evaluate',{contextId:p.executionContextId,expression:`window.__usageBarReply?.(${request.id},${JSON.stringify(data)},${JSON.stringify(error)})`}).catch(()=>{});
  });
  await c.send('Runtime.enable');await c.send('Page.enable');
  await c.send('Runtime.addBinding',{name:'__usageBarCall',executionContextName:world});
  const {identifier}=await c.send('Page.addScriptToEvaluateOnNewDocument',{source:code,worldName:world});
  const {frameTree}=await c.send('Page.getFrameTree');
  const {executionContextId}=await c.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:world});
  const result=await c.send('Runtime.evaluate',{expression:code,contextId:executionContextId});
  if(result.exceptionDetails)throw Error('Status line initialization failed');
  Object.assign(state,{identifier,executionContextId});state.contexts.add(executionContextId);
  console.log('Status line attached.');
}
async function stop(){
  if(ending)return;ending=true;
  for(const {c,identifier,contexts} of clients.values()){
    for(const contextId of contexts)try{await c.send('Runtime.evaluate',{expression:'window.__usageBarOnly?.dispose()',contextId});}catch{}
    try{if(identifier)await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}catch{}
    c.close();
  }
  source.close();try{await unlink(stateFile);}catch{};process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
while(!ending){
  try{await readFile(stopFile);await stop();}catch{}
  try{
    const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1800)});
    const targets=await response.json();misses=0;
    for(const t of targets){
      if(t.type!=='page'||!t.webSocketDebuggerUrl||!/^app:\/\/-\/index\.html(?:$|\?)/.test(t.url)||/avatar-overlay|detached-window/.test(t.url))continue;
      if(!clients.has(t.id))try{await attach(t);}catch(e){clients.get(t.id)?.c.close();clients.delete(t.id);console.log(e.message);}
    }
    await writeFile(stateFile,JSON.stringify({pid:process.pid,port,attached:clients.size,updated:new Date().toISOString()}));
  }catch{if(++misses>=30)await stop();}
  await new Promise(r=>setTimeout(r,2000));
}
