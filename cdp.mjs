import { EventEmitter } from 'node:events';
export class CDP extends EventEmitter {
  constructor(url) {
    super(); this.seq=0; this.pending=new Map(); this.ws=new WebSocket(url);
    this.ready=new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});
    this.ws.addEventListener('message',e=>{
      let m; try{m=JSON.parse(e.data);}catch{return;}
      if (m.id) {const p=this.pending.get(m.id); if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}
      else this.emit(m.method,m.params);
    });
    this.ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('CDP closed'));}this.pending.clear();this.emit('closed');});
    this.ws.addEventListener('error',()=>{});
  }
  async send(method,params={}) {
    await this.ready;
    return new Promise((resolve,reject)=>{
      const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},10000);
      this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  close(){this.ws.close();}
}
