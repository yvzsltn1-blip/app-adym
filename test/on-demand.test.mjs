import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';

test('on-demand default has no mandatory dates and legacy frequency migrates only once', () => {
  const cfg = E.defaultConfig(), p = cfg.posts[1];
  assert.equal(p.every, 'need');
  for (let d = 0; d < 30; d++) assert.equal(E.needOn(p, E.dateOf('2026-11', d)), false);
  Object.assign(p, { every: 4, frequencyVersion: undefined });
  const migrated = E.normalizeConfig(cfg);
  assert.equal(migrated.posts[1].every, 'need');
  migrated.posts[1].every = 4;
  assert.equal(E.normalizeConfig(migrated).posts[1].every, 4);
  const s = E.emptySchedule('2026-11');
  assert.ok(!E.validate(E.defaultConfig(), { '2026-11': s }, '2026-11').some(x => x.postId === 'ek' && x.msg.includes('nöbeti boş')));
});

test('on-demand duties complete monthly targets while respecting rest and unavailable days', () => {
  const cfg = E.defaultConfig();
  cfg.posts[1].assign = 'all';
  cfg.rules = [{ type: 'date', personId: 'p_ismail', mode: 'cannot', from: '2026-12-17', to: '2026-12-20' }];
  const s = E.generate(cfg, {}, '2026-12', { seed: 7 });
  const errors = E.validate(cfg, { '2026-12': s }, '2026-12').filter(x => x.level === 'error');
  assert.deepEqual(errors, []);
  assert.ok(E.monthHours(cfg, s, '2026-12').every(r => r.hours >= r.target));
  assert.ok(s.extra.ek.length > 0);
  assert.ok(s.extra.ek.length < 31);
  for (let d = 16; d < 20; d++) assert.ok(!E.dayList(s, 'ek', d).includes('p_ismail'));
});

test('legacy disabled target now uses 168 hours and preserves manual assignments', () => {
  const cfg = E.defaultConfig();
  cfg.settings.monthlyHours = 0;
  const old = E.emptySchedule('2026-12');
  E.setDayList(old, 'ek', 2, ['p_ismail']);
  old.pins.ek = [2];
  const s = E.generate(cfg, { '2026-12': old }, '2026-12', { seed: 7 });
  assert.deepEqual(E.dayList(s, 'ek', 2), ['p_ismail']);
  assert.equal(E.monthlyHoursOf(cfg), 168);
  assert.equal(s.assign.ek.filter(Boolean).length, 7);
});
