/* Bağımlılıksız küçük .xlsx yazıcısı (sıkıştırmasız ZIP + SpreadsheetML).
   Çıktı, kurumun mevcut PDF çizelgesiyle aynı düzendedir: her satırda 7 gün, gün aralığı başlıkları,
   altında görev başına nöbetçi adı. İkinci sayfada ay özeti (devir, hak, tutulan, yeni bakiye) bulunur. */
import * as E from './engine.js';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

export function zip(files, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type });
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const up = s => String(s).toLocaleUpperCase('tr');

/* Stil sırası: 0 normal, 1 başlık, 2 gün başlığı, 3 isim, 4 hafta sonu başlığı, 5 tablo başlığı, 6 sayı, 7 metin kenarlıklı */
const xf = (font, fill, border, align, wrap) => '<xf numFmtId="0" fontId="' + font + '" fillId="' + fill + '" borderId="' + border + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="' + align + '" vertical="center"' + (wrap ? ' wrapText="1"' : '') + '/></xf>';
const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="8"/><name val="Arial"/></font></fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' + xf(2, 0, 0, 'center', 1) + xf(3, 2, 1, 'center', 1) + xf(0, 0, 1, 'left', 1) + xf(3, 3, 1, 'center', 1) + xf(1, 2, 1, 'center', 1) + xf(0, 0, 1, 'center', 0) + xf(0, 0, 1, 'left', 0) +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const cs = (r, t, s) => '<c r="' + r + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + esc(t) + '</t></is></c>';
const cn = (r, v, s) => '<c r="' + r + '" s="' + s + '"><v>' + v + '</v></c>';
const sheet = (cols, rows, merges, landscape) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>' + cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + rows.join('') + '</sheetData>' +
  (merges.length ? '<mergeCells count="' + merges.length + '">' + merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
  '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="' + (landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/></worksheet>';

export function buildXlsx(cfg, schedules, ym) {
  const sched = schedules[ym], D = E.daysIn(ym), { y, m } = E.ymParts(ym), posts = E.monthPosts(cfg, sched);
  const rows = [], merges = [];
  let r = 1;
  rows.push('<row r="1" ht="30" customHeight="1">' + cs('A1', (cfg.settings.org || '') + ' ' + y + ' ' + up(E.MONTHS[m - 1]) + ' AYI ' + (cfg.settings.title || 'NÖBET ÇİZELGESİ'), 1) + '</row>');
  merges.push('A1:G1');
  r = 3;
  for (let w = 0; w < D; w += 7) {
    let head = '<row r="' + r + '" ht="34" customHeight="1">';
    const lines = posts.map((_, i) => '<row r="' + (r + 1 + i) + '" ht="18" customHeight="1">');
    for (let k = 0; k < 7; k++) {
      const d = w + k; if (d >= D) continue;
      const a = E.dateOf(ym, d), b = E.addDays(a, 1), hol = E.holidayOn(cfg, a), we = [0, 6].includes(E.weekdayOf(a)) || hol;
      head += cs(col(k) + r, E.fmtDate(a) + ' - ' + E.fmtDate(b) + '\n' + up(E.WEEKDAYS[E.weekdayOf(a)]) + ' - ' + up(E.WEEKDAYS[E.weekdayOf(b)]) + (hol ? '\n' + hol.name : ''), we ? 4 : 2);
      posts.forEach((p, i) => { lines[i] += cs(col(k) + (r + 1 + i), E.dayList(sched, p.id, d).map(id => E.listName(E.person(cfg, id))).join(', '), 3); });
    }
    rows.push(head + '</row>', ...lines.map(l => l + '</row>'));
    r += 1 + posts.length + 1;
  }
  const signers = (cfg.settings.signers || []).filter(s => s.name || s.title);
  if (signers.length) {
    r += 1;
    rows.push('<row r="' + r + '">' + signers.map((s, i) => cs(col(i * 2 + 1) + r, s.name, 6)).join('') + '</row>');
    rows.push('<row r="' + (r + 1) + '">' + signers.map((s, i) => cs(col(i * 2 + 1) + (r + 1), s.title, 6)).join('') + '</row>');
  }
  const s1 = sheet([24, 24, 24, 24, 24, 24, 24], rows, merges, true);

  /* Özet sayfası */
  const sr = [], sm = [];
  let q = 1;
  sr.push('<row r="1" ht="24" customHeight="1">' + cs('A1', E.monthLabel(ym) + ' — nöbet özeti', 1) + '</row>'); sm.push('A1:L1');
  q = 3;
  E.monthSummary(cfg, schedules, ym).forEach(g => {
    if (!g.rows.length) return;
    sr.push('<row r="' + q + '">' + cs('A' + q, g.post.name, 5) + '</row>'); q++;
    const heads = E.isCyclePost(g.post) ? ['Personel', 'Nöbet'] : ['Personel', 'Devir', 'Hak', 'Hedef', 'Tuttu', 'Yeni bakiye'].concat(E.CATS.map(c => c.label));
    sr.push('<row r="' + q + '" ht="28" customHeight="1">' + heads.map((h, i) => cs(col(i) + q, h, 5)).join('') + '</row>'); q++;
    g.rows.filter(x => x.count > 0).forEach(x => {
      const vals = E.isCyclePost(g.post) ? [x.count] : [x.prevBal, x.fair, x.target, x.count, x.newBal].map(v => Math.round(v * 10) / 10).concat(E.CATS.map(c => x.cats[c.key]));
      sr.push('<row r="' + q + '">' + cs('A' + q, E.fullName(x.person), 7) + vals.map((v, i) => cn(col(i + 1) + q, v, 6)).join('') + '</row>'); q++;
    });
    q++;
  });
  const s2 = sheet([26, 10, 10, 10, 10, 12, 11, 9, 11, 9, 13, 10], sr, sm, true);

  return zip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Çizelge" sheetId="1" r:id="rId1"/><sheet name="Özet" sheetId="2" r:id="rId2"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: s1 },
    { name: 'xl/worksheets/sheet2.xml', text: s2 }
  ]);
}
