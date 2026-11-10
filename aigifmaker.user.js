// ==UserScript==
// @name         AI GIF Maker: turn selected text into an animated GIF
// @namespace    https://aigifmaker.ai
// @version      0.1.0
// @description  Turn text into animated GIFs with AI GIF Maker. Select text on any page, click the GIF button, and the finished GIF shows right on the page. Runs on your aigifmaker.ai API key.
// @author       AI GIF Maker
// @homepageURL  https://aigifmaker.ai/?utm_source=greasyfork&utm_medium=userscript
// @supportURL   https://github.com/hanshs474/aigifmaker-userscript/issues
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      aigifmaker.ai
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://aigifmaker.ai';
  const UTM = '?utm_source=greasyfork&utm_medium=userscript';
  const KEYS = BASE + '/settings/apikeys';
  const POLL_MS = 3000;
  const TIMEOUT_MS = 15 * 60 * 1000;

  const apiKey = () => String(GM_getValue('apiKey', '') || '').trim();
  function askKey() {
    const v = prompt('Paste your AI GIF Maker API key (create one at ' + KEYS + '). Leave empty to remove it.', apiKey());
    if (v !== null) GM_setValue('apiKey', v.trim());
    return apiKey();
  }

  // kind: auth | quota | rejected | api | network | server
  class AigifmakerError extends Error {
    constructor(kind, message) { super(message); this.kind = kind; }
  }

  // Every answer is HTTP 200; the JSON code says what happened.
  function unwrap(status, body) {
    if (!body || typeof body.code !== 'number') {
      throw new AigifmakerError(status >= 500 ? 'server' : 'api', (body && body.message) || 'unexpected answer (HTTP ' + status + ')');
    }
    if (body.code !== 0) {
      const msg = body.message || 'request refused (code ' + body.code + ')';
      if (/invalid api key|no auth/i.test(msg)) throw new AigifmakerError('auth', msg);
      if (/insufficient credits/i.test(msg)) throw new AigifmakerError('quota', msg + '. Top up at ' + BASE + '/pricing');
      if (body.code !== -1) throw new AigifmakerError('rejected', msg + '. Reword the text and try again.');
      throw new AigifmakerError('api', msg);
    }
    const data = body.data || {};
    if (data.wall === true) throw new AigifmakerError('auth', 'An API key is required. Create one at ' + KEYS);
    return data;
  }

  function call(path, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: BASE + path,
        headers: Object.assign({ 'Content-Type': 'application/json' }, apiKey() ? { Authorization: 'Bearer ' + apiKey() } : {}),
        data: JSON.stringify(body || {}),
        timeout: 60000,
        onload: (r) => {
          let json = null;
          try { json = JSON.parse(r.responseText); } catch (e) { /* non-JSON error page */ }
          try { resolve(unwrap(r.status, json)); } catch (e) { reject(e); }
        },
        onerror: () => reject(new AigifmakerError('network', 'Could not reach aigifmaker.ai.')),
        ontimeout: () => reject(new AigifmakerError('network', 'aigifmaker.ai timed out.')),
      });
    });
  }

  async function submit(text) {
    const d = await call('/api/ai/generate', {
      provider: 'openlux', mediaType: 'image', model: 'gif-maker-v1', scene: 'text-to-image',
      prompt: text, options: { output_format: 'gif' },
    });
    if (!d.id) throw new AigifmakerError('api', 'aigifmaker.ai returned no task id');
    return String(d.id);
  }

  async function generate(text, onStatus) {
    const id = await submit(text);
    const t0 = Date.now();
    while (Date.now() - t0 < TIMEOUT_MS) {
      await new Promise((res) => setTimeout(res, POLL_MS));
      let s;
      try { s = await call('/api/ai/query', { taskId: id }); }
      catch (e) { if (e.kind === 'network' || e.kind === 'server') continue; throw e; } // a dropped poll is not a failed GIF
      onStatus('Making your GIF… ' + Math.round((Date.now() - t0) / 1000) + 's');
      if (s.status === 'success' && s.images && s.images[0]) return s.images[0];
      if (s.status === 'failed' || s.status === 'canceled') {
        const kind = s.failureKind === 'moderation' ? 'rejected' : 'api';
        throw new AigifmakerError(kind, (s.errorMessage || 'The GIF ' + s.status) + (s.refundNote ? ' ' + s.refundNote : ''));
      }
    }
    throw new AigifmakerError('api', 'Still not finished. It will appear in your history on aigifmaker.ai.');
  }

  // --- UI: a small panel, styled inline so page CSS cannot break it. ---
  let panel;
  const link = (href, text) => {
    const a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
    a.style.cssText = 'color:#c4b5fd;margin-right:12px';
    return a;
  };
  function showPanel(text) {
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;padding:12px;' +
      'background:#17131f;color:#eee;font:13px/1.45 system-ui,sans-serif;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.45)';
    const close = document.createElement('button');
    close.textContent = '×';
    close.style.cssText = 'float:right;background:none;border:0;color:#aaa;font-size:18px;cursor:pointer';
    close.onclick = () => panel.remove();
    const quote = document.createElement('div');
    quote.textContent = '“' + text.slice(0, 160) + (text.length > 160 ? '…' : '') + '”';
    quote.style.cssText = 'color:#bbb;margin:0 0 8px';
    const status = document.createElement('div');
    panel.append(close, quote, status);
    document.body.appendChild(panel);

    if (!apiKey()) {
      status.textContent = 'Add your AI GIF Maker API key first. ';
      const set = document.createElement('a');
      set.href = '#'; set.textContent = 'Set API key'; set.style.cssText = 'color:#c4b5fd;margin-right:12px';
      set.onclick = (e) => { e.preventDefault(); if (askKey()) showPanel(text); };
      status.append(set, link(KEYS, 'Get a key'));
      return;
    }
    // A GIF costs 1 credit, so it starts only on an explicit click here.
    status.textContent = 'One GIF costs 1 credit. ';
    const b = document.createElement('button');
    b.textContent = 'Make GIF';
    b.style.cssText = 'margin:6px 6px 0 0;padding:4px 10px;border:0;border-radius:6px;background:#7c3aed;color:#fff;cursor:pointer';
    b.onclick = () => run(text, status);
    status.appendChild(b);
  }

  function run(text, status) {
    status.textContent = 'Sending to AI GIF Maker…';
    generate(text, (s) => { status.textContent = s; })
      .then((url) => {
        status.textContent = '';
        const img = document.createElement('img');
        img.src = url; img.alt = text.slice(0, 120);
        img.style.cssText = 'display:block;width:100%;border-radius:6px;margin:6px 0';
        const links = document.createElement('div');
        links.append(link(url, 'Open GIF'), link(BASE + '/' + UTM, 'More on AI GIF Maker'));
        status.append(img, links);
      })
      .catch((e) => {
        status.textContent = e.message + ' ';
        if (e.kind === 'auth') {
          const set = document.createElement('a');
          set.href = '#'; set.textContent = 'Set API key'; set.style.cssText = 'color:#c4b5fd;margin-right:12px';
          set.onclick = (ev) => { ev.preventDefault(); if (askKey()) showPanel(text); };
          status.append(set);
        } else if (e.kind === 'quota') {
          status.append(link(BASE + '/pricing' + UTM, 'See pricing'));
        } else {
          status.append(link(BASE + '/' + UTM, 'Open AI GIF Maker'));
        }
      });
  }

  function selected() {
    return String(window.getSelection() || '').trim().slice(0, 2000);
  }

  // A small button appears next to a text selection; nothing is sent until you press Make GIF.
  let button;
  document.addEventListener('mouseup', (e) => {
    if (button && e.target === button) return;
    if (button) { button.remove(); button = null; }
    const text = selected();
    if (text.length < 3) return;
    button = document.createElement('button');
    button.textContent = 'GIF';
    button.title = 'Turn the selected text into an animated GIF with AI GIF Maker';
    button.style.cssText = 'position:fixed;z-index:2147483647;padding:4px 8px;border:0;border-radius:6px;' +
      'background:#7c3aed;color:#fff;font:bold 12px system-ui,sans-serif;cursor:pointer;' +
      'left:' + Math.min(e.clientX + 8, window.innerWidth - 60) + 'px;top:' + Math.max(e.clientY - 34, 4) + 'px';
    button.addEventListener('mousedown', (ev) => ev.preventDefault());
    button.addEventListener('click', () => { const t = selected(); button.remove(); button = null; if (t) showPanel(t); });
    document.body.appendChild(button);
  });

  GM_registerMenuCommand('Make a GIF from the selected text', () => {
    const t = selected() || prompt('Describe the GIF:', '');
    if (t && t.trim()) showPanel(t.trim());
  });
  GM_registerMenuCommand('Make a GIF from a prompt…', () => {
    const t = prompt('Describe the GIF:', selected());
    if (t && t.trim()) showPanel(t.trim());
  });
  GM_registerMenuCommand('Set AI GIF Maker API key…', askKey);

  // Test hook (only present when a harness defines it before the script runs).
  if (typeof __AIGIF_TEST__ === 'object' && __AIGIF_TEST__) Object.assign(__AIGIF_TEST__, { unwrap, submit, call, generate });
})();
