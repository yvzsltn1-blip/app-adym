import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { createStore } from '../public/js/store.js';

test('pending requests block only their months; approved unavailable days keep the 168 hour target', () => {
  const cfg = E.defaultConfig(), ym = '2026-12';
  const request = { id: 'r1', personId: 'p_kutay', type: 'uygun-degil', from: ym + '-14', to: ym + '-14', status: 'pending' };
  assert.throws(() => E.generate(cfg, {}, ym, { requests: [request] }), /talepler/);
  assert.equal(E.pendingRequests([request], '2027-01').length, 0);
  cfg.leaves.push({ ...request, id: 'l1' });
  cfg.posts[1].assign = 'all';
  const s = E.generate(cfg, {}, ym, { seed: 7, requests: [{ ...request, status: 'approved' }] });
  assert.equal(E.hoursTarget(cfg, E.person(cfg, 'p_kutay'), ym), 168);
  assert.ok(cfg.posts.every(p => !E.dayList(s, p.id, 13).includes('p_kutay')));
  assert.ok(E.monthHours(cfg, s, ym).every(r => r.hours >= r.target));
});

test('240 hours buy ten shifts; one approved release debits 24 once and credits the replacement', () => {
  const cfg = E.defaultConfig(), ym = '2026-12', pid = 'p_kutay', replacement = 'p_gulden';
  cfg.overtimeAdjustments = [{ personId: pid, hours: 240, note: 'Opening balance' }];
  const s = E.emptySchedule(ym); s.status = 'final';
  for (const d of [0, 4, 8, 12, 16, 20, 24]) E.setDayList(s, 'enf', d, [pid]);
  const schedules = { [ym]: s };
  const before = E.overtimeLedger(cfg, schedules, pid);
  const replacementBefore = E.overtimeLedger(cfg, schedules, replacement).balance;
  assert.equal(before.balance, 240);
  assert.equal(before.balance / before.dayHours, 10);
  const leave = { id: 'l1', personId: pid, type: 'mesai', from: ym + '-13', to: ym + '-13' };
  Object.assign(leave, E.overtimeRelease(cfg, schedules, leave));
  assert.deepEqual(leave.releasedDates, [ym + '-13']);
  assert.equal(leave.debitHours, 24);
  cfg.leaves.push(leave);
  const plan = E.coverLeave(cfg, schedules, pid, leave.from, leave.to, { picks: { [ym + '|12|enf']: replacement }, leaveId: leave.id, type: leave.type });
  Object.assign(schedules, plan.schedules);
  assert.equal(E.overtimeLedger(cfg, schedules, pid).balance, 216);
  assert.equal(E.overtimeLedger(cfg, schedules, replacement).balance, replacementBefore + 24);
  assert.equal(E.hoursTarget(cfg, E.person(cfg, pid), ym), 144);
  assert.ok(E.dayList(schedules[ym], 'enf', 12).includes(replacement));
  assert.equal(E.overtimeLedger(cfg, {}, pid).balance, 216);
});

test('manual balances never alter generation; repeated generation keeps approved days', () => {
  const cfg = E.defaultConfig(), ym = '2026-12'; cfg.posts[1].assign = 'all';
  const s = E.generate(cfg, {}, ym, { seed: 7, hoursMs: 1 });
  cfg.overtimeAdjustments = [{ personId: 'p_kutay', hours: 240 }];
  cfg.adjustments = [{ personId: 'p_kutay', postId: 'enf', value: 1000, month: '2026-11' }];
  assert.deepEqual(E.generate(cfg, {}, ym, { seed: 7, hoursMs: 1 }).assign, s.assign);
  cfg.leaves = [{ id: 'l1', personId: 'p_kutay', type: 'uygun-degil', from: ym + '-14', to: ym + '-14' }];
  for (let i = 0; i < 2; i++) {
    const fresh = E.generate(cfg, {}, ym, { seed: 7 });
    assert.ok(cfg.posts.every(p => !E.dayList(fresh, p.id, 13).includes('p_kutay')));
  }
});

test('all staff see requests; schedule deletion preserves decisions, leaves and manual balances', async () => {
  const local = new Map(), session = new Map();
  const storage = m => ({ getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) });
  globalThis.localStorage = storage(local); globalThis.sessionStorage = storage(session);
  globalThis.location = { search: '?demo' };
  const read = s => new Promise(resolve => { const off = s.subscribe(d => { off(); resolve(d); }); });
  const store = await createStore();
  await store.setup({ username: 'admin@example.com', password: 'test1234', displayName: 'Admin', seed: true });
  await store.createUser({ username: 'kutay', password: 'test1234', displayName: 'Kutay', personId: 'p_kutay' });
  await store.createUser({ username: 'gulden', password: 'test1234', displayName: 'Gulden', personId: 'p_gulden' });
  await store.login('kutay', 'test1234');
  await store.createRequest({ personId: 'p_kutay', type: 'uygun-degil', from: '2026-12-14', to: '2026-12-14' });
  await store.login('gulden', 'test1234');
  assert.equal((await read(store)).requests.length, 1);
  await store.login('admin@example.com', 'test1234');
  const d = await read(store), req = d.requests[0];
  d.config.leaves.push({ ...req, id: 'l1', requestId: req.id });
  d.config.overtimeAdjustments = [{ personId: 'p_kutay', hours: 240 }];
  await store.resolveRequest(req.id, d.config, { '2026-12': E.emptySchedule('2026-12') }, { status: 'approved' });
  await assert.rejects(() => store.resolveRequest(req.id, d.config, {}, { status: 'approved' }));
  await store.deleteSchedule('2026-12');
  const loaded = await read(await createStore());
  assert.equal(loaded.requests[0].status, 'approved');
  assert.equal(loaded.config.leaves[0].from, '2026-12-14');
  assert.equal(loaded.config.overtimeAdjustments[0].hours, 240);
  assert.equal(loaded.schedules['2026-12'], undefined);
});
