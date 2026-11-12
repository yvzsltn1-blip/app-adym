const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('public/js/pwa.js', 'utf8');
async function setup({ controlled = true, waiting = true, standalone = false } = {}) {
  const events = {}, swEvents = {}, intervals = [];
  const elements = Object.fromEntries(['install-app', 'install-help', 'app-update', 'busy'].map(id => [id, {
    hidden: true, textContent: '', addEventListener(type, fn) { this[type] = fn; },
    querySelector() { return this; }
  }]));
  let now = 0, reloads = 0, messages = 0;
  const reg = { waiting: waiting ? { postMessage() { messages++; } } : null, addEventListener() {}, update: async () => {} };
  const context = { document: { getElementById: id => elements[id], addEventListener() {} },
    navigator: { onLine: true, userAgent: 'Chrome', serviceWorker: { controller: controlled ? {} : null,
      addEventListener(type, fn) { swEvents[type] = fn; }, register: async () => reg } },
    window: { addEventListener(type, fn) { events[type] = fn; } },
    matchMedia: () => ({ matches: standalone }), location: { reload() { reloads++; } },
    Date: { now: () => now }, setInterval(fn, ms) { intervals.push({ fn, ms }); }, clearInterval() {}, console };
  vm.runInNewContext(source, context);
  await Promise.resolve();
  return { elements, events, swEvents, context, counts: () => ({ reloads, messages }),
    tick(ms) { now = ms; intervals.filter(x => x.ms === 1000).forEach(x => x.fn()); } };
}
test('update counts down for 30 seconds and reloads once after activation', async () => {
  const s = await setup();
  assert.equal(s.elements['app-update'].hidden, false);
  assert.match(s.elements['app-update'].textContent, /^30 sn/);
  s.tick(29000); assert.equal(s.counts().messages, 0);
  s.tick(30000); assert.equal(s.counts().messages, 1);
  s.swEvents.controllerchange(); s.swEvents.controllerchange();
  assert.equal(s.counts().reloads, 1);
});
test('immediate update waits for active save to complete', async () => {
  const s = await setup();
  s.elements.busy.hidden = false;
  s.elements['app-update'].onclick(); assert.equal(s.counts().messages, 0);
  s.elements.busy.hidden = true;
  s.tick(1000); assert.equal(s.counts().messages, 1);
});
test('first install does not show update or reload', async () => {
  const s = await setup({ controlled: false, waiting: false });
  assert.equal(s.elements['app-update'].hidden, true);
  s.swEvents.controllerchange(); assert.equal(s.counts().reloads, 0);
});
test('install button invokes browser prompt and hides after installation', async () => {
  const s = await setup(); let prompted = false;
  s.events.beforeinstallprompt({ preventDefault() {}, async prompt() { prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await s.elements['install-app'].click(); assert.equal(prompted, true);
  s.events.appinstalled(); assert.equal(s.elements['install-app'].hidden, true);
});
test('standalone mode hides install button', async () => {
  const s = await setup({ standalone: true });
  assert.equal(s.elements['install-app'].hidden, true);
});
