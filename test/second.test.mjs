import * as E from '../public/js/engine.js';
const run = (label, change) => {
  const cfg = E.defaultConfig();
  const schedules = { '2026-11': E.sampleNovember() };
  change(cfg);
  schedules['2026-12'] = E.generate(cfg, schedules, '2026-12', { seed: 5 });
  const s = schedules['2026-12'];
  const ek = [...Array(31).keys()].map(d => E.dayList(s, 'ek', d).map(id => E.person(cfg, id).name.slice(0, 3)).join('+') || '·').join(' ');
  const errs = E.validate(cfg, schedules, '2026-12').filter(i => i.level === 'error').map(i => (i.day + 1) + ': ' + i.msg);
  const cnt = {};
  for (let d = 0; d < 31; d++) for (const p of cfg.posts) for (const id of E.dayList(s, p.id, d)) cnt[E.person(cfg, id).name] = (cnt[E.person(cfg, id).name] || 0) + 1;
  console.log('\n== ' + label + '\n2. nöbetçi: ' + ek + '\nToplam nöbet: ' + JSON.stringify(cnt) + '\nİhlal: ' + (errs.length ? errs.slice(0, 4).join(' | ') + (errs.length > 4 ? ' …(' + errs.length + ')' : '') : 'yok'));
};
run('Sabit kişi (İsmail)', cfg => { Object.assign(cfg.posts[1], { assign: 'fixed', fixedId: 'p_ismail', mode: 'cycle' }); });
run('Seçilenler arasında, 4 günde bir (İsmail, Gülden, Kutay)', cfg => { Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' }); });
run('Tüm personel karışık, 2 günde bir', cfg => { Object.assign(cfg.posts[1], { assign: 'all', every: 2, mode: 'daily' }); });
run('Kapalı', cfg => { Object.assign(cfg.posts[1], { assign: 'off' }); });
