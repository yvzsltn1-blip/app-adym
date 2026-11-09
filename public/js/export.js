/* PNG ve PDF çıktısı: A4 yatay aylık nöbet çizelgesi, basılı takvim dili.
   Beyaz zemin, mürekkep siyahı çizgiler, iki düz renk: sarı şerit asıl görev (ör. Enformasyon Memuru),
   lacivert şerit 2. nöbetçi. Hafta sonu ve tatil gün numaraları kırmızı. Altta kişi başı özet: her kare bir nöbet.
   Çizim 2480×1754 koordinatlarında yapılır ve 300 DPI'ya (3508×2480) ölçeklenir.
   PDF, aynı görüntüyü tek sayfaya gömen bağımlılıksız küçük bir yazıcıyla üretilir. */
import * as E from './engine.js';

const W = 2480, H = 1754, M = 76, SCALE = 3508 / 2480;
const C = {
  ink: '#111318', muted: '#5e636e', faint: '#9a9ea8', line: '#c9ccd3', panel: '#f6f6f3', red: '#d23a2e',
  day: '#ffc527', dayInk: '#231800', night: '#1b2a6b', nightInk: '#ffffff'
};
const DISPLAY = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
const BODY = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", Consolas, monospace';
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const up = s => String(s || '').toLocaleUpperCase('tr');

/* Tuval yazı tiplerini ancak yüklüyse kullanır; çizimden önce gömülü tipleri yükle. */
async function fontsReady() {
  if (!document.fonts || !document.fonts.load) return;
  const t = 'Kasım ğüşiöçİ 0123';
  await Promise.all(['800 40px ' + DISPLAY, '700 40px ' + DISPLAY, '400 40px ' + DISPLAY,
    '400 20px ' + BODY, '500 20px ' + BODY, '600 20px ' + BODY,
    '400 20px ' + MONO, '500 20px ' + MONO, '600 20px ' + MONO].map(f => document.fonts.load(f, t))).catch(() => { });
}

export async function drawSchedule(cfg, schedules, ym, scale = SCALE) {
  await fontsReady();
  const sched = schedules[ym], D = E.daysIn(ym), { y: yr, m } = E.ymParts(ym);
  const people = cfg.people || [], settings = cfg.settings || {};
  const posts = E.monthPosts(cfg, sched), main = posts.slice(0, 1), extra = posts.slice(1);
  const hrs = +(settings.shiftHours || 24);

  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';

  /* Metni yazar; max verilirse sığana kadar küçültür. Yazılan genişliği döndürür. */
  const text = (str, x, yy, o = {}) => {
    let size = o.size || 26;
    const fam = o.font || BODY, weight = o.weight || 400;
    g.letterSpacing = (o.spacing || 0) + 'px';
    g.font = weight + ' ' + size + 'px ' + fam;
    if (o.max) while (size > 11 && g.measureText(str).width > o.max) { size--; g.font = weight + ' ' + size + 'px ' + fam; }
    g.fillStyle = o.color || C.ink;
    g.textAlign = o.align || 'left';
    g.fillText(str, x, yy);
    const w = g.measureText(str).width;
    g.letterSpacing = '0px';
    return w;
  };
  const rule = (yy, weight, color) => { g.fillStyle = color || C.ink; g.fillRect(M, yy, W - 2 * M, weight); };
  const rrect = (x, yy, w, h, r, fill) => { g.beginPath(); g.roundRect(x, yy, w, h, r); g.fillStyle = fill; g.fill(); };

  const tw = W - 2 * M;
  let y = M;

  /* Başlık: solda künye ve büyük ay adı, sağda renk açıklaması. */
  const kicker = 'NÖBET ÇİZELGESİ' + (settings.org ? '  ·  ' + up(settings.org) : '');
  text(kicker, M, y + 14, { font: MONO, size: 23, weight: 500, color: C.muted, spacing: 2, max: tw - 700 });
  if (!sched || sched.status !== 'final') text('TASLAK', W - M, y + 14, { font: MONO, size: 23, weight: 600, color: C.red, spacing: 3, align: 'right' });
  const mw = text(E.MONTHS[m - 1], M - 6, y + 122, { font: DISPLAY, size: 168, weight: 800, spacing: -7 });
  text(String(yr), M + mw + 30, y + 122, { font: DISPLAY, size: 168, weight: 400, color: C.faint, spacing: -7 });

  let lx = W - M, ly = y + 96;
  const legend = (label, hours, color) => {
    const w = text(hours, lx, ly, { font: MONO, size: 24, color: C.muted, align: 'right' });
    const lw = text(label, lx - w - 22, ly, { size: 27, weight: 600, align: 'right' });
    g.fillStyle = color; g.fillRect(lx - w - 22 - lw - 38, ly - 12, 24, 24);
    ly += 48;
  };
  const span = '08.00 → 08.00';
  if (main.length) legend(main[0].name ? titleCase(main[0].name) : hrs + ' saat nöbet', span, C.day);
  extra.forEach(p => { if (E.postLabel(p)) legend(E.postLabel(p), span, C.night); });
  y += 226;

  /* Kişi başı özet satırları */
  const stats = people.map(p => {
    let n = 0, ex = 0;
    if (sched) for (let d = 0; d < D; d++) {
      if (main.some(pst => E.dayList(sched, pst.id, d).includes(p.id))) n++;
      if (extra.some(pst => E.dayList(sched, pst.id, d).includes(p.id))) ex++;
    }
    return { p, n, ex };
  }).filter(s => s.n + s.ex);
  const P = stats.length, perRow = Math.min(Math.max(P, 1), 6), sumH = 118;
  const footH = P ? Math.ceil(P / perRow) * sumH + 34 : 0;

  /* Gün adları */
  const cw = tw / 7, wdH = 52;
  rule(y, 3);
  WD_ORDER.forEach((w, i) => text(up(E.WEEKDAYS[w]), M + i * cw + 16, y + 3 + wdH / 2, { font: MONO, size: 21, weight: 500, spacing: 2, color: w === 0 || w === 6 ? C.red : C.ink }));
  y += wdH + 3;
  rule(y, 3);
  y += 3;

  const lead = (E.weekdayOf(E.dateOf(ym, 0)) + 6) % 7, weeks = Math.ceil((lead + D) / 7);
  const gridH = H - M - footH - y, ch = gridH / weeks, gy = y;

  for (let c = 0; c < weeks * 7; c++) {
    const col = c % 7, row = Math.floor(c / 7), x = M + col * cw, cy = gy + row * ch, d = c - lead;
    if (d < 0 || d >= D) { g.fillStyle = C.panel; g.fillRect(x, cy, cw, ch); continue; }
    const date = E.dateOf(ym, d), wd = E.weekdayOf(date), hol = E.holidayOn(cfg, date), wk = wd === 0 || wd === 6 || !!hol;
    const bars = [];
    if (sched) {
      main.forEach(pst => E.dayList(sched, pst.id, d).forEach(id => bars.push({ name: E.fullName(E.person(cfg, id)), day: true })));
      extra.forEach(pst => E.dayList(sched, pst.id, d).forEach(id => bars.push({ name: E.fullName(E.person(cfg, id)), day: false })));
    }
    const off = people.filter(p => p.active !== false && (p.posts || []).length && E.leaveOn(cfg, p.id, date)).map(p => p.name.split(/\s+/)[0]);

    const pad = 14, numSize = Math.min(62, Math.round(ch * 0.27));
    const nw = text(String(d + 1), x + pad, cy + pad + numSize * 0.42, { font: DISPLAY, size: numSize, weight: 700, spacing: -2, color: wk ? C.red : C.ink });
    const note = (hol ? hol.name : '') + (hol && off.length ? ' · ' : '') + (off.length ? 'İzinli: ' + off.join(', ') : '');
    if (note) text(note, x + cw - pad, cy + pad + numSize * 0.42, { size: 19, color: hol ? C.red : C.muted, align: 'right', max: cw - nw - 3 * pad });

    if (sched && !bars.length) {
      text('BOŞ', x + pad, cy + ch - pad - 20, { font: MONO, size: 22, weight: 600, spacing: 3, color: C.red });
      continue;
    }
    const top = cy + pad + numSize + 6, room = cy + ch - pad - top, gap = 5;
    const n = bars.length || 1, bh = Math.min(44, (room - (n - 1) * gap) / n);
    const by = cy + ch - pad - (bars.length * bh + (bars.length - 1) * gap);
    bars.forEach((b, k) => {
      const yy = by + k * (bh + gap);
      rrect(x + pad, yy, cw - 2 * pad, bh, 5, b.day ? C.day : C.night);
      text(b.name, x + pad + 13, yy + bh / 2 + 1, { size: Math.min(27, Math.round(bh * 0.62)), weight: b.day ? 600 : 500, color: b.day ? C.dayInk : C.nightInk, max: cw - 2 * pad - 26 });
    });
  }

  /* Izgara çizgileri */
  g.fillStyle = C.line;
  for (let i = 0; i <= 7; i++) g.fillRect(Math.round(M + i * cw) - (i === 7 ? 2 : 0), gy, 2, gridH);
  for (let i = 1; i <= weeks; i++) g.fillRect(M, Math.round(gy + i * ch) - 1, tw, 2);

  /* Kişi başı özet: her kare bir nöbet (sarı asıl görev, lacivert 2. nöbetçi). */
  if (P) {
    const sy = gy + gridH + 34, bw = tw / perRow;
    rule(sy - 3, 3);
    stats.forEach((s, i) => {
      const bx = M + (i % perRow) * bw, by = sy + Math.floor(i / perRow) * sumH, tot = s.n + s.ex;
      if (i % perRow) { g.fillStyle = C.line; g.fillRect(bx, by + 14, 2, sumH - 24); }
      const ix = bx + (i % perRow ? 20 : 0), iw = bw - 36;
      text(E.fullName(s.p), ix, by + 34, { font: DISPLAY, size: 30, weight: 700, spacing: -0.5, max: iw });
      const sq = Math.min(20, (iw - (tot - 1) * 5) / Math.max(tot, 1));
      for (let k = 0; k < tot; k++) {
        g.fillStyle = k < s.n ? C.day : C.night;
        g.fillRect(ix + k * (sq + 5), by + 58, sq, sq);
      }
      const line = extra.length
        ? [s.n ? s.n + ' nöbet' : '', s.ex ? s.ex + ' × 2. nöbetçi' : ''].filter(Boolean).join(' · ') + ' · ' + tot * hrs + ' saat'
        : tot + ' nöbet · ' + tot * hrs + ' saat';
      text(line, ix, by + 100, { font: MONO, size: 20, color: C.muted, max: iw });
    });
  }
  return cv;
}

function titleCase(s) { return String(s || '').toLocaleLowerCase('tr').replace(/(^|\s)\S/g, ch => ch.toLocaleUpperCase('tr')); }

const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Görüntü oluşturulamadı'))), type, q));

export async function pngBlob(cfg, schedules, ym) { return toBlob(await drawSchedule(cfg, schedules, ym), 'image/png'); }

/* Kayıpsız gömme: PNG "Up" öngörüsü + deflate. Desteklenmezse yüksek kaliteli JPEG. */
async function flate(cv) {
  if (typeof CompressionStream === 'undefined') throw new Error('sıkıştırma yok');
  const w = cv.width, h = cv.height, g = cv.getContext('2d'), stride = w * 3 + 1;
  const out = new Uint8Array(stride * h), prev = new Uint8Array(w * 3), STRIP = 128;
  for (let y0 = 0; y0 < h; y0 += STRIP) {
    const rows = Math.min(STRIP, h - y0), px = g.getImageData(0, y0, w, rows).data;
    for (let r = 0; r < rows; r++) {
      let o = (y0 + r) * stride, s = r * w * 4;
      out[o++] = 2;
      for (let x = 0, i = 0; x < w; x++, s += 4) for (let k = 0; k < 3; k++, i++) { const v = px[s + k]; out[o++] = (v - prev[i]) & 255; prev[i] = v; }
    }
  }
  const buf = await new Response(new Blob([out]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  return { bytes: new Uint8Array(buf), w, h, filter: '/FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ' + w + ' >>' };
}
async function jpeg(cv) {
  const b = await toBlob(cv, 'image/jpeg', 0.95);
  return { bytes: new Uint8Array(await b.arrayBuffer()), w: cv.width, h: cv.height, filter: '/DCTDecode' };
}

export async function pdfBlob(cfg, schedules, ym) {
  const cv = await drawSchedule(cfg, schedules, ym);
  let img;
  try { img = await flate(cv); } catch (e) { img = await jpeg(cv); }
  const enc = new TextEncoder(), pw = 841.89, ph = 595.28;
  const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
  const parts = [], off = [];
  let pos = 0;
  const add = c => { const b = typeof c === 'string' ? enc.encode(c) : c; parts.push(b); pos += b.length; };
  const obj = (n, body) => { off[n] = pos; add(n + ' 0 obj\n' + body + '\nendobj\n'); };
  const title = E.monthLabel(ym) + ' Nöbet Çizelgesi';
  /* Belge başlığı UTF-16BE olarak yazılır ki Türkçe karakterler bozulmasın. */
  const hex = [...title].map(ch => ch.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  off[4] = pos;
  add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ' + img.filter + ' /Length ' + img.bytes.length + ' >>\nstream\n');
  add(img.bytes);
  add('\nendstream\nendobj\n');
  obj(5, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
  obj(6, '<< /Title <FEFF' + hex + '> /Producer (Nobet Cizelgesi) >>');
  const xref = pos;
  let t = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) t += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  add(t + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}
