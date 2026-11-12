import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { createStore } from '../public/js/store.js';

test('legacy configuration uses numbered duties without changing assignments or personnel', () => {
  const old = E.defaultConfig();
  old.posts[0].name = 'Enformasyon Memuru';
  old.posts[0].short = 'Enformasyon';
  old.settings.org = 'TRABZON İL AFET VE ACİL DURUM MÜDÜRLÜĞÜ AFETLERE MÜDAHALE ŞUBE MÜDÜRLÜĞÜ';
  old.settings.title = 'ENFORMASYON MEMURU NÖBET ÇİZELGESİ';
  old.people[0].title = 'Enformasyon Memuru';
  const cfg = E.normalizeConfig(old);
  assert.equal(cfg.posts[0].name, '1. Nöbetçi');
  assert.equal(E.postLabel(cfg.posts[1]), '2. Nöbetçi');
  assert.deepEqual(cfg.posts.map(p => p.id), old.posts.map(p => p.id));
  assert.deepEqual(cfg.people, old.people);
  assert.match(cfg.settings.org, /HUKUK BİRİMİ$/);
  assert.equal(cfg.settings.title, 'NÖBET ÇİZELGESİ');
  assert.deepEqual(E.normalizeConfig(cfg), cfg);
  assert.equal(old.posts[0].name, 'Enformasyon Memuru');
  cfg.posts[0].name = 'Özel görev';
  cfg.settings.org = 'Özel kurum';
  assert.deepEqual(E.normalizeConfig(cfg), cfg);
});

test('personnel titles can be saved, corrected and cleared across store reloads', async () => {
  const local = new Map(), session = new Map();
  const storage = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
  globalThis.localStorage = storage(local);
  globalThis.sessionStorage = storage(session);
  globalThis.location = { search: '?demo' };
  let store = await createStore();
  await store.setup({ username: 'test@example.com', password: 'test1234', displayName: 'Test', seed: true });
  const read = s => new Promise(resolve => { const off = s.subscribe(d => { off(); resolve(d); }); });
  for (const title of ['Enformasyon Memuru', 'Avukat', '']) {
    const d = await read(store);
    d.config.people[0].title = title;
    await store.saveConfig(d.config);
    store = await createStore();
    const loaded = await read(store);
    assert.equal(loaded.config.people[0].title, title);
    assert.deepEqual(loaded.schedules['2026-11'].assign, E.sampleNovember().assign);
  }
});
