import * as E from '../public/js/engine.js';
const cfg = E.defaultConfig();
const schedules = { '2026-11': E.sampleNovember() };
cfg.settings.maxWeekend = 2; cfg.settings.noConsecutiveWeekends = true;
cfg.rules = [
  { id: 'r1', type: 'date', personId: 'p_gulden', mode: 'must', from: '2026-12-24', to: '2026-12-24' },
  { id: 'r2', type: 'date', personId: 'p_kutay', mode: 'cannot', from: '2026-12-01', to: '2026-12-05' },
  { id: 'r3', type: 'apart', a: 'p_zeynep', b: 'p_ismail' }
];
cfg.people.find(p => p.id === 'p_omer').share = 50;
schedules['2026-12'] = E.generate(cfg, schedules, '2026-12', { seed: 3 });
const s = schedules['2026-12'];
const on = (pid, d) => cfg.posts.some(p => E.dayList(s, p.id, d).includes(pid));
console.log('Gülden 24 Aralık:', on('p_gulden', 23));
console.log('Kutay 1-5 Aralık:', [0,1,2,3,4].some(d => on('p_kutay', d)));
console.log('Zeynep+İsmail aynı gün:', [...Array(31).keys()].filter(d => on('p_zeynep', d) && on('p_ismail', d)).map(d=>d+1));
for (const r of E.monthSummary(cfg, schedules, '2026-12')[0].rows) console.log(E.fullName(r.person).padEnd(20), 'hak', r.fair.toFixed(2), 'tuttu', r.count, 'hs/tatil', r.cats.sat + r.cats.sun + r.cats.hol);
console.log('denetim:', E.validate(cfg, schedules, '2026-12').map(i => i.msg));
console.log(E.explain(cfg, schedules, '2026-12').map(x => x.title + ': ' + x.details.join(' ')).join('\n').slice(0, 900));
console.log(E.shareText(cfg, schedules, '2026-12').split('\n').slice(0, 5).join('\n'));
