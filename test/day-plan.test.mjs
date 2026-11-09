import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';

const ym = '2026-12';
function config(required = 1) {
  const c = E.defaultConfig();
  c.settings.monthlyHours = 0;
  c.posts = [{ id: 'daily', name: 'Nöbet', assign: 'people', required, every: 1 }];
  c.people = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, name: 'Kişi ' + i, active: true, posts: ['daily'], offWeekdays: [] }));
  c.rules = [{ id: 'off', type: 'date', mode: 'cannot', source: 'calendar', personId: 'p1', from: ym + '-01', to: ym + '-05' }];
  return c;
}

for (const required of [1, 2]) {
  const c = config(required), blank = E.emptySchedule(ym);
  E.setDayList(blank, 'daily', 8, ['p0']);
  blank.pins.daily = [8];
  const original = JSON.stringify(blank);
  for (const seed of [7, 19, 43]) {
    const s = E.generate(c, { [ym]: blank }, ym, { seed, tries: 3, iters: 30000 });
    assert(E.dayList(s, 'daily', 8).includes('p0'), 'Sabit kişi korunmalı');
    assert.equal(E.dayList(s, 'daily', 8).length, required, 'Diğer yerler otomatik dolmalı');
    for (let d = 0; d < 5; d++) assert(!E.dayList(s, 'daily', d).includes('p1'), 'Kısıtlı kişi yazılmamalı');
    assert.deepEqual(E.validate(c, { [ym]: s }, ym).filter(i => i.level === 'error'), []);
    const again = E.generate(c, { [ym]: s }, ym, { seed, iters: 30000 });
    assert(E.dayList(again, 'daily', 8).includes('p0'), 'Yeniden oluşturmada sabitleme korunmalı');
  }
  assert.equal(JSON.stringify(blank), original, 'Kaynak taslak değişmemeli');
}

// Sabit döngüde gelecekteki sabitlemenin öncesi ve sonrası 72 saat dinlenme.
const c = config();
c.posts.push({ id: 'cycle', name: 'Döngü', assign: 'fixed', fixedId: 'pc', every: 4 });
c.people.push({ id: 'pc', name: 'Döngü kişisi', active: true, posts: ['cycle'], offWeekdays: [] });
const blank = E.emptySchedule(ym);
E.setDayList(blank, 'cycle', 6, ['pc']);
blank.pins.cycle = [6];
c.rules.push({ id: 'cycle-off', type: 'date', mode: 'cannot', personId: 'pc', from: ym + '-15', to: ym + '-15' });
const s = E.generate(c, { [ym]: blank }, ym, { seed: 7 });
assert.deepEqual(E.dayList(s, 'cycle', 6), ['pc']);
assert.deepEqual(E.dayList(s, 'cycle', 14), []);
assert.deepEqual(E.validate(c, { [ym]: s }, ym).filter(i => i.level === 'error'), []);

// Çelişen sabitleme gizlice değiştirilmez; denetim açıkça hata üretir.
c.rules.push({ id: 'conflict', type: 'date', mode: 'cannot', personId: 'pc', from: ym + '-07', to: ym + '-07' });
const invalid = E.generate(c, { [ym]: blank }, ym, { seed: 7 });
assert(E.validate(c, { [ym]: invalid }, ym).some(i => i.level === 'error' && i.pid === 'pc' && i.day === 6));
console.log('Gün planlama: sabitleme, kısıt, kısmi kadro, döngü ve çelişki testleri geçti.');
