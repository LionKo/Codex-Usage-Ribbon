// AGPL-3.0-only. Rollout parser adapted from Codex++ storage.rs (see NOTICE).
import { DatabaseSync } from 'node:sqlite';
import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
export function normalizeId(value) {
  const id = String(value || '').replace(/^local:/, '');
  return /^[a-zA-Z0-9_.-]{8,128}$/.test(id) && !['__proto__','constructor','prototype'].includes(id) ? id : '';
}

export function parseUsage(text, start = 0) {
  const events = []; let turn = null, segment = 0;
  const lines = text.split('\n');
  if (start > 0) lines.shift();
  for (const line of lines) {
    if (!line.includes('"event_msg"') && !line.includes('"turn_context"')) continue;
    let v; try { v = JSON.parse(line); } catch { continue; }
    const p = v.payload || {};
    if (v.type === 'turn_context') {
      if (p.turn_id && p.turn_id !== turn) { segment = events.length; turn = p.turn_id; }
      continue;
    }
    if (v.type !== 'event_msg') continue;
    if (['task_started','turn_started'].includes(p.type)) { segment = events.length; turn = p.turn_id || null; continue; }
    if (['task_complete','turn_complete','turn_completed','task_failed','turn_aborted','task_aborted'].includes(p.type)) {
      if (p.turn_id) for (const e of events.slice(segment)) if (!e.turn_id) e.turn_id = p.turn_id;
      segment = events.length; turn = null; continue;
    }
    if (p.type !== 'token_count' || !p.info?.last_token_usage) continue;
    const last = p.info.last_token_usage, total = p.info.total_token_usage || {};
    if (!(last.input_tokens > 0 || last.output_tokens > 0 || last.total_tokens > 0)) continue;
    const event = { t: v.timestamp || '', context_window: p.info.model_context_window || 0, turn_output_tokens: total.output_tokens || 0 };
    for (const k of ['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens']) event[k] = last[k] || 0;
    if (turn) event.turn_id = turn;
    events.push(event);
  }
  return events.slice(-24);
}

export class UsageSource {
  constructor(root = home, magpie = 'http://127.0.0.1:3425') {
    this.root = root; this.magpie = magpie; this.db = null;
    this.files = new Map(); this.cache = new Map(); this.requests = []; this.requestTime = 0; this.pending = null;
  }
  async init() {
    const files = (await readdir(this.root)).filter(n => /^state_\d+\.sqlite$/.test(n)).sort((a,b) => Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0]));
    if (!files.length) throw Error('No Codex state database found');
    this.db = new DatabaseSync(path.join(this.root, files[0]), {readOnly:true});
    this.db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=1000;');
  }
  async live(value) {
    const id = normalizeId(value);
    if (!id) return {status:'unavailable',events:[]};
    // Use the exact thread ID. Never substitute the latest active session.
    const row = this.db.prepare('SELECT rollout_path FROM threads WHERE id=?').get(id);
    if (!row) return {status:'unavailable',events:[]};
    const filename = path.resolve(row.rollout_path), rel = path.relative(this.root, filename);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return {status:'unavailable',events:[]};
    const s = await stat(filename), previous = this.cache.get(id);
    if (previous?.size === s.size && previous?.mtime === s.mtimeMs) return {status:'ok',events:previous.events};
    const f = await open(filename, 'r'); let events;
    try {
      for (let window = 512*1024; ; window = Math.min(window*4,8*1024*1024)) {
        const start = Math.max(0,s.size-window), buf = Buffer.alloc(s.size-start);
        const {bytesRead} = await f.read(buf,0,buf.length,start);
        events = parseUsage(buf.subarray(0,bytesRead).toString('utf8'),start);
        if ((events.length >= 2 && events.at(-1).turn_id) || start === 0 || window >= 8*1024*1024) break;
      }
    } finally { await f.close(); }
    this.cache.delete(id); this.cache.set(id,{size:s.size,mtime:s.mtimeMs,events});
    if (this.cache.size>32) this.cache.delete(this.cache.keys().next().value);
    return {status:'ok',events};
  }
  async recent() {
    if (Date.now()-this.requestTime < 1100) return {status:'ok',entries:this.requests};
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const r = await fetch(this.magpie+'/v1/magpie/usage/requests?agent=codex&limit=100', {signal:AbortSignal.timeout(2500),redirect:'error'});
        if (!r.ok) throw Error('Magpie unavailable');
        const data = await r.json();
        this.requests = mapRequests(data.rows || []); this.requestTime=Date.now();
        return {status:'ok',entries:this.requests};
      } catch { return {status:'unavailable',entries:[]}; }
      finally { this.pending=null; }
    })();
    return this.pending;
  }
  async call(route,payload) {
    if (route==='/thread-usage-live') return this.live(payload?.session_id);
    if (route==='/request-log/recent') return this.recent();
    throw Error('Unsupported route');
  }
  close() { this.db?.close(); }
}

export function mapRequests(rows) {
  return rows.filter(r => r.agent === 'codex').map(r => ({
    threadId:normalizeId(r.session || r.original_ids?.session_id || r.native_session || r.original_ids?.native_session_id),
    success:r.status >= 200 && r.status < 300,
    durationMs:Number(r.ms)||0,
    // Preserve missing timing: zero is not a measured first-token delay.
    firstTokenMs:r.ttft_ms > 0 ? Number(r.ttft_ms) : null,
    usage:{outputTokens:Number(r.out)||0},
  }));
}
