// Minimal host for the unmodified Codex++ statusline engine. No extension manager.
(() => {
  window.__usageBarOnly?.dispose();
  const pending = new Map(); let seq = 0;
  window.__usageBarReply = (id, result, error) => {
    const p = pending.get(id); if (!p) return;
    pending.delete(id); clearTimeout(p.timer);
    error ? p.reject(Error(error)) : p.resolve(result);
  };
  codexPlusUsageHost.call = (route,payload) => new Promise((resolve,reject) => {
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Usage data timeout'));},7000);
    pending.set(id,{resolve,reject,timer});
    window.__usageBarCall(JSON.stringify({id,route,payload}));
  });
  codexPlusUsageHost.legacySessionId = () => {
    const selected = document.querySelector('[data-app-action-sidebar-thread-selected="true"][data-app-action-sidebar-thread-id]');
    return selected?.getAttribute('data-app-action-sidebar-thread-id') || location.pathname.match(/\/(?:thread|t)\/([\w-]+)/)?.[1] || '';
  };
  // Only the requested status line. Do not add badges to individual messages.
  codexPlusUsageRefreshTurnUsage = () => Promise.resolve(null);
  codexPlusUsageRenderTurnUsage = () => {};
  codexPlusUsageMergeLiveTurnUsage = () => null;
  // The home composer has no thread ID yet. Mount the same in-flow row with
  // empty values, then let the upstream code take over when a thread exists.
  const syncPlacement = codexPlusUsageSyncPlacement;
  codexPlusUsageSyncPlacement = () => {
    const placement = syncPlacement();
    if (placement || !codexPlusUsageState.running) return placement;
    const card = codexPlusUsageComposerCard()?.card;
    if (!card) return null;
    const node = codexPlusUsageEnsureNode(card);
    if (node) {
      codexPlusUsageShow(node);
      codexPlusUsageRender(null);
    }
    return null;
  };
  // Keep the upstream calculations intact; explain only the hovered metric.
  const renderUsage = codexPlusUsageRender;
  codexPlusUsageRender = (snapshot) => {
    renderUsage(snapshot);
    const { node, parts } = codexPlusUsageState;
    if (!node?.isConnected || !parts) return;
    const zh = (document.documentElement?.lang || navigator.language || '').toLowerCase().startsWith('zh');
    const source = codexPlusUsageSpeedDisplay(snapshot).source;
    const recent = zh ? '最近最多 10 次请求统计' : 'Based on up to 10 recent requests';
    const missing = zh ? '暂无数据' : 'No data yet';
    const context = snapshot?.context == null
      ? (zh ? `上下文占用：${missing}` : `Context usage: ${missing}`)
      : (zh ? `当前上下文占用 ${Math.round(snapshot.context)}%` : `Context used: ${Math.round(snapshot.context)}%`);
    const titles = {
      speed: source === 'none' ? (zh ? `生成速度：${missing}` : `Generation speed: ${missing}`)
        : source === 'throughput' ? (zh ? '整轮估算，含等待和工具耗时' : 'Estimated turn throughput, including waits and tool time')
        : (zh ? '生成速度，不含首字等待和工具执行' : 'Generation speed, excluding first-token wait and tool time') + '\n' + recent,
      ttft: snapshot?.firstTokenMs == null ? (zh ? `首 token 延迟：${missing}` : `First-token latency: ${missing}`)
        : (zh ? '开始收到回复前的等待时间' : 'Time until the reply starts arriving') + '\n' + recent,
      cache: snapshot?.cache == null ? (zh ? `缓存命中：${missing}` : `Cache hit: ${missing}`)
        : (zh ? '输入中复用缓存的比例' : 'Share of input reused from cache'),
      context: context + (snapshot?.modelContextWindow > 0
        ? (zh ? ' · 总容量 ' : ' · Capacity ') + codexPlusUsageFormatNumber(snapshot.modelContextWindow) + ' tokens' : ''),
    };
    if (node.hasAttribute('title')) node.removeAttribute('title');
    for (const [key, title] of Object.entries(titles)) {
      if (parts[key].item.getAttribute('title') !== title) parts[key].item.setAttribute('title', title);
    }
    const label = [codexPlusUsageText().aria, parts.speed.value.textContent, parts.ttft.value.textContent,
      parts.cache.value.textContent, (zh ? '上下文占用 ' : 'Context used ') + parts.context.value.textContent].join(' · ');
    if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
  };
  const wake = () => { if (!document.hidden) syncCodexPlusUsageStatusLine(); };
  const boot = () => startCodexPlusUsageStatusLine();
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('pageshow',wake);
  window.__usageBarOnly = {
    version:'1.0.0',
    inspect:() => ({threadId:codexPlusUsageState.threadId, running:codexPlusUsageState.running,
      failures:codexPlusUsageState.failures,inFlight:codexPlusUsageState.inFlight,hidden:document.hidden,pending:pending.size,binding:typeof window.__usageBarCall,
      text:codexPlusUsageState.node?.textContent, snapshot:codexPlusUsageSnapshot(codexPlusUsageState.cache.get(codexPlusUsageState.threadId))}),
    dispose:() => {
      document.removeEventListener('DOMContentLoaded',boot);
      document.removeEventListener('visibilitychange',wake);window.removeEventListener('pageshow',wake);
      stopCodexPlusUsageStatusLine();
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Status line stopped')); }
      pending.clear(); delete window.__usageBarReply; delete window.__usageBarOnly;
    },
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
