/* Aylık mesai hedefi (160 saat): herkes en az 7 nöbet tutmalı; gerekirse 2. nöbetçiye ek gün açılır. */
import * as E from '../public/js/engine.js';
let fail = 0;
const run = (label, change, ym = '2026-12') => {
  const cfg = E.defaultConfig();
  const schedules = { '2026-11': E.sampleNovember() };
  change(cfg);
  const t0 = Date.now();
  schedules[ym] = E.generate(cfg, schedules, ym, { seed: 7 });
  const s = schedules[ym], D = E.daysIn(ym);
  const ek = [...Array(D).keys()].map(d => E.dayList(s, 'ek', d).map(id => E.person(cfg, id).name.slice(0, 3)).join('+') || '·').join(' ');
  const hrs = E.monthHours(cfg, s, ym);
  const short = hrs.filter(r => r.target > 0 && r.hours < r.target);
  const errs = E.validate(cfg, schedules, ym).filter(i => i.level === 'error');
  console.log('\n== ' + label + ' (' + (Date.now() - t0) + ' ms)\n2. nöbetçi: ' + ek +
    '\nEk gün: ' + JSON.stringify(s.extra || {}) +
    '\nMesai: ' + hrs.map(r => r.person.name + ' ' + r.shifts + '/' + r.need + ' (' + r.hours + ' sa)').join(', ') +
    '\nEksik mesai: ' + (short.length ? short.map(r => r.person.name).join(', ') : 'yok') +
    '\nİhlal: ' + (errs.length ? errs.slice(0, 4).map(i => i.msg).join(' | ') : 'yok'));
  return { short, errs, cfg, schedules, s };
};
const check = (cond, msg) => { if (!cond) { fail++; console.log('  HATA: ' + msg); } };

let r = run('Seçilenler arasında 4 günde bir (İsmail, Gülden, Kutay)', cfg => { Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' }); });
check(!r.short.length && !r.errs.length, 'havuz düzeninde herkes 160 saati doldurmalı, ihlal olmamalı');

/* Ek günler bakiyeyi bozmamalı: 2. nöbetçi görevinde bakiyeler ek gün yokmuş gibi kalmalı. */
const rows = E.monthSummary(r.cfg, r.schedules, '2026-12').find(g => g.post.id === 'ek').rows;
const sumBal = rows.reduce((a, x) => a + x.newBal - x.prevBal, 0);
check(Math.abs(sumBal) < 1e-6, '2. nöbetçi bakiye değişimleri toplamı 0 olmalı (ek günlerin payı da dağıtılır), bulundu ' + sumBal);

r = run('Tüm personel karışık, 4 günde bir', cfg => { Object.assign(cfg.posts[1], { assign: 'all', every: 4, mode: 'daily' }); });
check(!r.short.length && !r.errs.length, 'karışık düzende herkes 160 saati doldurmalı');

r = run('Hedef kapalı (eski davranış)', cfg => { cfg.settings.monthlyHours = 0; Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' }); });
check(E.monthlyHoursOf(r.cfg) === 168 && !!Object.keys(r.s.extra || {}).length, 'eski kapalı hedef 168 saat olarak uygulanmalı');

r = run('Gülden 7–11 Aralık yıllık izinde', cfg => {
  Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' });
  cfg.leaves = [{ id: 'l1', personId: 'p_gulden', type: 'yillik', from: '2026-12-07', to: '2026-12-11' }];
});
check(!r.errs.length, 'izinli ayda ihlal olmamalı');
check(E.minShifts(r.cfg, E.person(r.cfg, 'p_gulden'), '2026-12') === 6, 'Gülden 5 iş günü izinde: hedef 128 saat → 6 nöbet');

/* Görevler arasında fark yok: aynı sayıda nöbet tutan (izinsiz) herkesin ay farkı aynı olmalı;
   ör. Kutay 6 Enformasyon + 1 ek gün, diğerleri 5 + 2 tuttuysa hepsi aynı. */
{
  const cfg = E.defaultConfig();
  Object.assign(cfg.posts[1], { assign: 'all', every: 4, mode: 'daily' });
  const sc = { '2026-11': E.sampleNovember() };
  sc['2026-12'] = E.generate(cfg, sc, '2026-12', { seed: 4 });
  const rows = cfg.people.map(p => ({ p, m: E.balanceDetail(cfg, sc, p.id).months.find(x => x.ym === '2026-12') }));
  const byCount = {};
  rows.forEach(r => { (byCount[r.m.count] = byCount[r.m.count] || []).push(r.m.diff); });
  Object.entries(byCount).forEach(([n, ds]) => check(Math.max(...ds) - Math.min(...ds) < 1e-6, n + ' nöbet tutanların ay farkı aynı olmalı: ' + ds.map(x => (x * 24).toFixed(1)).join(', ')));
  const tot = rows.reduce((a, r) => a + r.m.diff, 0);
  check(Math.abs(tot) < 1e-6, 'ay farklarının toplamı 0 olmalı');
  console.log('\n== Tüm görevler birlikte (Aralık): ' + rows.map(r => r.p.name + ' ' + r.m.count + ' nöbet ' + (r.m.diff * 24 >= 0 ? '+' : '') + (r.m.diff * 24).toFixed(0) + ' sa').join(', '));
}

/* Fazla mesai bakiyesi: yalnızca kesinleşmiş aylar; fazla mesai izni iş günü başına 8 saat düşer. */
{
  const cfg = E.defaultConfig();
  Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' });
  const sc = { '2026-11': E.sampleNovember() };
  sc['2026-12'] = E.generate(cfg, sc, '2026-12', { seed: 3 });
  const L0 = E.overtimeLedger(cfg, sc, 'p_zeynep');
  check(!L0.months.some(m => m.ym === '2026-12'), 'taslak ay bakiyeye girmemeli');
  check(!L0.months.some(m => m.ym === '2026-11'), 'kural öncesi Kasım bakiyeye girmemeli');
  check(!E.validate(cfg, sc, '2026-11').some(i => /mesai/.test(i.msg)), 'Kasım için mesai uyarısı çıkmamalı');
  sc['2026-12'].status = 'final';
  const row = E.monthHours(cfg, sc['2026-12'], '2026-12').find(r => r.person.id === 'p_zeynep');
  const L1 = E.overtimeLedger(cfg, sc, 'p_zeynep');
  check(Math.abs(L1.earned - L0.earned - (row.hours - 168)) < 1e-9, 'kesinleşen ayın farkı bakiyeye eklenmeli');
  /* 2027-01-04..05 (Pzt-Sal) = 2 iş günü → 16 saat */
  cfg.leaves = [{ id: 'm1', personId: 'p_zeynep', type: 'mesai', from: '2027-01-04', to: '2027-01-05' }];
  const L2 = E.overtimeLedger(cfg, sc, 'p_zeynep');
  check(L2.used === 16 && Math.abs(L2.balance - (L1.balance - 16)) < 1e-9, 'fazla mesai izni 2 iş günü = 16 saat düşmeli');
  /* Fazla mesai izni günleri o ayın hedefini de düşürür (izin mesaiden sayılır). */
  check(Math.abs(E.hoursTarget(cfg, E.person(cfg, 'p_zeynep'), '2027-01') - 168) < 1e-9, 'eski fazla mesai kaydı yeni nöbet bırakma bilgisi olmadan hedefi azaltmamalı');
  console.log('\n== Fazla mesai: Zeynep biriken ' + L1.earned + ' sa, izin sonrası kalan ' + L2.balance + ' sa');
}

console.log(fail ? '\n' + fail + ' kontrol başarısız' : '\ntamam');
process.exit(fail ? 1 : 0);
