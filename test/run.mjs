// Runs aigifmaker.user.js in a vm with GM_* shims. Unit: unwrap() mapping on SPEC §2 shapes.
// Live smoke (no generation): wrong key -> auth, no key -> wall -> auth.
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../aigifmaker.user.js', import.meta.url), 'utf8');
let store = {};
const T = {};
const ctx = {
  __AIGIF_TEST__: T, console, setTimeout, prompt: () => null,
  window: { getSelection: () => '' , innerWidth: 1000 },
  document: { addEventListener() {}, createElement() { return {}; }, body: { appendChild() {} } },
  GM_getValue: (k, d) => (k in store ? store[k] : d), GM_setValue: (k, v) => { store[k] = v; },
  GM_registerMenuCommand: () => {},
  GM_xmlhttpRequest: (o) => {
    fetch(o.url, { method: o.method, headers: o.headers, body: o.data })
      .then(async (r) => o.onload({ status: r.status, responseText: await r.text() }))
      .catch(() => o.onerror());
  },
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
let fail = 0;
const check = (name, fn, kind) => {
  try { fn(); console.log(`FAIL ${name}: no error`); fail++; }
  catch (e) { const ok = e.kind === kind; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${e.kind}`); if (!ok) fail++; }
};
const okData = T.unwrap(200, { code: 0, message: 'ok', data: { id: 't1', status: 'pending' } });
console.log(okData.id === 't1' ? 'PASS success shape' : (fail++, 'FAIL success shape'));
check('invalid key', () => T.unwrap(200, { code: -1, message: 'invalid API key — create one at https://aigifmaker.ai/settings/apikeys' }), 'auth');
check('wall', () => T.unwrap(200, { code: 0, data: { wall: true, reason: 'anon_credits' } }), 'auth');
check('insufficient credits', () => T.unwrap(200, { code: -1, message: 'insufficient credits' }), 'quota');
check('cooldown code', () => T.unwrap(200, { code: 429, message: 'slow down' }), 'rejected');
check('other -1', () => T.unwrap(200, { code: -1, message: 'boom' }), 'api');
if (process.argv.includes('--live')) {
  const live = async (name, key, fn) => {
    store = { apiKey: key };
    try { await fn(); console.log(`FAIL ${name}: no error`); fail++; }
    catch (e) { const ok = e.kind === 'auth'; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${e.kind} ${e.message}`); if (!ok) fail++; }
  };
  await live('live wrong key credits', 'sk-invalidtest000', () => T.call('/api/user/get-user-credits', {}));
  await live('live no key submit', '', () => T.submit('smoke test'));
}
process.exit(fail ? 1 : 0);
