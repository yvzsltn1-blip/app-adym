/* Nöbet motoru: tarih yardımcıları, uygunluk, devreden bakiye, otomatik dağıtım ve denetim.
   Saf modüldür; tarayıcıda ve Node'da (test) aynı şekilde çalışır.

   Temel kavramlar
   - Gün d (0 tabanlı), d. günün 08:00'inden ertesi gün 08:00'e kadar süren 24 saatlik nöbettir.
   - 24/72: nöbetten sonra 72 saat dinlenme. Aynı kişinin iki nöbeti arasında en az
     (nöbet + dinlenme) / 24 = 4 gün olmalıdır.
   - "Günlük" görev her gün belirli sayıda kişiyle doldurulur. "Döngü" görevinde ise kişi
     kendi 24/72 döngüsünü izinli günler dışında kesintisiz sürdürür.
   - Hak (adil pay): her gün, o gün nöbet beklenen kişiler arasında eşit bölünür. Telafi
     gerektiren izinlerde (ör. rapor) kişi beklenmeye devam eder; tutamadığı nöbet eksi
     bakiye olarak sonraki aylara devreder. Telafi gerektirmeyen izinlerde payı diğerlerine geçer.
   - Bakiye = önceki aylardaki (tutulan − hak) toplamı + elle girilen devirler.
     Artı bakiye fazla nöbet tutulduğunu gösterir; sonraki çizelgede kişiye daha az nöbet yazılır. */

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const CATS = [
  { key: 'wd', label: 'Hafta içi', short: 'H.içi' },
  { key: 'fri', label: 'Cuma', short: 'Cuma' },
  { key: 'sat', label: 'Cumartesi', short: 'Cmt' },
  { key: 'sun', label: 'Pazar', short: 'Pazar' },
  { key: 'hol', label: 'Bayram / tatil', short: 'Tatil' }
];
const HARD = 10000;
const HOURS_W = 3000;   /* mesai hedefinin altında kalan her nöbet */
const EXTRA_W = 40;     /* mesai için açılan her ek gün (gereksiz yere açılmasın) */

/* ---------- Tarih ---------- */
export const pad = n => (n < 10 ? '0' : '') + n;
export function ymParts(ym) { const [y, m] = ym.split('-').map(Number); return { y, m }; }
export function daysIn(ym) { const { y, m } = ymParts(ym); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function dateOf(ym, d) { return ym + '-' + pad(d + 1); }
export function addMonths(ym, n) {
  const { y, m } = ymParts(ym); const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1);
}
function utc(date) { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); }
export function addDays(date, n) {
  const t = new Date(utc(date) + n * 864e5);
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
}
export function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); }
export function weekdayOf(date) { return new Date(utc(date)).getUTCDay(); }
export function monthLabel(ym) { const { y, m } = ymParts(ym); return MONTHS[m - 1] + ' ' + y; }
export function fmtDate(date) { const [y, m, d] = date.split('-'); return +d + '.' + +m + '.' + y; }
export function fmtDateLong(date) { const [y, m, d] = date.split('-'); return +d + ' ' + MONTHS[+m - 1] + ' ' + y + ', ' + WEEKDAYS[weekdayOf(date)]; }
export function ymOf(date) { return date.slice(0, 7); }

/* ---------- Kişi ve kurallar ---------- */
const trUpper = s => String(s || '').toLocaleUpperCase('tr');
export function fullName(p) { return p ? (p.name + ' ' + trUpper(p.surname)).trim() : '?'; }
export function listName(p) { return p ? fullName(p) + (p.code ? '-' + p.code : '') : '?'; }
export function initials(p) { return p ? (trUpper(p.name)[0] || '') + (trUpper(p.surname)[0] || '') : '?'; }

export function cycleDays(cfg) {
  const s = cfg.settings || {};
  return Math.max(1, Math.round(((+s.shiftHours || 24) + (+s.restHours || 72)) / 24));
}
export function holidayOn(cfg, date) { return (cfg.holidays || []).find(h => h.date === date) || null; }
export function dayCat(cfg, date) {
  if (holidayOn(cfg, date)) return 'hol';
  const w = weekdayOf(date);
  return w === 0 ? 'sun' : w === 6 ? 'sat' : w === 5 ? 'fri' : 'wd';
}
export function leaveOn(cfg, pid, date) {
  return (cfg.leaves || []).find(l => l.personId === pid && l.from <= date && date <= l.to) || null;
}
export function leaveType(cfg, id) { return (cfg.leaveTypes || []).find(t => t.id === id) || { id, name: 'İzin', compensate: true }; }
export function person(cfg, id) { return (cfg.people || []).find(p => p.id === id) || null; }
export function post(cfg, id) { return (cfg.posts || []).find(p => p.id === id) || null; }
/* Görevi kimler tutar? post.assign:
   - yok / 'people': personel kartında bu görevi işaretli olanlar (varsayılan)
   - 'fixed': sabit tek kişi (fixedId), kendi 24/72 döngüsünde
   - 'pool': seçilen kişiler (poolIds) arasında dönüşümlü
   - 'all': tüm personel arasında karışık
   - 'off': görev kapalı */
export function postPeople(cfg, postId) {
  const pst = post(cfg, postId);
  if (!pst) return [];
  /* Sabit döngü görevindeki kişi (ör. sabit 2. nöbetçi) diğer görevlerin dağıtımına girmez; 24/72 döngüsü zaten o görevle dolar. */
  const fixedElsewhere = isCyclePost(pst) ? [] : (cfg.posts || []).filter(x => x.id !== pst.id && isActivePost(x) && x.assign === 'fixed' && x.fixedId).map(x => x.fixedId);
  const all = (cfg.people || []).filter(p => !fixedElsewhere.includes(p.id));
  switch (pst.assign) {
    case 'off': return [];
    case 'fixed': return all.filter(p => p.id === pst.fixedId);
    case 'pool': return all.filter(p => (pst.poolIds || []).includes(p.id));
    case 'all': return all.filter(p => p.active !== false);
    default: return all.filter(p => (p.posts || []).includes(postId));
  }
}
export const isActivePost = pst => !!pst && pst.assign !== 'off' && pst.mode !== 'off';
/* Döngü: sabit kişi kendi 24/72 döngüsünde (eski 'cycle' kayıtları da). */
export const isCyclePost = pst => !!pst && (pst.assign === 'fixed' || (!pst.assign && pst.mode === 'cycle'));
/* "Her N günde bir" görevlerde o gün nöbet gerekiyor mu? Sayım sabit bir başlangıç gününe göre yapılır, aylar arasında kaymaz. */
export function needOn(pst, date) {
  const every = Math.max(1, +pst.every || 1);
  if (every === 1) return true;
  const i = diffDays(pst.anchor || '2026-11-01', date);
  return ((i % every) + every) % every === 0;
}
/* Ayda gösterilecek görevler: etkin olanlar + o ay kaydı bulunan kapatılmış görevler. İlki "ana görev"dir. */
export function monthPosts(cfg, sched) {
  return (cfg.posts || []).filter(p => isActivePost(p) || (sched && sched.assign && (sched.assign[p.id] || []).some(Boolean)));
}

/* Kişinin o gün nöbet tutamama nedeni; tutabiliyorsa null.
   kind: 'leave' (izin), 'off' (kişisel gün kısıtı), 'out' (görevde değil / pasif). */
export function blockOn(cfg, p, date) {
  if (p.active === false) return { kind: 'out', why: 'Pasif personel' };
  if (p.startDate && date < p.startDate) return { kind: 'out', why: 'Göreve başlamadan önce' };
  if (p.endDate && date > p.endDate) return { kind: 'out', why: 'Görevden ayrıldıktan sonra' };
  const l = leaveOn(cfg, p.id, date);
  if (l) { const t = leaveType(cfg, l.type); return { kind: 'leave', why: t.name, compensate: t.compensate !== false, leave: l }; }
  if ((p.offWeekdays || []).includes(weekdayOf(date))) return { kind: 'off', why: WEEKDAYS[weekdayOf(date)] + ' günleri nöbet tutmuyor' };
  const r = dateRuleOn(cfg, p.id, date, 'cannot');
  if (r) return { kind: 'rule', why: 'Özel kural: nöbet tutamaz' + (r.note ? ' (' + r.note + ')' : '') };
  return null;
}

/* ---------- Özel kurallar ----------
   { type: 'date', personId, mode: 'must' | 'cannot', from, to, postId?, note }  → o tarihlerde mutlaka tutar / tutamaz
   { type: 'apart', a, b }                                                     → aynı gün nöbette olamazlar */
export function dateRuleOn(cfg, pid, date, mode) {
  return (cfg.rules || []).find(r => r.type === 'date' && r.personId === pid && r.mode === mode && r.from <= date && date <= r.to) || null;
}
export function apartPairs(cfg) {
  return (cfg.rules || []).filter(r => r.type === 'apart' && r.a && r.b && r.a !== r.b).map(r => [r.a, r.b]);
}
/* Hafta sonu kimliği: Cumartesi ve Pazar aynı numarayı alır; hafta içi için null. */
export function weekendKey(date) {
  const w = weekdayOf(date);
  if (w !== 0 && w !== 6) return null;
  return Math.round((utc(date) - (w === 0 ? 864e5 : 0)) / (7 * 864e5));
}
export const shareOf = p => (p && p.share != null && p.share !== '' ? Math.max(0, +p.share) : 100) / 100;
/* ---------- Aylık mesai ----------
   settings.monthlyHours: kişi başı aylık mesai hedefi (yoksa 160, 0 = uygulanmaz).
   İzinli iş günleri (görevlendirme dahil) mesaiden sayılır: gün başına hedef/20 saat düşer.
   Ay içinde başlayan / ayrılan personelde hedef çalıştığı gün oranında azalır; nöbet payı (%) da uygulanır. */
export function monthlyHoursOf(cfg) {
  const v = cfg && cfg.settings && cfg.settings.monthlyHours;
  return v == null || v === '' ? 160 : Math.max(0, +v || 0);
}
export function hoursTarget(cfg, p, ym, evenInactive) {
  const H = monthlyHoursOf(cfg);
  if (!H || !p || (p.active === false && !evenInactive)) return 0;
  const D = daysIn(ym);
  let inDays = 0, leaveWd = 0;
  for (let d = 0; d < D; d++) {
    const date = dateOf(ym, d);
    if ((p.startDate && date < p.startDate) || (p.endDate && date > p.endDate)) continue;
    inDays++;
    if (leaveOn(cfg, p.id, date) && isWorkday(cfg, date)) leaveWd++;
  }
  return Math.max(0, H * shareOf(p) * inDays / D - leaveWd * H / 20);
}
/* Hedefi doldurmak için gereken en az nöbet sayısı (24 saatlik nöbetle 160 saat → 7). */
export function minShifts(cfg, p, ym) {
  const h = hoursTarget(cfg, p, ym), sh = +((cfg.settings || {}).shiftHours) || 24;
  return h > 0 ? Math.ceil(h / sh - 1e-9) : 0;
}
/* Ayın mesai tablosu: görevlerden herhangi birinde bulunan kişiler için tutulan nöbet/saat ve hedef. */
export function monthHours(cfg, sched, ym) {
  const D = daysIn(ym), sh = +((cfg.settings || {}).shiftHours) || 24, ids = new Set();
  for (const pst of cfg.posts || []) if (isActivePost(pst)) postPeople(cfg, pst.id).forEach(p => ids.add(p.id));
  const cnt = {};
  for (let d = 0; d < D; d++) {
    const seen = new Set();
    for (const pst of cfg.posts || []) dayList(sched, pst.id, d).forEach(id => seen.add(id));
    seen.forEach(id => { ids.add(id); cnt[id] = (cnt[id] || 0) + 1; });
  }
  return [...ids].map(id => person(cfg, id)).filter(Boolean).map(p => {
    const n = cnt[p.id] || 0, target = hoursTarget(cfg, p, ym);
    return { person: p, shifts: n, hours: n * sh, target, need: minShifts(cfg, p, ym) };
  });
}
/* Fazla mesai bakiyesi (saat). Her ayın hedefi sabittir (ör. 160); kesinleşmiş her ayda tutulan
   saat − hedef bakiyeye yazılır (eksik kalınan ay eksi yazılır). "Fazla mesaiden düşer" işaretli
   izin türlerinde her iş günü hedef/20 saat (160 → 8 saat) bakiyeden düşülür.
   Taslak aylar sayılmaz; bakiye başlangıç ayından önceki aylar da sayılmaz. */
/* Mesai bakiyesinin başladığı ay. Mesai kuralı Aralık 2026 çizelgesiyle başladığından, ayarlanmamışsa o ay. */
export function hoursStartOf(cfg) {
  const s = (cfg && cfg.settings) || {};
  return s.hoursStartMonth || '2026-12';
}
export function overtimeLedger(cfg, schedules, pid) {
  const H = monthlyHoursOf(cfg), p = person(cfg, pid);
  if (!H || !p) return null;
  const start = hoursStartOf(cfg), sh = +((cfg.settings || {}).shiftHours) || 24;
  const months = Object.keys(schedules).filter(m => m >= start && schedules[m] && schedules[m].status === 'final').sort().map(m => {
    const s = schedules[m], D = daysIn(m);
    let n = 0;
    for (let d = 0; d < D; d++) if ((cfg.posts || []).some(pst => dayList(s, pst.id, d).includes(pid))) n++;
    const target = hoursTarget(cfg, p, m, true);
    return { ym: m, shifts: n, hours: n * sh, target, diff: n * sh - target };
  }).filter(r => r.shifts || r.target);
  const earned = months.reduce((a, r) => a + r.diff, 0);
  const uses = (cfg.leaves || []).filter(l => l.personId === pid && leaveType(cfg, l.type).overtime && l.from.slice(0, 7) >= start)
    .map(l => ({ leave: l, days: leaveWorkdays(cfg, l, l.from, l.to), hours: leaveWorkdays(cfg, l, l.from, l.to) * H / 20 }));
  const used = uses.reduce((a, u) => a + u.hours, 0);
  return { months, earned, uses, used, balance: earned - used, dayHours: H / 20 };
}

/* Hak hesabında kişi o gün "beklenen" mi? Telafi gerektiren izinde beklenmeye devam eder. */
function expectedOn(cfg, p, date) {
  const b = blockOn(cfg, p, date);
  return !b || (b.kind === 'leave' && b.compensate);
}

/* ---------- Çizelge verisi ----------
   sched = { ym, status, assign: { [postId]: ["pid", "pid,pid", "", ...] }, pins: { [postId]: [gün, ...] } }
   (Firestore iç içe diziye izin vermediği için gün başına virgülle ayrılmış metin tutulur.) */
export function dayList(sched, postId, d) {
  const a = sched && sched.assign && sched.assign[postId];
  const s = a && a[d];
  return s ? s.split(',').filter(Boolean) : [];
}
export function setDayList(sched, postId, d, ids) {
  const D = daysIn(sched.ym);
  sched.assign = sched.assign || {};
  const a = sched.assign[postId] || new Array(D).fill('');
  while (a.length < D) a.push('');
  a[d] = ids.filter(Boolean).join(',');
  sched.assign[postId] = a;
}
export function isPinned(sched, postId, d) { return !!(sched && sched.pins && (sched.pins[postId] || []).includes(d)); }
export function emptySchedule(ym) { return { ym, status: 'draft', assign: {}, pins: {} }; }

/* Bir kişinin belirli bir tarih aralığındaki tüm nöbet tarihleri (tüm görevler). */
function shiftDates(cfg, schedules, pid, from, to) {
  const out = [];
  let ym = ymOf(from);
  const last = ymOf(to);
  while (ym <= last) {
    const s = schedules[ym];
    if (s) {
      const D = daysIn(ym);
      for (let d = 0; d < D; d++) {
        const date = dateOf(ym, d);
        if (date < from || date > to) continue;
        for (const pst of cfg.posts || []) if (dayList(s, pst.id, d).includes(pid)) { out.push(date); break; }
      }
    }
    ym = addMonths(ym, 1);
  }
  return out;
}

/* ---------- Hak, bakiye ---------- */
function blankRow() { const c = {}; CATS.forEach(k => { c[k.key] = 0; }); return { count: 0, fair: 0, cats: { ...c }, catFair: { ...c }, expectedDays: 0, leaveDays: 0 }; }

/* Bir ayın tek bir görev için kişi bazında sayıları ve hakları. */
/* O ayın görev kadrosu. Kadro sonradan değişse de geçmiş aylar kendi kadrosuyla hesaplanır:
   çizelge oluşturulurken kaydedilen kadro (sched.pools) varsa o, yoksa o ay bu görevde nöbet tutmuş
   ya da izinli olan güncel kadro üyeleri. Henüz atama yoksa (yeni ay) güncel kadro. */
export function monthPool(cfg, sched, ym, pst) {
  /* Görevler arasında fark yok: günlük görevlerin payı, herhangi bir günlük görevde nöbet tutabilen
     herkes arasında bölünür (birleşik kadro). Döngü görevleri (sabit kişi) kendi kadrosuyla kalır. */
  if (isCyclePost(pst)) return postPool(cfg, sched, ym, pst);
  const ids = new Set();
  for (const x of cfg.posts || []) {
    if (isCyclePost(x)) continue;
    const used = sched && sched.assign && (sched.assign[x.id] || []).some(Boolean);
    if (!isActivePost(x) && !used && x.id !== pst.id) continue;
    postPool(cfg, sched, ym, x).forEach(p => ids.add(p.id));
  }
  return (cfg.people || []).filter(p => ids.has(p.id));
}
function postPool(cfg, sched, ym, pst) {
  const snap = sched && sched.pools && sched.pools[pst.id];
  if (snap) return (cfg.people || []).filter(p => snap.includes(p.id));
  const pool = postPeople(cfg, pst.id);
  const a = sched && sched.assign && sched.assign[pst.id];
  if (!a || !a.some(Boolean)) return pool;
  const held = new Set(); a.forEach(x => (x || '').split(',').forEach(id => id && held.add(id)));
  const from = dateOf(ym, 0), to = dateOf(ym, daysIn(ym) - 1);
  return pool.filter(p => held.has(p.id) || (cfg.leaves || []).some(l => l.personId === p.id && l.from <= to && l.to >= from));
}

export function monthPostStats(cfg, sched, ym, pst) {
  const D = daysIn(ym), pool = monthPool(cfg, sched, ym, pst), rows = {};
  const all = new Set(pool.map(p => p.id));
  for (let d = 0; d < D; d++) for (const id of dayList(sched, pst.id, d)) all.add(id);
  all.forEach(id => { rows[id] = blankRow(); });
  /* Mesai hedefi için açılan ek günler normal gün gibi sayılır: o günün payı nöbet beklenen herkese bölünür. */
  const extra = new Set((sched && sched.extra && sched.extra[pst.id]) || []);
  for (let d = 0; d < D; d++) {
    const date = dateOf(ym, d), cat = dayCat(cfg, date);
    for (const id of dayList(sched, pst.id, d)) { rows[id].count++; rows[id].cats[cat]++; }
    const exp = pool.filter(p => expectedOn(cfg, p, date));
    pool.forEach(p => {
      const b = blockOn(cfg, p, date);
      if (b && b.kind === 'leave') rows[p.id].leaveDays++;
    });
    if (isCyclePost(pst) || !isActivePost(pst) || (!needOn(pst, date) && !extra.has(d)) || !exp.length) continue;
    /* Her günün nöbeti, o gün beklenenler arasında kişisel pay oranına göre bölünür (varsayılan %100). */
    const tw = exp.reduce((a, p) => a + shareOf(p), 0);
    if (!tw) continue;
    exp.forEach(p => { const share = (+pst.required || 1) * shareOf(p) / tw, r = rows[p.id]; r.fair += share; r.catFair[cat] += share; r.expectedDays++; });
  }
  return rows;
}

/* ym ayından önceki tüm ayların birikimli bakiyesi: { [postId]: { [pid]: { bal, catBal, count, cats } } } */
export function balancesBefore(cfg, schedules, ym) {
  const out = {};
  for (const pst of cfg.posts || []) out[pst.id] = {};
  const get = (postId, pid) => {
    out[postId] = out[postId] || {};
    if (!out[postId][pid]) { const z = {}; CATS.forEach(k => { z[k.key] = 0; }); out[postId][pid] = { bal: 0, catBal: { ...z }, count: 0, cats: { ...z }, months: 0 }; }
    return out[postId][pid];
  };
  const start = (cfg.settings && cfg.settings.startMonth) || '0000-00';
  Object.keys(schedules).filter(k => k < ym && k >= start).sort().forEach(m => {
    for (const pst of cfg.posts || []) {
      if (isCyclePost(pst)) continue;
      const rows = monthPostStats(cfg, schedules[m], m, pst);
      for (const pid of Object.keys(rows)) {
        const r = rows[pid], g = get(pst.id, pid);
        g.bal += r.count - r.fair; g.count += r.count; g.months++;
        CATS.forEach(k => { g.catBal[k.key] += r.cats[k.key] - r.catFair[k.key]; g.cats[k.key] += r.cats[k.key]; });
      }
    }
  });
  for (const a of cfg.adjustments || []) {
    if (!a.month || a.month >= ym) continue;
    if (!post(cfg, a.postId)) continue;
    const g = get(a.postId, a.personId);
    g.bal += +a.value || 0;
    if (a.cat && g.catBal[a.cat] != null) g.catBal[a.cat] += +a.value || 0;
  }
  return out;
}

/* Bir kişinin nöbet bakiyesinin ayrıntısı (tüm günlük görevler birlikte, nöbet cinsinden; arayüz saate çevirir).
   months: ay ay tutulan, hak, fark ve ay sonu birikimi; adjustments: elle düzeltmeler;
   covers: yerine tutma kayıtları (sign +1: başkasının yerine tuttu, −1: onun yerine başkası tuttu). */
export function balanceDetail(cfg, schedules, pid) {
  const start = (cfg.settings && cfg.settings.startMonth) || '0000-00';
  const daily = (cfg.posts || []).filter(p => !isCyclePost(p));
  const adjs = (cfg.adjustments || []).filter(a => a.personId === pid && post(cfg, a.postId));
  let run = 0;
  const keys = new Set(Object.keys(schedules).filter(m => m >= start));
  adjs.forEach(a => { if (a.month && a.month >= start) keys.add(a.month); });
  const months = [...keys].sort().map(m => {
    let count = 0, fair = 0;
    if (schedules[m]) for (const pst of daily) { const r = monthPostStats(cfg, schedules[m], m, pst)[pid]; if (r) { count += r.count; fair += r.fair; } }
    const adj = adjs.filter(a => a.month === m).reduce((x, a) => x + (+a.value || 0), 0);
    run += count - fair + adj;
    return { ym: m, count, fair, diff: count - fair, adj, cum: run };
  }).filter(r => r.count || r.fair || r.adj);
  const covers = [];
  Object.keys(schedules).filter(m => m >= start).sort().forEach(m => (schedules[m].covers || []).forEach(x => {
    if (x.to === pid) covers.push({ ...x, ym: m, date: dateOf(m, x.d), sign: 1, other: x.from });
    else if (x.from === pid) covers.push({ ...x, ym: m, date: dateOf(m, x.d), sign: -1, other: x.to });
  }));
  return { months, adjustments: adjs, covers, balance: run };
}

/* Bir ayın özet tablosu: görev başına kişi satırları (önceki bakiye, hak, hedef, tutulan, yeni bakiye). */
export function monthSummary(cfg, schedules, ym) {
  const prev = balancesBefore(cfg, schedules, ym), sched = schedules[ym] || emptySchedule(ym);
  return monthPosts(cfg, schedules[ym]).map(pst => {
    const rows = monthPostStats(cfg, sched, ym, pst);
    const list = Object.keys(rows).map(pid => {
      const r = rows[pid], pb = (prev[pst.id] && prev[pst.id][pid]) || { bal: 0, catBal: {} };
      return {
        pid, person: person(cfg, pid), count: r.count, cats: r.cats, fair: r.fair, catFair: r.catFair,
        leaveDays: r.leaveDays, prevBal: pb.bal, target: Math.max(0, r.fair - pb.bal),
        newBal: pb.bal + r.count - r.fair
      };
    }).filter(r => r.person && (r.count || r.fair || (r.person.posts || []).includes(pst.id)));
    return { post: pst, rows: list };
  });
}
/* Görevler arasında fark gözetilmeden: günlük görevlerin kişi satırları tek grupta toplanır
   (post.id = '*'); döngü görevleri (sabit kişi) ayrı kalır. */
export const ALL_POSTS = { id: '*', name: 'Tüm görevler', short: 'Tüm görevler' };
export function monthSummaryAll(cfg, schedules, ym) {
  const groups = monthSummary(cfg, schedules, ym), daily = groups.filter(g => !isCyclePost(g.post)), by = {};
  for (const g of daily) for (const r of g.rows) {
    const t = by[r.pid] = by[r.pid] || { pid: r.pid, person: r.person, count: 0, fair: 0, leaveDays: 0, prevBal: 0, newBal: 0, cats: {}, catFair: {} };
    t.count += r.count; t.fair += r.fair; t.prevBal += r.prevBal; t.newBal += r.newBal; t.leaveDays = Math.max(t.leaveDays, r.leaveDays);
    CATS.forEach(k => { t.cats[k.key] = (t.cats[k.key] || 0) + (r.cats[k.key] || 0); t.catFair[k.key] = (t.catFair[k.key] || 0) + (r.catFair[k.key] || 0); });
  }
  const rows = Object.values(by).map(t => ({ ...t, target: Math.max(0, t.fair - t.prevBal) }));
  return (daily.length ? [{ post: ALL_POSTS, rows }] : []).concat(groups.filter(g => isCyclePost(g.post)));
}

/* ---------- Denetim ---------- */
export function validate(cfg, schedules, ym) {
  const sched = schedules[ym];
  if (!sched) return [];
  const D = daysIn(ym), cyc = cycleDays(cfg), issues = [];
  const add = (level, d, postId, pid, msg) => issues.push({ level, day: d, postId, pid, msg });
  const byPerson = {};
  for (let d = 0; d < D; d++) {
    const date = dateOf(ym, d), seen = {};
    for (const pst of cfg.posts || []) {
      const ids = dayList(sched, pst.id, d);
      if (isActivePost(pst) && !isCyclePost(pst) && needOn(pst, date) && ids.length < (+pst.required || 1)) add('error', d, pst.id, null, pst.name + ' nöbeti boş');
      for (const id of ids) {
        const p = person(cfg, id);
        if (!p) { add('error', d, pst.id, id, 'Silinmiş personel atanmış'); continue; }
        if (seen[id]) add('error', d, pst.id, id, fullName(p) + ' aynı gün iki göreve yazılmış');
        seen[id] = true;
        const b = blockOn(cfg, p, date);
        if (b) add('error', d, pst.id, id, fullName(p) + ': ' + b.why + (b.kind === 'leave' ? ' (izinli)' : ''));
        if (!postPeople(cfg, pst.id).some(x => x.id === id)) add('warn', d, pst.id, id, fullName(p) + ' bu görevin listesinde değil');
        (byPerson[id] = byPerson[id] || []).push(d);
      }
    }
  }
  /* Dinlenme: önceki ayın sonu ve sonraki ayın başı da hesaba katılır. */
  const from = addDays(dateOf(ym, 0), -cyc), to = addDays(dateOf(ym, D - 1), cyc);
  for (const p of cfg.people || []) {
    const dates = shiftDates(cfg, schedules, p.id, from, to);
    for (let i = 1; i < dates.length; i++) {
      const gap = diffDays(dates[i - 1], dates[i]);
      if (gap > 0 && gap < cyc && (ymOf(dates[i]) === ym || ymOf(dates[i - 1]) === ym)) {
        const d = ymOf(dates[i]) === ym ? +dates[i].slice(8) - 1 : +dates[i - 1].slice(8) - 1;
        add('error', d, null, p.id, fullName(p) + ': ' + fmtDate(dates[i - 1]) + ' nöbetinden sonra yalnızca ' + (gap * 24 - 24) + ' saat dinlenip ' + fmtDate(dates[i]) + ' nöbetine giriyor (en az ' + (cyc * 24 - 24) + ' saat olmalı)');
      }
    }
  }
  const S = cfg.settings || {};
  const onDay = (pid, d) => (cfg.posts || []).some(pst => dayList(sched, pst.id, d).includes(pid));
  /* Birlikte tutamaz */
  for (const [a, b] of apartPairs(cfg)) {
    for (let d = 0; d < D; d++) if (onDay(a, d) && onDay(b, d)) add('error', d, null, a, fullName(person(cfg, a)) + ' ile ' + fullName(person(cfg, b)) + ' aynı gün nöbette (birlikte tutamaz kuralı)');
  }
  for (const p of cfg.people || []) {
    const mine = byPerson[p.id] || [];
    /* Ayda en fazla hafta sonu / tatil nöbeti */
    if (S.maxWeekend !== '' && S.maxWeekend != null) {
      const n = mine.filter(d => dayCat(cfg, dateOf(ym, d)) !== 'wd' && dayCat(cfg, dateOf(ym, d)) !== 'fri').length;
      if (n > +S.maxWeekend) add('error', null, null, p.id, fullName(p) + ': ayda en fazla ' + S.maxWeekend + ' hafta sonu/tatil nöbeti tutabilir, ' + n + ' yazılmış');
    }
    /* Art arda iki hafta sonu */
    if (S.noConsecutiveWeekends && (cfg.posts || []).some(pst => isActivePost(pst) && !isCyclePost(pst) && postPeople(cfg, pst.id).some(x => x.id === p.id))) {
      const keys = shiftDates(cfg, schedules, p.id, addDays(dateOf(ym, 0), -8), dateOf(ym, D - 1)).map(dt => ({ dt, k: weekendKey(dt) })).filter(x => x.k != null);
      for (let i = 1; i < keys.length; i++) {
        if (keys[i].k === keys[i - 1].k + 1 && ymOf(keys[i].dt) === ym) add('error', +keys[i].dt.slice(8) - 1, null, p.id, fullName(p) + ' art arda iki hafta sonu nöbet tutuyor');
      }
    }
    /* Mutlaka tutar kuralı */
    for (let d = 0; d < D; d++) {
      const r = dateRuleOn(cfg, p.id, dateOf(ym, d), 'must');
      if (r && !(r.postId ? dayList(sched, r.postId, d).includes(p.id) : onDay(p.id, d))) add('warn', d, null, p.id, fullName(p) + ' için bu güne tanımlı "mutlaka nöbet tutar" kuralı karşılanmadı');
    }
  }
  /* Aylık mesai hedefi */
  if (ym >= hoursStartOf(cfg)) for (const r of monthHours(cfg, sched, ym)) {
    if (r.target > 0 && r.hours + 1e-9 < r.target) add('warn', null, null, r.person.id, fullName(r.person) + ': bu ay ' + r.hours + ' saat (' + r.shifts + ' nöbet); aylık mesai hedefi ' + Math.round(r.target) + ' saat, ' + Math.round(r.target - r.hours) + ' saat eksik');
  }
  return issues;
}

/* ---------- Otomatik dağıtım ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* Döngü görevi: kişi son nöbetinden itibaren her "döngü" günde bir nöbete girer; izinde
   kaldığı günler atlanır, izin dönüşü ilk uygun gün yeniden başlar. */
function fillCycle(cfg, schedules, sched, ym, pst, busy) {
  const D = daysIn(ym), cyc = cycleDays(cfg), pool = postPeople(cfg, pst.id).filter(p => p.active !== false);
  const pinned = new Set((sched.pins && sched.pins[pst.id]) || []);
  const keep = {};
  for (const d of pinned) keep[d] = dayList(sched, pst.id, d);
  sched.assign[pst.id] = new Array(D).fill('');
  for (const d of pinned) setDayList(sched, pst.id, d, keep[d]);
  pool.forEach((p, i) => {
    const past = shiftDates(cfg, schedules, p.id, addDays(dateOf(ym, 0), -40), addDays(dateOf(ym, 0), -1));
    let next = past.length ? diffDays(dateOf(ym, 0), addDays(past[past.length - 1], cyc)) : i % cyc;
    if (next < 0) next = 0;
    let d = next;
    while (d < D) {
      const date = dateOf(ym, d);
      if (pinned.has(d)) { if (dayList(sched, pst.id, d).includes(p.id)) { d += cyc; continue; } }
      const reserved = [...(busy[p.id] || []), ...[...pinned].filter(x => (keep[x] || []).includes(p.id))];
      const ok = !blockOn(cfg, p, date) && !reserved.some(x => Math.abs(x - d) < cyc) && !pinned.has(d);
      if (ok) {
        setDayList(sched, pst.id, d, dayList(sched, pst.id, d).concat(p.id));
        (busy[p.id] = busy[p.id] || new Set()).add(d);
        d += cyc;
      } else d++;
    }
  });
}

/* Günlük görevleri (ana görev + dönüşümlü 2. nöbetçi vb.) birlikte, tavlama benzetimiyle doldurur.
   Birlikte çözmek önemlidir: önce birini doldurup sonra diğerine geçmek 24/72 nedeniyle çıkmaza girer. */
function fillDaily(cfg, schedules, sched, ym, posts, busy, prevBal, opts) {
  const D = daysIn(ym), cyc = cycleDays(cfg), NP = posts.length;
  const rand = rng(opts.seed || (Date.now() ^ 0x5bd1e995));
  const pools = posts.map(pst => postPeople(cfg, pst.id));
  const people = []; const idx = {};
  pools.forEach(pl => pl.forEach(p => { if (idx[p.id] == null) { idx[p.id] = people.length; people.push(p); } }));
  const P = people.length;
  const catIdx = {}; CATS.forEach((c, i) => { catIdx[c.key] = i; });
  const NC = CATS.length;
  const dayCatI = [], wdOf = [];
  for (let d = 0; d < D; d++) { dayCatI.push(catIdx[dayCat(cfg, dateOf(ym, d))]); wdOf.push(weekdayOf(dateOf(ym, d))); }

  /* Hedefler (kişi × görev): hak − devreden bakiye; gün türü hedefleri. */
  const inPool = new Uint8Array(P * NP), need = new Float64Array(P * NP), catNeed = new Float64Array(P * NP * NC);
  posts.forEach((pst, j) => {
    const stats = monthPostStats(cfg, emptySchedule(ym), ym, pst);
    pools[j].forEach(p => {
      const i = idx[p.id], r = stats[p.id], b = (prevBal[pst.id] && prevBal[pst.id][p.id]) || { bal: 0, catBal: {} };
      inPool[i * NP + j] = 1;
      need[i * NP + j] = r.fair - b.bal;
      CATS.forEach((c, k) => { catNeed[(i * NP + j) * NC + k] = r.catFair[c.key] - (b.catBal[c.key] || 0); });
    });
  });
  /* Görevler arasında fark yoktur: her nöbet aynı sayılır. Hedef kişi başına tüm görevlerin toplamıdır
     (pay, birleşik kadroya bölünür; kişi o görevin listesinde olmasa da o görevden pay alır). */
  const inAny = new Uint8Array(P), needT = new Float64Array(P), catNeedT = new Float64Array(P * NC);
  posts.forEach(pst => {
    const stats = monthPostStats(cfg, emptySchedule(ym), ym, pst);
    people.forEach((p, i) => {
      const r = stats[p.id], b = (prevBal[pst.id] && prevBal[pst.id][p.id]) || { bal: 0, catBal: {} };
      if (!r && !b.bal) return;
      inAny[i] = 1; needT[i] += (r ? r.fair : 0) - b.bal;
      CATS.forEach((c, k) => { catNeedT[i * NC + k] += (r ? r.catFair[c.key] : 0) - (b.catBal[c.key] || 0); });
    });
  });
  /* Ay dışındaki ve döngü görevlerindeki nöbetler (dinlenme hesabı için). */
  const outside = people.map(p => {
    const before = shiftDates(cfg, schedules, p.id, addDays(dateOf(ym, 0), -cyc), addDays(dateOf(ym, 0), -1)).map(dt => diffDays(dateOf(ym, 0), dt));
    const after = schedules[addMonths(ym, 1)] ? shiftDates(cfg, schedules, p.id, dateOf(addMonths(ym, 1), 0), addDays(dateOf(addMonths(ym, 1), 0), cyc)).map(dt => diffDays(dateOf(ym, 0), dt)) : [];
    const other = busy[p.id] ? [...busy[p.id]] : [];
    return before.concat(other, after).sort((a, b) => a - b);
  });

  /* Aylık mesai: kişi başı en az nöbet. Hedef tutmuyorsa her gün olmayan görevlere (ör. 2. nöbetçi)
     normal günleri dışında "ek gün" yeri açılır (-3 = boş bırakılabilir). */
  const hoursOn = monthlyHoursOf(cfg) > 0;
  const minS = people.map(p => (hoursOn ? minShifts(cfg, p, ym) : 0));
  const optPost = posts.map(pst => hoursOn && Math.max(1, +pst.every || 1) > 1);

  /* Yerler: gün sırasıyla, her gün için görevlerin kişi yerleri. */
  const sPost = [], sDay = [], slotV = [], fixedA = [], elig = [], optA = [];
  for (let d = 0; d < D; d++) {
    const date = dateOf(ym, d);
    posts.forEach((pst, j) => {
      const req = Math.max(1, +pst.required || 1), needed = needOn(pst, date);
      const avail = pools[j].filter(p => !blockOn(cfg, p, date) && !(busy[p.id] && busy[p.id].has(d))).map(p => idx[p.id]);
      const list = needed ? avail : [];
      if (!needed && (optPost[j] || isPinned(sched, pst.id, d))) {
        const pinIds = isPinned(sched, pst.id, d) ? dayList(sched, pst.id, d).filter(id => idx[id] != null) : [];
        if (pinIds.length) pinIds.forEach(id => { sPost.push(j); sDay.push(d); elig.push([]); slotV.push(idx[id]); fixedA.push(1); optA.push(1); });
        else if (optPost[j]) { sPost.push(j); sDay.push(d); elig.push(avail); slotV.push(-3); fixedA.push(0); optA.push(1); }
        return;
      }
      const pinned = needed && isPinned(sched, pst.id, d), pinIds = pinned ? dayList(sched, pst.id, d) : [];
      const must = needed && !pinned ? list.filter(i => { const r = dateRuleOn(cfg, people[i].id, date, 'must'); return r && (!r.postId || r.postId === pst.id); }) : [];
      for (let k = 0; k < req; k++) {
        sPost.push(j); sDay.push(d); elig.push(list); optA.push(0);
        if (!needed) { slotV.push(-2); fixedA.push(1); }
        else if (pinned && (!pinIds.length || k < pinIds.length)) { slotV.push(pinIds[k] != null && idx[pinIds[k]] != null ? idx[pinIds[k]] : -1); fixedA.push(1); }
        else if (must[k] != null) { slotV.push(must[k]); fixedA.push(1); }
        else { slotV.push(-1); fixedA.push(0); }
      }
    });
  }
  const S = slotV.length, slot = Int16Array.from(slotV), fixed = Uint8Array.from(fixedA), opt = Uint8Array.from(optA);
  /* Bu ay başka görevlerden (döngü görevi) gelen nöbetler; sabitlenmiş günlük hücreler zaten yerlerde sayılıyor. */
  const pinMine = people.map(() => new Set());
  for (let s = 0; s < S; s++) if (fixed[s] && slot[s] >= 0) pinMine[slot[s]].add(sDay[s]);
  const otherCnt = people.map((p, i) => (busy[p.id] ? [...busy[p.id]].filter(d => d >= 0 && d < D && !pinMine[i].has(d)).length : 0));

  /* Ek kurallar */
  const SET = cfg.settings || {};
  const maxWk = SET.maxWeekend === '' || SET.maxWeekend == null ? -1 : +SET.maxWeekend;
  const noConsec = !!SET.noConsecutiveWeekends;
  const catW = CATS.map((c, k) => (SET.balanceWeekends === false && k > 0 ? 0 : k === 4 ? 140 : k === 0 ? 30 : 110));
  const wkKey = []; for (let d = 0; d < D; d++) { const kk = weekendKey(dateOf(ym, d)); wkKey.push(kk == null ? -1 : kk); }
  const prevWk = people.map(p => {
    const l = shiftDates(cfg, schedules, p.id, addDays(dateOf(ym, 0), -8), addDays(dateOf(ym, 0), -1)).map(weekendKey).filter(x => x != null);
    return l.length ? l[l.length - 1] : -9;
  });
  const partners = people.map(() => []), apartBusy = people.map(() => new Set());
  for (const [a, b] of apartPairs(cfg)) {
    [[a, b], [b, a]].forEach(([x, y]) => {
      if (idx[x] == null) return;
      if (idx[y] != null) partners[idx[x]].push(idx[y]);
      if (busy[y]) busy[y].forEach(d => apartBusy[idx[x]].add(d));
    });
  }
  const isWkCat = k => k === 2 || k === 3 || k === 4;

  const days = []; for (let i = 0; i < P; i++) days.push([]);
  const cnt = new Int32Array(P), cc = new Int32Array(P * NC), wdc = new Int32Array(P * 7), wkc = new Int32Array(P);
  const onDay = new Int32Array(P).fill(-1);
  function cost() {
    let c = 0, i, k;
    for (i = 0; i < P; i++) days[i].length = 0;
    cnt.fill(0); cc.fill(0); wdc.fill(0); wkc.fill(0); onDay.fill(-1);
    let curDay = -1, dayStart = 0;
    for (let s = 0; s < S; s++) {
      const v = slot[s], d = sDay[s];
      if (d !== curDay) { curDay = d; dayStart = s; }
      if (v === -2) continue;
      if (v < 0) { if (!opt[s]) c += HARD; continue; }
      /* Aynı gün iki yere yazılmak dinlenme kontrolünde (aralık 0) yakalanır. */
      days[v].push(d);
      /* Ek gün de normal nöbet gibi sayılır; yalnızca gerektiği kadar açılsın diye küçük bir bedeli var. */
      if (opt[s]) c += EXTRA_W;
      cnt[v]++; cc[v * NC + dayCatI[d]]++;
      wdc[v * 7 + wdOf[d]]++;
      if (isWkCat(dayCatI[d])) wkc[v]++;
      if (apartBusy[v].has(d)) c += HARD;
      for (let q = dayStart; q < s; q++) { const u = slot[q]; if (u >= 0 && partners[v].includes(u)) c += HARD; }
    }
    for (i = 0; i < P; i++) {
      const all = days[i], out = outside[i];
      let a = 0, b = 0, last = -1e9;
      while (a < all.length || b < out.length) {
        const x = b >= out.length || (a < all.length && all[a] <= out[b]) ? all[a++] : out[b++];
        const gap = x - last;
        if (gap < cyc) c += HARD * (gap <= 0 ? cyc + 1 : cyc - gap);
        else if (gap === cyc) c += 6;
        else if (gap > 2 * cyc + 1 && last > -1e8) c += 4 * (gap - 2 * cyc - 1);
        last = x;
      }
      if (!lite && inAny[i]) {
        const dv = cnt[i] - needT[i];
        c += 400 * dv * dv;
        for (k = 0; k < NC; k++) { const e = cc[i * NC + k] - catNeedT[i * NC + k]; c += catW[k] * e * e; }
      }
      if (minS[i]) { const short = minS[i] - all.length - otherCnt[i]; if (short > 0) c += HOURS_W * short + 300 * short * short; }
      if (maxWk >= 0 && wkc[i] > maxWk) c += HARD * (wkc[i] - maxWk);
      if (noConsec) {
        let lk = prevWk[i];
        for (const x of all) { const kk = wkKey[x]; if (kk < 0 || kk === lk) continue; if (kk === lk + 1) c += HARD; lk = kk; }
      }
      if (!lite) for (k = 0; k < 7; k++) { const w = wdc[i * 7 + k]; if (w > 1) c += 8 * (w - 1) * (w - 1); }
    }
    return c;
  }
  let lite = false;

  const free = []; for (let s = 0; s < S; s++) if (!fixed[s] && elig[s].length) free.push(s);
  const byPost = posts.map((_, j) => free.filter(s => sPost[s] === j));
  /* Mesaisi eksik kişiyi doğrudan bir yere yazmayı deneyen hamle için: kişinin yazılabileceği yerler. */
  const slotsOf = people.map((p, i) => free.filter(s => elig[s].includes(i)));
  const surplus = new Int32Array(P);
  const shortNow = () => {
    cost(); const out = [];
    for (let i = 0; i < P; i++) { surplus[i] = days[i].length + otherCnt[i] - minS[i]; if (minS[i] && surplus[i] < 0) out.push(i); }
    return out;
  };
  const shortOf = sl => { let n = 0; const c = new Int32Array(P); for (let s = 0; s < S; s++) if (sl[s] >= 0) c[sl[s]]++; for (let i = 0; i < P; i++) if (minS[i] > c[i] + otherCnt[i]) n += minS[i] - c[i] - otherCnt[i]; return n; };
  let best = Int16Array.from(slot), bestCost = Infinity;
  const tries = opts.tries || 4, iters = (opts.iters || 40000) * Math.max(1, NP * 0.8);
  /* Mesai açığı kalırsa (24/72 ile sıkı bir yerleşim gerekir) süre sınırı içinde yeni denemeler yapılır. */
  const tStart = Date.now();
  for (let t = 0; t < tries || (hoursOn && t < tries * 6 && Date.now() - tStart < (opts.hoursMs || 4000) && shortOf(best) > 0); t++) {
    /* Başlangıç: gün gün, dinlenmesi tamamlanmış ve hedefinden en uzak kişi. */
    const lastDay = new Int32Array(P).fill(-1000), given = new Float64Array(P * NP);
    people.forEach((p, i) => { const o = outside[i].filter(x => x < 0); if (o.length) lastDay[i] = o[o.length - 1]; });
    for (let s = 0; s < S; s++) {
      const d = sDay[s], j = sPost[s];
      if (fixed[s]) { if (slot[s] >= 0) { lastDay[slot[s]] = d; given[slot[s]]++; } continue; }
      if (opt[s]) { slot[s] = -3; continue; }
      let pick = -1, score = -Infinity;
      for (const i of elig[s]) {
        if (lastDay[i] === d) continue;
        const sc = (d - lastDay[i] >= cyc ? 1000 : 0) + (needT[i] - given[i]) * 10 + (d - lastDay[i]) + rand() * (t ? 8 : 1);
        if (sc > score) { score = sc; pick = i; }
      }
      slot[s] = pick;
      if (pick >= 0) { lastDay[pick] = d; given[pick]++; }
    }
    /* Ek günler: mesaisi eksik kalan ve dinlenmesi uygun kişiyle, en büyük açıktan başlayarak. */
    if (hoursOn) {
      const occ = people.map((p, i) => new Set(outside[i]));
      for (let s = 0; s < S; s++) if (slot[s] >= 0) occ[slot[s]].add(sDay[s]);
      const tot = people.map((p, i) => [...occ[i]].filter(d => d >= 0 && d < D).length);
      const restOk = (i, d) => { for (let k = 1 - cyc; k < cyc; k++) if (occ[i].has(d + k)) return false; return true; };
      for (let s = 0; s < S; s++) {
        if (!opt[s] || fixed[s]) continue;
        let pick = -1, score = 0;
        for (const i of elig[s]) {
          const gap = minS[i] - tot[i];
          if (gap <= 0 || !restOk(i, sDay[s])) continue;
          const sc = gap + rand();
          if (sc > score) { score = sc; pick = i; }
        }
        if (pick >= 0) { slot[s] = pick; occ[pick].add(sDay[s]); tot[pick]++; }
      }
    }
    /* Mesai hedefi varken iki aşama: önce yalnızca kurallar + mesai (düz bir arama alanı, sıkı 24/72
       yerleşimini bulmak kolaylaşır), sonra o yerleşimden başlayarak tam maliyetle denge. */
    let cur = cost();
    if (free.length) for (const [lt, n] of hoursOn ? [[true, iters >> 1], [false, iters]] : [[false, iters]]) {
      lite = lt; cur = cost();
      const T0 = 300, T1 = 0.5, lr = Math.log(T1 / T0);
      let shortP = hoursOn ? shortNow() : [];
      for (let it = 0; it < n; it++) {
        const T = T0 * Math.exp(lr * it / n);
        if (hoursOn && it % 400 === 399) shortP = shortNow();
        let s1 = free[(rand() * free.length) | 0], o1 = slot[s1];
        let s2 = -1, o2 = -1;
        const r = rand();
        if (shortP.length && r < 0.12) {
          /* Yalnızca boş ek günlere ya da hedefinin üstünde nöbeti olan birinin yerine. */
          const i = shortP[(rand() * shortP.length) | 0], cand = slotsOf[i].filter(s => slot[s] < 0 || surplus[slot[s]] > 0);
          if (!cand.length) continue;
          s1 = cand[(rand() * cand.length) | 0]; o1 = slot[s1];
          if (o1 === i) continue;
          slot[s1] = i;
        } else if (r < 0.4) {
          const e = elig[s1]; const nv = opt[s1] && rand() < 0.3 ? -3 : e[(rand() * e.length) | 0];
          if (nv === o1) continue;
          slot[s1] = nv;
        } else {
          /* Takas: aynı görevin başka günüyle (çoğunlukla) ya da aynı günün diğer göreviyle. */
          const bp = byPost[sPost[s1]];
          s2 = r < 0.85 || NP === 1 ? bp[(rand() * bp.length) | 0] : free[(rand() * free.length) | 0];
          o2 = slot[s2];
          if (s1 === s2 || o1 === o2) continue;
          if ((o2 >= 0 && !elig[s1].includes(o2)) || (o1 >= 0 && !elig[s2].includes(o1))) continue;
          slot[s1] = o2; slot[s2] = o1;
        }
        const nc = cost(), delta = nc - cur;
        if (delta <= 0 || rand() < Math.exp(-delta / T)) cur = nc;
        else { slot[s1] = o1; if (s2 >= 0) slot[s2] = o2; }
        if (!lite && cur < bestCost) { bestCost = cur; best = Int16Array.from(slot); }
      }
    }
    lite = false; cur = cost();
    if (cur < bestCost) { bestCost = cur; best = Int16Array.from(slot); }
  }
  posts.forEach(pst => { sched.assign[pst.id] = new Array(D).fill(''); });
  sched.extra = {};
  for (let s = 0; s < S; s++) {
    const v = best[s]; if (v < 0) continue;
    const pst = posts[sPost[s]], d = sDay[s], ids = dayList(sched, pst.id, d);
    if (!ids.includes(people[v].id)) setDayList(sched, pst.id, d, ids.concat(people[v].id));
    if (opt[s]) { const ex = sched.extra[pst.id] = sched.extra[pst.id] || []; if (!ex.includes(d)) ex.push(d); }
  }
  Object.keys(sched.extra).forEach(k => sched.extra[k].sort((a, b) => a - b));
  for (const pst of posts) for (let d = 0; d < D; d++) for (const id of dayList(sched, pst.id, d)) (busy[id] = busy[id] || new Set()).add(d);
  return bestCost;
}

/* Ayın çizelgesini oluşturur. Sabitlenmiş hücreler korunur; önce döngü görevleri yerleşir. */
export function generate(cfg, schedules, ym, opts = {}) {
  const old = schedules[ym];
  const sched = { ym, status: 'draft', assign: {}, pins: {} };
  if (old && opts.keepPins !== false) {
    sched.pins = JSON.parse(JSON.stringify(old.pins || {}));
    for (const pst of cfg.posts || []) {
      sched.assign[pst.id] = new Array(daysIn(ym)).fill('');
      for (const d of sched.pins[pst.id] || []) setDayList(sched, pst.id, d, dayList(old, pst.id, d));
    }
  }
  const all = { ...schedules }; delete all[ym];
  const prevBal = balancesBefore(cfg, all, ym);
  const busy = {};
  const posts = (cfg.posts || []).filter(isActivePost).map((p, i) => ({ p, i })).sort((a, b) => (isCyclePost(a.p) ? 0 : 1) - (isCyclePost(b.p) ? 0 : 1) || a.i - b.i).map(x => x.p);
  /* Sabitlenmiş tüm hücreler baştan meşgul sayılır. */
  for (const pst of posts) for (const d of sched.pins[pst.id] || []) for (const id of dayList(sched, pst.id, d)) (busy[id] = busy[id] || new Set()).add(d);
  for (const pst of posts) sched.assign[pst.id] = sched.assign[pst.id] || new Array(daysIn(ym)).fill('');
  for (const pst of posts.filter(isCyclePost)) fillCycle(cfg, all, sched, ym, pst, busy);
  const daily = posts.filter(p => !isCyclePost(p));
  if (daily.length) fillDaily(cfg, all, sched, ym, daily, busy, prevBal, opts);
  /* Bu ayın kadrosunu sakla: kadro sonradan değişirse geçmiş denge bozulmasın. */
  sched.pools = {};
  for (const pst of cfg.posts || []) if (isActivePost(pst)) sched.pools[pst.id] = postPeople(cfg, pst.id).map(p => p.id);
  return sched;
}

/* Bir hücre için seçilebilecek kişiler ve her birinin durumu (elle düzenleme ekranı). */
export function candidates(cfg, schedules, ym, postId, d) {
  const date = dateOf(ym, d), cyc = cycleDays(cfg), sched = schedules[ym] || emptySchedule(ym);
  return (cfg.people || []).filter(p => p.active !== false || dayList(sched, postId, d).includes(p.id)).map(p => {
    const b = blockOn(cfg, p, date), notes = [];
    if (b) notes.push(b.why);
    const near = shiftDates(cfg, schedules, p.id, addDays(date, -(cyc - 1)), addDays(date, cyc - 1)).filter(x => x !== date);
    if (near.length) notes.push('Dinlenme ihlali: ' + near.map(fmtDate).join(', ') + ' nöbetine yakın');
    for (const pst of cfg.posts || []) if (pst.id !== postId && dayList(sched, pst.id, d).includes(p.id)) notes.push('Aynı gün ' + pst.name + ' nöbetinde');
    return { person: p, inPost: (p.posts || []).includes(postId), ok: !notes.length, notes };
  }).sort((a, b) => (b.inPost - a.inPost) || (b.ok - a.ok) || fullName(a.person).localeCompare(fullName(b.person), 'tr'));
}

/* ---------- Açıklama: hedefle tutulan nöbet neden farklı? ----------
   Gündelik dille, kişi başına: hedef, tutulan, engel olan günler ve 24/72 ile bu ay en fazla kaç nöbet mümkün. */
export function explain(cfg, schedules, ym) {
  const sched = schedules[ym], D = daysIn(ym), cyc = cycleDays(cfg), out = [];
  if (!sched) return out;
  const groups = monthSummaryAll(cfg, schedules, ym).filter(g => !isCyclePost(g.post));
  for (const g of groups) {
    const slots = g.rows.reduce((a, r) => a + r.count, 0);
    const totalTarget = g.rows.reduce((a, r) => a + r.target, 0);
    out.push({ title: 'Genel durum', details: [
      'Bu ay tüm görevlerde toplam **' + slots + ' nöbet** yazılmış (görevler arasında fark gözetilmez, her nöbet aynı sayılır).',
      'Hedefler toplamı ' + Math.round(totalTarget * 10) / 10 + '. Hedefler devirli bakiyeyi telafi etmeye çalıştığı için tek ayda tam tutmayabilir; kalan fark sonraki aya devreder.',
      '24/' + (cyc * 24 - 24) + ' düzeninde bir kişi en erken ' + cyc + ' günde bir nöbet tutabilir, yani bu ay en fazla **' + Math.ceil(D / cyc) + ' nöbet**.'
    ] });
    for (const r of g.rows) {
      const diff = r.count - r.target;
      if (Math.abs(diff) < 0.75) continue;
      const p = r.person, why = {};
      let avail = 0;
      for (let d = 0; d < D; d++) {
        const b = blockOn(cfg, p, dateOf(ym, d));
        if (b) why[b.why] = (why[b.why] || 0) + 1; else avail++;
      }
      /* Uygun günlerde 24/72 ile sığabilecek en fazla nöbet (önceki ayın son nöbeti dahil). */
      const prev = shiftDates(cfg, schedules, p.id, addDays(dateOf(ym, 0), -cyc), addDays(dateOf(ym, 0), -1));
      let next = prev.length ? diffDays(dateOf(ym, 0), addDays(prev[prev.length - 1], cyc)) : 0, cap = 0;
      for (let d = Math.max(0, next); d < D;) { if (!blockOn(cfg, p, dateOf(ym, d))) { cap++; d += cyc; } else d++; }
      const det = ['Hedef **' + Math.round(r.target * 10) / 10 + '**, yazılan **' + r.count + '** (' + (diff > 0 ? '+' : '') + Math.round(diff * 10) / 10 + '). Devreden bakiye ' + (r.prevBal > 0 ? '+' : '') + Math.round(r.prevBal * 10) / 10 + '.'];
      Object.keys(why).forEach(k => det.push(why[k] + ' gün: ' + k + '.'));
      det.push('Uygun ' + avail + ' günde 24/72 ile en fazla **' + cap + ' nöbet** sığıyor.');
      if (diff < 0 && cap <= r.count) det.push('Bu ay daha fazlası mümkün değil; eksik kısım bakiyesine yazılır ve sonraki aylarda tamamlanır.');
      else if (diff < 0) det.push('Diğer kişilerin dinlenme süreleri ve hafta sonu dengesi nedeniyle daha fazla gün ayrılamadı. Eksik kısım sonraki aya devreder.');
      else det.push('Başkalarının tutamadığı günler (izin, dinlenme) ona kaldı. Fazlası bakiyesine yazılır; sonraki aylarda daha az nöbet alır.');
      out.push({ title: fullName(p), details: det });
    }
  }
  const errs = validate(cfg, schedules, ym).filter(i => i.level === 'error');
  if (errs.length) out.push({ title: 'Kural ihlalleri', details: errs.map(i => (i.day != null ? (i.day + 1) + ' ' + MONTHS[ymParts(ym).m - 1] + ': ' : '') + i.msg) });
  return out;
}

/* WhatsApp vb. için düz metin liste. */
export function shareText(cfg, schedules, ym) {
  const sched = schedules[ym], D = daysIn(ym), posts = monthPosts(cfg, sched), lines = [monthLabel(ym) + ' Nöbet Çizelgesi', ''];
  for (let d = 0; d < D; d++) {
    const date = dateOf(ym, d), hol = holidayOn(cfg, date);
    const parts = posts.map(p => { const n = dayList(sched, p.id, d).map(id => fullName(person(cfg, id))).join(', '); return n ? (p !== posts[0] && postLabel(p) ? postLabel(p) + ': ' : '') + n : ''; }).filter(Boolean);
    lines.push(pad(d + 1) + ' ' + WEEKDAYS_SHORT[weekdayOf(date)] + (hol ? ' (' + hol.name + ')' : '') + ' | ' + (parts.join(' + ') || '—'));
  }
  return lines.join('\n');
}

/* ---------- İzin hesapları ---------- */
export function isWorkday(cfg, date) { const w = weekdayOf(date); return w !== 0 && w !== 6 && !holidayOn(cfg, date); }
export function leaveWorkdays(cfg, l, from, to) {
  let n = 0, d = l.from > from ? l.from : from;
  const end = l.to < to ? l.to : to;
  while (d <= end) { if (isWorkday(cfg, d)) n++; d = addDays(d, 1); }
  return n;
}
export function leaveCalendarDays(l) { return diffDays(l.from, l.to) + 1; }
/* Yıl içinde kullanılan yıllık izin (iş günü). */
export function annualUsed(cfg, pid, year) {
  return (cfg.leaves || []).filter(l => l.personId === pid && leaveType(cfg, l.type).annual)
    .reduce((a, l) => a + leaveWorkdays(cfg, l, year + '-01-01', year + '-12-31'), 0);
}

/* ---------- Varsayılan veriler ---------- */
export function defaultHolidays(years) {
  const out = [];
  years.forEach(y => {
    out.push(
      { date: y + '-01-01', name: 'Yılbaşı' },
      { date: y + '-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
      { date: y + '-05-01', name: 'Emek ve Dayanışma Günü' },
      { date: y + '-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
      { date: y + '-07-15', name: 'Demokrasi ve Millî Birlik Günü' },
      { date: y + '-08-30', name: 'Zafer Bayramı' },
      { date: y + '-10-28', name: 'Cumhuriyet Bayramı Arifesi (yarım gün)', half: true },
      { date: y + '-10-29', name: 'Cumhuriyet Bayramı' }
    );
  });
  const rel = {
    2026: [['03-19', 'Ramazan Bayramı Arifesi (yarım gün)', 1], ['03-20', 'Ramazan Bayramı 1. gün'], ['03-21', 'Ramazan Bayramı 2. gün'], ['03-22', 'Ramazan Bayramı 3. gün'],
      ['05-26', 'Kurban Bayramı Arifesi (yarım gün)', 1], ['05-27', 'Kurban Bayramı 1. gün'], ['05-28', 'Kurban Bayramı 2. gün'], ['05-29', 'Kurban Bayramı 3. gün'], ['05-30', 'Kurban Bayramı 4. gün']],
    2027: [['03-08', 'Ramazan Bayramı Arifesi (yarım gün)', 1], ['03-09', 'Ramazan Bayramı 1. gün'], ['03-10', 'Ramazan Bayramı 2. gün'], ['03-11', 'Ramazan Bayramı 3. gün'],
      ['05-15', 'Kurban Bayramı Arifesi (yarım gün)', 1], ['05-16', 'Kurban Bayramı 1. gün'], ['05-17', 'Kurban Bayramı 2. gün'], ['05-18', 'Kurban Bayramı 3. gün'], ['05-19', 'Kurban Bayramı 4. gün']]
  };
  years.forEach(y => (rel[y] || []).forEach(([md, name, half]) => out.push({ date: y + '-' + md, name, half: !!half })));
  const seen = {};
  return out.filter(h => { if (seen[h.date]) { seen[h.date].name += ' / ' + h.name; return false; } seen[h.date] = h; return true; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function defaultConfig() {
  const posts = [
    { id: 'enf', name: 'Enformasyon Memuru', short: 'Enformasyon', mode: 'daily', assign: 'people', required: 1, every: 1 },
    { id: 'ek', name: '2. Nöbetçi', short: '2. Nöbetçi', mode: 'cycle', assign: 'fixed', fixedId: 'p_ismail', required: 1, every: 4, poolIds: [] }
  ];
  const P = (id, name, surname, code, pst) => ({ id, name, surname, code, posts: [pst], active: true, offWeekdays: [], annualLeave: 20, startDate: '', endDate: '', phone: '', note: '' });
  return {
    settings: {
      org: 'TRABZON İL AFET VE ACİL DURUM MÜDÜRLÜĞÜ AFETLERE MÜDAHALE ŞUBE MÜDÜRLÜĞÜ',
      title: 'ENFORMASYON MEMURU NÖBET ÇİZELGESİ',
      shiftHours: 24, restHours: 72, startMonth: '2026-11', signers: []
    },
    posts,
    people: [
      P('p_gulden', 'Gülden', 'GENÇ', '7690', 'enf'),
      P('p_mehmet', 'Mehmet Ali', 'TOMAR', '1625', 'enf'),
      P('p_kutay', 'Kutay', 'ZENGİN', '3307', 'enf'),
      P('p_omer', 'Ömer Faruk', 'TUNCER', '2602', 'enf'),
      P('p_zeynep', 'Zeynep', 'ELFATKUYU', '3526', 'enf'),
      P('p_ismail', 'İsmail', 'ŞİRİN', 'S-2758', 'ek')
    ],
    leaveTypes: [
      { id: 'yillik', name: 'Yıllık izin', compensate: true, annual: true, color: '#2f6fd6' },
      { id: 'rapor', name: 'Sağlık raporu', compensate: true, color: '#d23a2e' },
      { id: 'mazeret', name: 'Mazeret izni', compensate: true, color: '#b06a00' },
      { id: 'gorev', name: 'Görevlendirme', compensate: false, color: '#1e6b43' },
      { id: 'mesai', name: 'Fazla mesai izni', compensate: false, overtime: true, color: '#7a4fd1' },
      { id: 'diger', name: 'Diğer', compensate: true, color: '#6b6f7a' }
    ],
    leaves: [],
    adjustments: [],
    holidays: defaultHolidays([2026, 2027, 2028])
  };
}

/* PDF'teki Kasım 2026 çizelgesi: başlangıç geçmişi olarak yüklenir, Aralık bakiyesi buradan hesaplanır. */
export function sampleNovember() {
  const G = 'p_gulden', M = 'p_mehmet', K = 'p_kutay', O = 'p_omer', Z = 'p_zeynep', I = 'p_ismail';
  const enf = [G, M, K, G, Z, M, K, G, Z, M, K, O, Z, G, K, O, Z, G, K, O, Z, G, K, O, Z, G, K, O, Z, G];
  const ek = new Array(30).fill('');
  ek[0] = Z; [5, 9, 13, 21, 25, 29].forEach(d => { ek[d - 1] = I; });
  return { ym: '2026-11', status: 'final', assign: { enf, ek }, pins: {}, pools: { enf: [G, M, K, O, Z], ek: [I] } };
}

/* ---------- İzinde yerine atama ----------
   cfg izni zaten içermelidir. Kişinin from–to arasındaki mevcut çizelgelerdeki nöbetleri çıkarılır;
   günlük görevlerde yerine 24/72'ye, izinlere, kişisel kısıtlara ve "birlikte tutamaz" kuralına uyan,
   bakiyesi en düşük (en çok eksiği olan) kişi yazılır. Tek tek değişimle 24/72 korunamıyorsa o ayın
   izin başlangıcından sonraki günleri (öncesi ve elle sabitlenenler korunarak) yeniden dağıtılır.
   Döngü görevlerinde (ör. sabit 2. nöbetçi) yalnızca nöbet kaldırılır.
   Bakiye çizelgeden hesaplandığı için yerine tutanın fazlası ve izinlinin (telafi gerekiyorsa) eksiği
   Denge sayfasına kendiliğinden yansır.
   Döner: { schedules: { [ym]: güncel çizelge }, changes: [{ ym, d, date, postId, before: [pid], after: [pid] }], empty: [tarih] } */
/* Bir nöbet yerine yazılabilecek kişiler, en uygundan başlayarak.
   ok: kurallara uygun (izin/kısıt, aynı gün başka nöbet, 24/72, birlikte tutamaz); notes: uygun değilse nedenleri.
   bal: o görevdeki güncel bakiye (önceki aylar + bu ay, nöbet cinsinden; eksi = eksik tutmuş, önce o yazılır). */
export function rankCover(cfg, all, s, ym, d, pst, pid) {
  const date = dateOf(ym, d), cyc = cycleDays(cfg), pairs = apartPairs(cfg);
  const onDay = (id) => (cfg.posts || []).some(x => dayList(s, x.id, d).includes(id));
  /* Bakiye görevler arasında fark gözetmeden: tüm günlük görevlerin toplamı. */
  const prevAll = balancesBefore(cfg, all, ym), cat = dayCat(cfg, date);
  const parts = (cfg.posts || []).filter(x => !isCyclePost(x)).map(x => ({ prev: prevAll[x.id] || {}, stats: monthPostStats(cfg, s, ym, x) }));
  const pool = new Set(postPeople(cfg, pst.id).map(p => p.id));
  return (cfg.people || []).filter(p => p.id !== pid && p.active !== false).map(p => {
    const notes = [], b = blockOn(cfg, p, date);
    if (b) notes.push(b.why);
    /* Aynı gün yalnızca mesai için açılmış ek günde (ör. 2. nöbetçi) ise oradan alınabilir: dinlenmesi değişmez. */
    const there = (cfg.posts || []).filter(x => x.id !== pst.id && dayList(s, x.id, d).includes(p.id));
    const movable = there.length && there.every(x => ((s.extra || {})[x.id] || []).includes(d));
    if (onDay(p.id) && !movable) notes.push('Aynı gün nöbette');
    const near = shiftDates(cfg, all, p.id, addDays(date, -(cyc - 1)), addDays(date, cyc - 1)).filter(x => x !== date);
    if (near.length) notes.push('Dinlenme yetmez (' + near.map(fmtDate).join(', ') + ' nöbetine yakın)');
    const ap = pairs.find(([a, x]) => (a === p.id && onDay(x)) || (x === p.id && onDay(a)));
    if (ap) notes.push('Birlikte tutamaz: ' + fullName(person(cfg, ap[0] === p.id ? ap[1] : ap[0])) + ' o gün nöbette');
    if (!pool.has(p.id)) notes.push('Bu görevin listesinde değil');
    let bal = 0, catBal = 0;
    for (const x of parts) {
      const st = x.stats[p.id], pb = x.prev[p.id] || { bal: 0, catBal: {} };
      bal += (pb.bal || 0) + (st ? st.count - st.fair : 0);
      catBal += ((pb.catBal || {})[cat] || 0) + (st ? st.cats[cat] - st.catFair[cat] : 0);
    }
    /* Önceki / sonraki nöbet ve bu ayki mesai. */
    const before = shiftDates(cfg, all, p.id, addDays(date, -60), addDays(date, -1)), after = shiftDates(cfg, all, p.id, addDays(date, 1), addDays(date, 60));
    const lastDate = before.length ? before[before.length - 1] : null, nextDate = after.length ? after[0] : null;
    const gapPrev = lastDate ? diffDays(lastDate, date) : 99, gapNext = nextDate ? diffDays(date, nextDate) : 99;
    let monthShifts = 0;
    for (let k = 0; k < daysIn(ym); k++) if ((cfg.posts || []).some(x => dayList(s, x.id, k).includes(p.id))) monthShifts++;
    const sh = +((cfg.settings || {}).shiftHours) || 24, minS = minShifts(cfg, p, ym);
    /* Sıralama: önce nöbet bakiyesi en eksik olan; sonra bu ay mesai hedefinin altında kalan; sonra en uzun dinlenmiş olan. */
    const score = bal + (minS ? 0.6 * (monthShifts - minS) : 0) - Math.min(gapPrev, gapNext, 3 * cyc) / cyc * 0.15 + catBal * 0.01;
    return {
      person: p, ok: !notes.length, notes, bal, score, move: movable ? there.map(x => x.id) : null,
      lastDate, nextDate, gapPrev, gapNext, monthHours: monthShifts * sh, monthTarget: hoursTarget(cfg, p, ym)
    };
  }).sort((a, b) => (b.ok - a.ok) || (a.score - b.score) || fullName(a.person).localeCompare(fullName(b.person), 'tr'));
}

/* İzinle boşalan nöbetler ve her biri için sıralı aday listesi (yönetici seçsin diye).
   Günler sırayla, önerilen (ilk uygun) kişi yazılmış varsayılarak hesaplanır; böylece ardışık
   günlerde dinlenme hesabı tutarlı kalır. Döngü görevleri listelenmez (yalnızca nöbet kaldırılır). */
export function coverOptions(cfg, schedules, pid, from, to) {
  const all = { ...schedules }, copy = {}, out = [];
  const get = ym => { if (!copy[ym]) { copy[ym] = JSON.parse(JSON.stringify(schedules[ym])); all[ym] = copy[ym]; } return copy[ym]; };
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const ym = ymOf(date);
    if (!schedules[ym]) continue;
    const d = +date.slice(8) - 1;
    for (const pst of cfg.posts || []) {
      if (!dayList(all[ym], pst.id, d).includes(pid)) continue;
      const s = get(ym), rest = dayList(s, pst.id, d).filter(x => x !== pid);
      setDayList(s, pst.id, d, rest);
      if (isCyclePost(pst) || !isActivePost(pst)) continue;
      const options = rankCover(cfg, all, s, ym, d, pst, pid);
      out.push({ key: ym + '|' + d + '|' + pst.id, ym, d, date, postId: pst.id, options });
      if (options[0] && options[0].ok) setDayList(s, pst.id, d, rest.concat(options[0].person.id));
    }
  }
  return out;
}

/* opts.picks: { 'ym|gün|görev': pid ya da '' (boş bırak) } yöneticinin seçimleri. Seçim yoksa en uygun kişi yazılır.
   opts.leaveId / opts.type: yerine tutma kaydına yazılır (sched.covers). */
export function coverLeave(cfg, schedules, pid, from, to, opts = {}) {
  const out = {}, all = { ...schedules }, firstDay = {};
  const get = ym => { if (!out[ym]) { out[ym] = JSON.parse(JSON.stringify(schedules[ym])); all[ym] = out[ym]; } return out[ym]; };
  const picks = opts.picks || {}, failed = new Set(), failDay = {}, failSlots = [], decided = {};
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const ym = ymOf(date);
    if (!schedules[ym]) continue;
    const d = +date.slice(8) - 1;
    for (const pst of cfg.posts || []) {
      if (!dayList(all[ym], pst.id, d).includes(pid)) continue;
      const s = get(ym);
      if (firstDay[ym] == null) firstDay[ym] = d;
      const rest = dayList(s, pst.id, d).filter(x => x !== pid);
      setDayList(s, pst.id, d, rest);
      if (isCyclePost(pst) || !isActivePost(pst)) continue;
      const key = ym + '|' + d + '|' + pst.id;
      let chosen = null;
      if (picks[key] === '*') chosen = null;            /* ayın kalanını yeniden düzenle */
      else if (key in picks) chosen = picks[key] || '';
      else { const best = rankCover(cfg, all, s, ym, d, pst, pid).find(o => o.ok); if (best) chosen = best.person.id; }
      let moved = false;
      if (chosen) {
        /* Seçilen kişi o gün ek günde başka görevdeyse oradan alınır (ek gün kapanır; kişinin saati değişmez). */
        for (const x of cfg.posts || []) {
          if (x.id === pst.id || !dayList(s, x.id, d).includes(chosen) || !((s.extra || {})[x.id] || []).includes(d)) continue;
          setDayList(s, x.id, d, dayList(s, x.id, d).filter(id => id !== chosen));
          s.extra[x.id] = s.extra[x.id].filter(k => k !== d);
          moved = true;
        }
        setDayList(s, pst.id, d, rest.concat(chosen));
      } else if (chosen == null) {
        failed.add(ym); failSlots.push({ ym, d, postId: pst.id });
        if (failDay[ym] == null || d < failDay[ym]) failDay[ym] = d;
        continue;
      }
      (decided[ym] = decided[ym] || []).push({ d, postId: pst.id });
      /* Kim kimin yerine tuttu: bakiye ayrıntısında gösterilir. */
      s.covers = (s.covers || []).filter(x => !(x.d === d && x.postId === pst.id && x.from === pid))
        .concat({ d, postId: pst.id, from: pid, to: chosen, leaveId: opts.leaveId || '', type: opts.type || '', at: Date.now(), ...(moved ? { moved: true } : {}) });
    }
  }
  /* Basit değişim yetmediyse (ya da yönetici "yeniden düzenle" dediyse): ilk boşalan günden ay sonuna kadar
     yeniden dağıt. Önceki günler, elle sabitlenenler ve yöneticinin seçtiği yerine atamalar korunur. */
  for (const ym of failed) {
    /* İzinli günlerde kişi yukarıda çizelgeden çıkarıldı; izin dışındaki kendi nöbetlerine dokunulmaz. */
    const orig = schedules[ym], cur = out[ym], tmp = JSON.parse(JSON.stringify(cur));
    tmp.pins = tmp.pins || {};
    for (const pst of cfg.posts || []) {
      const set = new Set(tmp.pins[pst.id] || []);
      for (let d = 0; d < failDay[ym]; d++) set.add(d);
      (decided[ym] || []).filter(x => x.postId === pst.id).forEach(x => set.add(x.d));
      tmp.pins[pst.id] = [...set];
    }
    const g = generate(cfg, { ...all, [ym]: tmp }, ym, { seed: opts.seed, iters: opts.iters });
    g.status = orig.status; g.pins = JSON.parse(JSON.stringify(orig.pins || {}));
    for (const k of Object.keys(cur)) if (!(k in g)) g[k] = cur[k];
    g.covers = (cur.covers || []).slice();
    /* Yeniden dağıtımda boşalan güne kim yazıldıysa yerine tutan odur. */
    for (const x of failSlots.filter(f => f.ym === ym)) {
      const before = dayList(orig, x.postId, x.d).filter(id => id !== pid), now = dayList(g, x.postId, x.d);
      const to = now.find(id => !before.includes(id)) || '';
      g.covers = g.covers.filter(c => !(c.d === x.d && c.postId === x.postId && c.from === pid))
        .concat({ d: x.d, postId: x.postId, from: pid, to, leaveId: opts.leaveId || '', type: opts.type || '', at: Date.now(), auto: true });
    }
    out[ym] = g; all[ym] = g;
  }
  const changes = [], empty = [];
  for (const ym of Object.keys(out).sort()) {
    for (let d = 0; d < daysIn(ym); d++) for (const pst of cfg.posts || []) {
      const a = dayList(schedules[ym], pst.id, d), b = dayList(out[ym], pst.id, d);
      if (a.join() !== b.join()) changes.push({ ym, d, date: dateOf(ym, d), postId: pst.id, before: a, after: b });
      if (a.length && !b.length && isActivePost(pst) && !isCyclePost(pst)) empty.push(dateOf(ym, d));
    }
  }
  return { schedules: out, changes, empty };
}

/* Görevin kişi adının yanında gösterilecek etiketi. Sabit tek kişilik görevlerde (ör. İsmail ŞİRİN) etiket yazılmaz. */
export function postLabel(pst) { return !pst || pst.assign === 'fixed' ? '' : (pst.short || pst.name); }
