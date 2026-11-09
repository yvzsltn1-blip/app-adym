/* İzinle boşalan nöbet: aday listesi, yöneticinin seçimi, kayıt ve bakiye etkisi (±1 nöbet = ±24 saat). */
import * as E from '../public/js/engine.js';
let fail = 0;
const check = (c, m) => { if (!c) { fail++; console.log('  HATA: ' + m); } };
const cfg = E.defaultConfig();
Object.assign(cfg.posts[1], { assign: 'pool', poolIds: ['p_ismail', 'p_gulden', 'p_kutay'], every: 4, mode: 'daily' });
const sc = { '2026-11': E.sampleNovember() };
sc['2026-12'] = E.generate(cfg, sc, '2026-12', { seed: 3 });
sc['2026-12'].status = 'final';
/* Zeynep'in uygun adayı olan bir Enformasyon nöbeti (24/72 sıkı olduğundan her günde olmayabilir) */
let d, date, c2, opts, leave;
for (const i of [...Array(31).keys()].filter(i => E.dayList(sc['2026-12'], 'enf', i).includes('p_zeynep'))) {
  date = E.dateOf('2026-12', i); leave = { id: 'L1', personId: 'p_zeynep', type: 'mazeret', from: date, to: date };
  c2 = { ...cfg, leaves: [leave] }; opts = E.coverOptions(c2, sc, 'p_zeynep', date, date); d = i;
  if (opts[0].options.some(o => o.ok)) break;
}
check(opts.length === 1 && opts[0].postId === 'enf', 'tek boşalan nöbet listelenmeli');
const okList = opts[0].options.filter(o => o.ok);
console.log(date + ' adaylar: ' + opts[0].options.map(o => o.person.name + (o.ok ? '' : '✗') + ' ' + (o.bal * 24).toFixed(0)).join(', '));
check(okList.every((o, i) => i === 0 || okList[i - 1].score <= o.score), 'uygun adaylar bakiyeye göre sıralı olmalı');
check(!opts[0].options.some(o => o.person.id === 'p_zeynep'), 'izinli kişi aday olmamalı');
check(opts[0].options.filter(o => !o.ok).every(o => o.notes.length), 'uygun olmayanın nedeni yazılmalı');
/* Yönetici bir kişi seçsin: uygun aday varsa listedeki sonuncusu (önerilen değil), yoksa kurala uymayan biri (yönetici kararı). */
/* Ek günden kaydırılan aday fazladan çalışmış olmaz; bakiye kontrolü için gerçekten fazladan tutacak birini seç. */
const fresh = okList.filter(o => !o.move);
const pick = (fresh.length ? fresh[fresh.length - 1] : opts[0].options.find(o => !o.move && !o.notes.some(n => /Aynı gün/.test(n)))).person.id;
console.log('seçilen: ' + pick + (okList.length ? '' : ' (uygun aday yoktu, yönetici kararı)'));
const before = E.balanceDetail(c2, sc, pick).balance, beforeZ = E.balanceDetail(c2, sc, 'p_zeynep').balance;
const plan = E.coverLeave(c2, sc, 'p_zeynep', date, date, { picks: { [opts[0].key]: pick }, leaveId: 'L1', type: 'mazeret' });
const s2 = { ...sc, ...plan.schedules };
check(E.dayList(s2['2026-12'], 'enf', d).join() === pick, 'seçilen kişi yazılmalı');
const cov = (s2['2026-12'].covers || []).find(x => x.d === d);
check(cov && cov.from === 'p_zeynep' && cov.to === pick && cov.leaveId === 'L1', 'yerine tutma kaydı tutulmalı');
const after = E.balanceDetail(c2, s2, pick), afterZ = E.balanceDetail(c2, s2, 'p_zeynep');
check(Math.abs(after.balance - before - 1) < 1e-9, 'yerine tutanın bakiyesi +1 nöbet (+24 sa) artmalı');
check(Math.abs(afterZ.balance - beforeZ + 1) < 1e-9, 'izinlinin (telafi edilir) bakiyesi −1 nöbet (−24 sa) olmalı');
check(after.covers.some(x => x.sign === 1 && x.other === 'p_zeynep') && afterZ.covers.some(x => x.sign === -1 && x.other === pick), 'ayrıntıda her iki tarafta da görünmeli');
/* Boş bırakma */
const plan2 = E.coverLeave(c2, sc, 'p_zeynep', date, date, { picks: { [opts[0].key]: '' } });
check(!E.dayList(plan2.schedules['2026-12'], 'enf', d).length, 'boş bırak seçilince gün boş kalmalı');
/* "Ayın kalanını yeniden düzenle": 24/72 korunmalı, yerine tutan kayda geçmeli, önceki günler değişmemeli. */
{
  const dd = [...Array(31).keys()].filter(i => E.dayList(sc['2026-12'], 'enf', i).includes('p_zeynep'))[1];
  const dt = E.dateOf('2026-12', dd), lv = { id: 'L2', personId: 'p_zeynep', type: 'mazeret', from: dt, to: dt }, c3 = { ...cfg, leaves: [lv] };
  const o3 = E.coverOptions(c3, sc, 'p_zeynep', dt, dt);
  const p3 = E.coverLeave(c3, sc, 'p_zeynep', dt, dt, { picks: { [o3[0].key]: '*' }, leaveId: 'L2', type: 'mazeret', seed: 2 });
  const s3 = { ...sc, ...p3.schedules };
  const errs = E.validate(c3, s3, '2026-12').filter(i => i.level === 'error');
  const cv = (s3['2026-12'].covers || []).find(x => x.d === dd);
  console.log('yeniden düzenle ' + dt + ': yerine ' + (cv && cv.to) + ', ihlal ' + errs.length + (errs.length ? ' ' + errs[0].msg : ''));
  /* İzin günü sabit kalan önceki günler yüzünden o güne kuralla kimse sığmayabilir; başka günde ihlal olmamalı. */
  check(errs.every(i => i.day === dd), 'yeniden düzenleme izin günü dışında kural ihlali üretmemeli');
  check(cv && cv.to && cv.to !== 'p_zeynep', 'yeniden düzenlemede yerine tutan kayda geçmeli');
  let same = true;
  for (let i = 0; i < dd; i++) for (const p of cfg.posts) if (E.dayList(sc['2026-12'], p.id, i).join() !== E.dayList(s3['2026-12'], p.id, i).join()) same = false;
  check(same, 'izinden önceki günler değişmemeli');
}
/* Genel bakiye = görev bakiyeleri toplamı */
const cum = E.balancesBefore(cfg, sc, '2027-01');
const sumPosts = Object.values(cum).reduce((a, o) => a + ((o.p_gulden || {}).bal || 0), 0);
check(Math.abs(E.balanceDetail(cfg, sc, 'p_gulden').balance - sumPosts) < 1e-9, 'genel bakiye görev bakiyelerinin toplamı olmalı');
console.log(fail ? fail + ' kontrol başarısız' : 'tamam');
process.exit(fail ? 1 : 0);
