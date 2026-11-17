// Bring the already-running Codex window forward without launching another app.
import {CDP} from './cdp.mjs';
const port=Number(process.argv[2]||9337);
for(let n=0;n<20;n++){
 try{
  const ts=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();
  const target=ts.find(t=>t.type==='page'&&/^app:\/\/-\/index\.html(?:$|\?)/.test(t.url)&&!/avatar-overlay|detached-window/.test(t.url));
  if(target){const c=new CDP(target.webSocketDebuggerUrl);try{await c.send('Page.bringToFront');}finally{c.close();}break;}
 }catch{}
 await new Promise(r=>setTimeout(r,500));
}
