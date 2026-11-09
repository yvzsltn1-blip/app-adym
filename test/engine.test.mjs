import * as E from '../public/js/engine.js';
const cfg = E.defaultConfig();
const schedules = { '2026-11': E.sampleNovember() };
const show = ym => {
  const s = schedules[ym], D = E.daysIn(ym);
  let line = '';
  for (let d = 0; d < D; d++) line += (d + 1) + ':' + E.dayList(s, 'enf', d).map(id => E.person(cfg, id).name.slice(0, 3)).join('+') + (E.dayList(s,'ek',d).length? '/' + E.dayList(s,'ek',d).map(id=>E.person(cfg,id).name.slice(0,3)).join('+'):'') + ' ';
  console.log(ym, line);
  for (const g of E.monthSummary(cfg, schedules, ym)) {
    if (g.post.mode === 'cycle') { console.log(' ', g.post.name, g.rows.map(r => E.fullName(r.person) + '=' + r.count).join(', ')); continue; }
    for (const r of g.rows) console.log('  ', E.fullName(r.person).padEnd(22), 'önceki', r.prevBal.toFixed(2).padStart(6), 'hak', r.fair.toFixed(2), 'hedef', r.target.toFixed(2), 'tuttu', r.count, 'yeni', r.newBal.toFixed(2).padStart(6), JSON.stringify(r.cats));
  }
  const v = E.validate(cfg, schedules, ym);
  console.log('  denetim:', v.length ? v.map(i => (i.day + 1) + ' ' + i.msg).join(' | ') : 'temiz');
};
show('2026-11');
// Aralık: Kutay 14-20 Aralık yıllık izinde
cfg.leaves.push({ id: 'l1', personId: 'p_kutay', type: 'yillik', from: '2026-12-14', to: '2026-12-20' });
let t = Date.now();
schedules['2026-12'] = E.generate(cfg, schedules, '2026-12', { seed: 7 });
console.log('süre', Date.now() - t, 'ms');
show('2026-12');
t = Date.now();
schedules['2027-01'] = E.generate(cfg, schedules, '2027-01', { seed: 9 });
console.log('süre', Date.now() - t, 'ms');
show('2027-01');
schedules['2027-02'] = E.generate(cfg, schedules, '2027-02', { seed: 11 });
show('2027-02');
