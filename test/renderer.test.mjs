import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { CDP } from '../cdp.mjs';

const edge = process.env.RIBBON_TEST_BROWSER ??
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe');

async function until(probe, message) {
  for (let i = 0; i < 80; i++) {
    const result = await probe();
    if (result) return result;
    await delay(100);
  }
  throw new Error(message);
}

const composerHtml = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>' +
  'body {background:#181818;color:#ddd;font:16px Segoe UI,sans-serif;margin:0;padding:10px 13px;}' +
  '#root {width:min(920px,100%);margin:auto;}.card {height:120px;background:#363636;' +
  'border-radius:24px;box-sizing:border-box;padding:18px;display:flex;flex-direction:column;justify-content:space-between}' +
  '.buttons {display:flex;justify-content:space-between}</style>' +
  '<div id="root" data-codex-composer-root data-composer-placement="home">' +
  '<section class="card" data-composer-surface-variant="default"><div contenteditable="true" class="ProseMirror">和 Codex 一起工作</div>' +
  '<div class="buttons"><span>＋　完全访问</span><span>GPT-6 Astra　🎙</span></div></section></div>' +
  '<div data-app-action-sidebar-thread-selected="true" data-app-action-sidebar-thread-id="previous-thread"></div>';

function fixtureMetrics() {
  window.__fixtureCalls = [];
  window.__usageBarCall = raw => {
    const message = JSON.parse(raw);
    window.__fixtureCalls.push(message);
    const result = message.route === '/thread-usage-live' ? {
      status: 'ok', events: [{
        t: new Date().toISOString(), turn_id: 'fixture-turn', input_tokens: 10000,
        cached_input_tokens: 9950, total_tokens: 63000, context_window: 100000,
      }],
    } : {
      status: 'ok', entries: [{
        threadId: 'fixture-thread', success: true, durationMs: 16100, firstTokenMs: 15100,
        usage: { outputTokens: 52 },
      }],
    };
    queueMicrotask(() => window.__usageBarReply(message.id, result, null));
  };
}

function measure() {
  const card = document.querySelector('.card');
  const line = document.getElementById('codex-plus-usage-statusline');
  if (!line) return null;
  const cardRect = card.getBoundingClientRect(), lineRect = line.getBoundingClientRect();
  const style = getComputedStyle(line);
  return {
    immediatelyBelow: line.previousElementSibling === card,
    gap: lineRect.top - cardRect.bottom,
    centered: Math.abs(cardRect.left + cardRect.width / 2 - lineRect.left - lineRect.width / 2) < 1,
    height: lineRect.height,
    position: style.position,
    alignment: style.justifyContent,
    fontSize: style.fontSize,
    icons: line.querySelectorAll('svg').length,
    values: [...line.querySelectorAll('.codex-plus-usage-value')].map(value => value.textContent),
  };
}

test('original Ribbon is in page flow below the composer, including home and an inactive document', {
  skip: !existsSync(edge) && 'Microsoft Edge is required to run the real renderer fixture',
  timeout: 35000,
}, async () => {
  const parent = await realpath(os.tmpdir());
  const temporary = await mkdtemp(path.join(parent, 'ribbon-renderer-'));
  const fixture = path.join(temporary, 'composer.html');
  const profile = path.join(temporary, 'browser');
  await writeFile(fixture, composerHtml, 'utf8');
  const browser = spawn(edge, [
    '--headless=new', '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--window-size=946,190', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, pathToFileURL(fixture).href,
  ], { stdio: 'ignore', windowsHide: true });
  const exited = once(browser, 'exit').catch(() => null);
  let connection;
  try {
    const debugPort = await until(async () => {
      try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
      catch { return null; }
    }, 'Edge did not start the fixture');
    const target = await until(async () => {
      try {
        const pages = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
        return pages.find(page => page.url === pathToFileURL(fixture).href);
      } catch { return null; }
    }, 'Edge did not load the fixture page');
    connection = new CDP(target.webSocketDebuggerUrl);
    await connection.send('Page.enable');
    await connection.send('Emulation.setDeviceMetricsOverride', {
      width: 946, height: 172, deviceScaleFactor: 1, mobile: false,
    });
    const { frameTree } = await connection.send('Page.getFrameTree');
    const { executionContextId } = await connection.send('Page.createIsolatedWorld', {
      frameId: frameTree.frame.id, worldName: 'codex-usage-bar-only',
    });
    const evaluate = async expression => {
      const result = await connection.send('Runtime.evaluate', {
        expression, contextId: executionContextId, returnByValue: true,
      });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await evaluate('(' + fixtureMetrics.toString() + ')()');
    const vendor = await readFile(new URL('../vendor/statusline.js', import.meta.url), 'utf8');
    const adapter = await readFile(new URL('../adapter.js', import.meta.url), 'utf8');
    await evaluate('(() => {\n' + vendor + '\n' + adapter + '\n})()');
    const layout = () => evaluate('(' + measure.toString() + ')()');
    const empty = await until(layout, 'The home composer did not get a status bar');
    assert.deepEqual(empty.values, ['-- tok/s', '首 token --', '缓存命中 --', '--']);
    assert.equal(await evaluate('window.__fixtureCalls.length'), 0, 'home must not query the previous chat');
    assert.ok(empty.immediatelyBelow && empty.centered);
    assert.deepEqual([empty.gap, empty.position, empty.alignment, empty.fontSize, empty.icons], [6, 'static', 'center', '12px', 4]);
    await evaluate("document.getElementById('root').setAttribute('data-composer-placement','thread');" +
      "document.getElementById('root').insertAdjacentHTML('afterbegin','<span hidden data-above-composer-conversation-id=\"fixture-thread\"></span>')");
    const populated = await until(async () => {
      const state = await layout();
      return state?.values[0] === '52 tok/s' && state;
    }, 'The loaded chat did not get its own metrics');
    assert.deepEqual(populated.values, ['52 tok/s', '首 token 15.1s', '缓存命中 99.5%', '63%']);
    assert.ok(populated.immediatelyBelow && populated.centered);
    await evaluate("Object.defineProperty(document,'hidden',{ configurable:true,value:true });" +
      "document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'))");
    await delay(1400);
    assert.deepEqual((await layout()).values, populated.values, 'an inactive document must retain the status bar');
    if (process.env.RIBBON_TEST_SCREENSHOT) {
      const { data } = await connection.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: 946, height: 172, scale: 1 } });
      await writeFile(process.env.RIBBON_TEST_SCREENSHOT, Buffer.from(data, 'base64'));
    }
  } finally {
    connection?.close();
    if (browser.exitCode === null) browser.kill();
    await exited;
    if (path.dirname(await realpath(temporary)) === parent) {
      await rm(temporary, { recursive: true, force: true, maxRetries: 6, retryDelay: 120 }).catch(() => {});
    }
  }
});
