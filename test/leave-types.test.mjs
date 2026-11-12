import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';

test('administrators can add, edit and remove leave types without normalization restoring deleted types', () => {
  const cfg = E.normalizeConfig(E.defaultConfig());
  const types = cfg.leaveTypes.filter(t => t.id !== 'uygun-degil').map(t => t.id === 'mazeret' ? { ...t, name: 'Özel mazeret', color: '#112233' } : t);
  types.push({ id: 'new-type', name: 'Yeni tür', compensate: false, unavailable: true, color: '#445566' });
  E.setLeaveTypes(cfg, types);
  const loaded = E.normalizeConfig(JSON.parse(JSON.stringify(cfg)));
  assert.ok(!loaded.leaveTypes.some(t => t.id === 'uygun-degil'));
  assert.equal(E.leaveType(loaded, 'mazeret').name, 'Özel mazeret');
  assert.equal(E.leaveType(loaded, 'mazeret').color, '#112233');
  assert.equal(E.leaveType(loaded, 'new-type').unavailable, true);
  assert.deepEqual(E.normalizeConfig(loaded), loaded);
});

test('removing a used overtime or annual type preserves historical calculations and requests', () => {
  const cfg = E.defaultConfig();
  cfg.overtimeAdjustments = [{ personId: 'p_kutay', hours: 240 }];
  cfg.leaves = [
    { id: 'l1', personId: 'p_kutay', type: 'mesai', from: '2026-12-16', to: '2026-12-16', releasedDates: ['2026-12-16'], debitHours: 24 },
    { id: 'l2', personId: 'p_gulden', type: 'yillik', from: '2026-12-01', to: '2026-12-15' }
  ];
  const before = E.overtimeLedger(cfg, {}, 'p_kutay');
  const target = E.hoursTarget(cfg, E.person(cfg, 'p_gulden'), '2026-12');
  E.setLeaveTypes(cfg, cfg.leaveTypes.filter(t => !['mesai', 'yillik'].includes(t.id)));
  const loaded = E.normalizeConfig(JSON.parse(JSON.stringify(cfg)));
  assert.equal(E.overtimeLedger(loaded, {}, 'p_kutay').balance, before.balance);
  assert.equal(E.hoursTarget(loaded, E.person(loaded, 'p_gulden'), '2026-12'), target);
  assert.equal(E.leaveType(loaded, 'mesai').overtime, true);
  assert.equal(E.leaveType(loaded, 'yillik').annual, true);
  assert.equal(E.leaveType(loaded, 'mesai').name, 'Fazla mesai izni');
  assert.ok(!loaded.leaveTypes.some(t => ['mesai', 'yillik'].includes(t.id)));
});
