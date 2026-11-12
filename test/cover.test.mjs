import * as E from '../public/js/engine.js';
import assert from 'node:assert/strict';
const cfg = E.defaultConfig();
// Bu senaryo sabit kişinin eski 24/72 döngüsünde izinle çıkarılmasını denetler.
Object.assign(cfg.posts[1], { assign: 'fixed', fixedId: 'p_ismail', mode: 'cycle', every: 4 });
const schedules = { '2026-11': E.sampleNovember() };
schedules['2026-12'] = E.generate(cfg, schedules, '2026-12', { seed: 7 });
const orig = JSON.stringify(schedules['2026-12']);
// Kutay 14-20 Aralık izne çıkıyor (çizelge hazırlandıktan sonra)
cfg.leaves.push({ id: 'l1', personId: 'p_kutay', type: 'yillik', from: '2026-12-14', to: '2026-12-20' });
const { schedules: ch, changes, empty } = E.coverLeave(cfg, schedules, 'p_kutay', '2026-12-14', '2026-12-20', { seed: 3 });
const nm = ids => ids.map(id => E.person(cfg, id).name).join('+') || '—';
console.log(changes.map(c => c.date + ' ' + c.postId + ' ' + nm(c.before) + ' -> ' + nm(c.after)).join('\n'));
assert.equal(JSON.stringify(schedules['2026-12']), orig, 'girdi değişmemeli');
const after = { ...schedules, ...ch };
for (let d = 13; d < 20; d++) assert.ok(!E.dayList(after['2026-12'], 'enf', d).includes('p_kutay'));
for (let d = 0; d < 13; d++) assert.equal(E.dayList(after['2026-12'], 'enf', d).join(), E.dayList(schedules['2026-12'], 'enf', d).join(), 'izin öncesi günler korunmalı');
assert.equal(empty.length, 0);
const errs = E.validate(cfg, after, '2026-12').filter(i => i.level === 'error');
assert.equal(errs.length, 0, errs.map(e => e.msg).join('; '));
assert.equal(after['2026-12'].status, schedules['2026-12'].status);
// İsmail izinde: döngü görevinden yalnızca çıkarılır
cfg.leaves.push({ id: 'l2', personId: 'p_ismail', type: 'yillik', from: '2026-12-01', to: '2026-12-10' });
const r2 = E.coverLeave(cfg, after, 'p_ismail', '2026-12-01', '2026-12-10');
assert.ok(r2.changes.length && r2.changes.every(c => c.postId === 'ek' && !c.after.length));
assert.equal(E.postLabel(cfg.posts[1]), '2. Nöbetçi');
assert.equal(E.postLabel(cfg.posts[0]), '1. Nöbetçi');
console.log('tamam');
