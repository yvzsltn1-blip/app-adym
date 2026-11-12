import * as E from './engine.js';
import { zip } from './xlsx.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = { signature: 'İmza ve devir teslim çizelgesi', leave: 'Fazla çalışma izin formu', approval: 'Fazla çalışma izin olur yazısı' };
export const documentCSS = `
  *{box-sizing:border-box} body{margin:0;color:#000;background:#fff;font:11pt 'Times New Roman',serif}
  .doc-page{width:180mm;min-height:265mm;margin:0 auto 20px;padding:5mm 0;background:white;color:black;line-height:1.3}
  h2{font-size:12pt;text-align:center;margin:0 0 18px} p{margin:10px 0;white-space:pre-wrap}
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin:14px 0} td,th{border:1px solid black;padding:5px;overflow-wrap:anywhere;white-space:pre-wrap}
  th{font-weight:bold;text-align:center} .doc-sign{text-align:center;margin:22px 0 16px;white-space:pre-wrap;break-inside:avoid}
  .doc-sign-right{width:34%;margin:18mm 0 0 auto}.doc-sign-left{width:36%;margin:0 auto 0 0}.doc-sign-center{width:100%;margin:16mm 0 0}
  .doc-page:not(.doc-page-approval):not(.doc-page-leave) .doc-sign-center{margin:22px 0 16px}
  .doc-page-approval{width:160mm;page:approval}.doc-page-leave{width:182mm;page:leave;font-size:12pt}
  @page approval{size:A4 portrait;margin:25mm}@page leave{size:A4 portrait;margin:10mm 14mm}
  .doc-footer{margin-top:24px;border-top:1px solid black;font-size:8pt;text-align:center;white-space:pre-wrap}
  .doc-signature td{height:23px;padding:2px 5px} .doc-signature th:nth-child(1){width:22%}.doc-signature th:nth-child(2){width:12%}.doc-signature th:nth-child(3){width:41%}
  @page{size:A4 portrait;margin:15mm} @media print{.doc-page{width:auto;min-height:0;margin:0;padding:0;break-after:page}.doc-page:last-child{break-after:auto}tr{break-inside:avoid}thead{display:table-header-group}}
`;

export function documentDefaults(cfg, ym) {
  const signers = cfg.settings?.signers || [];
  return { org: cfg.settings?.org || 'TRABZON İL AFET VE ACİL DURUM MÜDÜRLÜĞÜ', unit: 'Haberleşme Birimi', branch: 'Hukuk Birimi',
    chief: signers[0]?.name || 'Recep ÇAPKIN', chiefTitle: signers[0]?.title || 'Şube Müdürü', deputy: 'Ender Ahmet PERVANLAR', director: signers[1]?.name || 'Mustafa HÜSEYİNPAŞAOĞLU',
    directorTitle: signers[1]?.title || 'İl Afet ve Acil Durum Müdürü', time: '08:00', divisor: '8', year: ym.slice(0, 4), number: '77892859-903.05-',
    service: '', registry: '', phone: '', totalDays: '', days: '', remaining: '', from: '', returnDate: '', approvalDate: '', footer: '' };
}
const sign = (name, title, lead = '', gap = true) => `<div class="doc-sign">${esc(lead)}${lead ? (gap ? '<br><br>' : '<br>') : ''}${esc(name || '……………………')}<br>${esc(title)}</div>`;
const para = text => `<p>${esc(text)}</p>`;
const row = cells => '<tr>' + cells.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>';
const titleOf = p => p?.title || p?.job || '……………………';

export function buildDocument(kind, cfg, schedules, ym, v, personId) {
  const p = E.person(cfg, personId), name = p ? E.fullName(p) : '……………………';
  if (kind === 'signature') {
    const pages = [], sched = schedules[ym];
    for (let start = 0; start < E.daysIn(ym); start += 16) {
      let rows = '';
      for (let d = start; d < Math.min(start + 16, E.daysIn(ym)); d++) {
        const ids = [...new Set(E.monthPosts(cfg, sched).flatMap(post => E.dayList(sched, post.id, d)))];
        const names = ids.map(id => E.fullName(E.person(cfg, id))).join(' / ');
        rows += row([E.fmtDate(E.dateOf(ym, d)), v.time, names, '']) + row([E.fmtDate(E.addDays(E.dateOf(ym, d), 1)), v.time, names, '']);
      }
      pages.push(`<section class="doc-page"><h2>${esc(v.org)}<br>${esc(v.unit.toLocaleUpperCase('tr'))} İMZA VE DEVİR TESLİM ÇİZELGESİ</h2>${para(E.monthLabel(ym) + ' (' + (pages.length + 1) + ')')}<table class="doc-signature"><thead><tr><th>Tarih</th><th>Saat</th><th>Nöbetçi Personelin Adı Soyadı</th><th>İmza</th></tr></thead><tbody>${rows}</tbody></table>${para('Her nöbet için ilk satır teslim alma, ikinci satır teslim etme kaydıdır.')}${sign(v.chief, v.chiefTitle, 'Onaylayan', false)}</section>`);
    }
    return pages.join('');
  }
  if (kind === 'approval') {
    const stats = E.monthHours(cfg, schedules[ym], ym);
    const divisor = Number(v.divisor) > 0 ? Number(v.divisor) : 8;
    const chosen = Array.isArray(v.personIds) ? cfg.people.filter(p => v.personIds.includes(p.id)).map(person => stats.find(r => r.person.id === person.id) || {person,hours:0,target:0}) : stats.filter(r => r.shifts);
    const rows = chosen.map((r, i) => row([i + 1, E.fullName(r.person), titleOf(r.person), Math.floor(Math.max(0, r.hours - r.target) / divisor)]).replace('<tr>', '<tr data-person-id="' + esc(r.person.id) + '">')).join('');
    return `<section class="doc-page"><h2>${esc(v.org)} ${esc(v.unit.toLocaleUpperCase('tr'))} FAZLA ÇALIŞMA YAPAN PERSONEL ÇİZELGESİ</h2>${para(E.monthLabel(ym))}<table><thead><tr><th style="width:8%">S.NO</th><th>ADI SOYADI</th><th>UNVANI</th><th>FAZLA ÇALIŞMA NEDENİYLE HAK EDİLEN İZİN GÜN SAYISI</th></tr></thead><tbody>${rows || row(['', '', '', ''])}</tbody></table>${para(`Yukarıda adı, soyadı ve unvanı yazılı personelin ${E.monthLabel(ym)} döneminde acil durum ve diğer görevlendirmelerde yapmış oldukları çalışmalardan dolayı ortaya çıkan fazla çalışma süreleri her ${divisor} saate bir gün olacak şekilde hesaplanmıştır.`)}${para('Bu nedenle; yürütülen hizmetler aksamayacak şekilde uygun görülecek süre ve zamanlarda, hizalarında yazılı günlerin adı geçenlere izin olarak verilmesini olurlarınıza arz ederim.')}${sign(v.chief, v.chiefTitle)}${sign(v.deputy, 'Müdür Yardımcısı', 'Uygun görüşle arz ederim.')}${sign(v.director, v.directorTitle, 'OLUR\n' + (v.approvalDate ? E.fmtDate(v.approvalDate) : '… / … / ' + v.year))}</section>`;
  }
  const date = v.from ? E.fmtDate(v.from) : '… / … / ' + v.year;
  return `<section class="doc-page"><h2>${esc(v.org)}</h2>${para('Sayı: ' + v.number)}${para('Konu: Fazla Çalışma İzni')}<h2>MÜDÜRLÜK MAKAMINA</h2><table><tbody>${row(['Şubesi', v.branch, 'Adı Soyadı', name])}${row(['Hizmet Süresi', v.service, 'Sicil No', v.registry])}${row(['Toplam İzin Süresi', v.totalDays ? v.totalDays + ' gün fazla çalışma' : '………… gün', 'Görevi', titleOf(p)])}${row(['Kullanacağı İznin Ait Olduğu Yıl', v.year, 'İzin Türü', 'Fazla Çalışma (X)'])}${row(['Kalan İzin Süresi', v.remaining, 'İletişim', v.phone])}${row(['İzine Ayrılış Tarihi', date, 'Göreve Başlama Tarihi', v.returnDate ? E.fmtDate(v.returnDate) : '… / … / ' + v.year])}</tbody></table>${para('Açıklama: ' + date + ' tarihinden itibaren fazla çalışma iznimden ' + (v.days || '…………') + ' gün kullanmam hususunda gereğini arz ederim.')}${sign(name, titleOf(p))}${sign(v.chief, v.chiefTitle, 'Uygun görüşle arz ederim.')}${sign(v.director, v.directorTitle, 'OLUR\n' + (v.approvalDate ? E.fmtDate(v.approvalDate) : '… / … / ' + v.year))}<div class="doc-footer">${esc(v.footer)}</div></section>`;
}

// Export only text and table structure; edited/pasted HTML is never embedded in Office files.
export function readBlocks(root) {
  return [...root.children].flatMap(el => {
    if (el.tagName === 'TABLE') return [{ type: 'table', rows: [...el.rows].map(r => [...r.cells].map(c => c.innerText ?? c.textContent)) }];
    if (el.tagName === 'SECTION') return readBlocks(el).concat({ type: 'break' });
    const position = ['right','left','center'].find(p => el.classList.contains('doc-sign-' + p));
    return [{ type: el.tagName === 'H2' ? 'heading' : 'paragraph', text: el.innerText ?? el.textContent, center: el.classList.contains('doc-sign') || el.classList.contains('doc-footer'), ...(position ? {signPosition:position} : {}) }];
  });
}

// Old saved drafts had no placement metadata. Correct layout without replacing their text.
export function applyDocumentLayout(root, kind) {
  root.querySelectorAll('.doc-page').forEach(page => {
    page.classList.remove('doc-page-approval','doc-page-leave');
    if (kind === 'approval' || kind === 'leave') page.classList.add('doc-page-' + kind);
    const signs = [...page.querySelectorAll('.doc-sign')];
    const positions = kind === 'signature' ? ['center'] : ['right','left','center'];
    signs.forEach((el,i) => { el.classList.remove('doc-sign-right','doc-sign-left','doc-sign-center'); el.classList.add('doc-sign-' + (positions[i] || 'center')); });
  });
}

export function wordBlob(blocks, kind = '') {
  const margin = kind === 'approval' ? 1417 : kind === 'leave' ? 800 : 850;
  const width = 11906 - margin * 2;
  const p = (text, center = false, bold = false, position = '') => '<w:p><w:pPr>' + (center ? '<w:jc w:val="center"/>' : '') + (position === 'right' ? '<w:ind w:left="' + Math.round(width * .66) + '" w:right="0"/>' : position === 'left' ? '<w:ind w:left="0" w:right="' + Math.round(width * .64) + '"/>' : '') + '<w:spacing w:before="' + (position === 'right' ? '1020' : position === 'center' ? '907' : '0') + '" w:after="100"/>' + (position ? '<w:keepLines/>' : '') + '</w:pPr>' + String(text).split('\n').map((line, i) => '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="' + (kind === 'leave' ? 24 : 22) + '"/>' + (bold ? '<w:b/>' : '') + '</w:rPr>' + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(line) + '</w:t></w:r>').join('') + '</w:p>';
  const body = blocks.map((b, i) => b.type === 'break' ? (i === blocks.length - 1 ? '' : '<w:p><w:r><w:br w:type="page"/></w:r></w:p>') : b.type === 'table' ? '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' + ['top','left','bottom','right','insideH','insideV'].map(x => `<w:${x} w:val="single" w:sz="4"/>`).join('') + '</w:tblBorders></w:tblPr>' + b.rows.map((r, n) => '<w:tr><w:trPr><w:cantSplit/>' + (!n ? '<w:tblHeader/>' : '') + '</w:trPr>' + r.map(c => '<w:tc><w:tcPr><w:tcW w:w="' + Math.floor(width / r.length) + '" w:type="dxa"/></w:tcPr>' + p(c) + '</w:tc>').join('') + '</w:tr>').join('') + '</w:tbl>' : p(b.text, b.center || b.type === 'heading', b.type === 'heading', b.signPosition)).join('');
  return zip([
    {name:'[Content_Types].xml',text:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:'_rels/.rels',text:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/document.xml',text:'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' + (kind === 'leave' ? 568 : margin) + '" w:right="' + margin + '" w:bottom="' + (kind === 'leave' ? 568 : margin) + '" w:left="' + margin + '"/></w:sectPr></w:body></w:document>'}
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

export function signatureXlsx(blocks) {
  const pages = [[]];
  blocks.forEach(b => { if (b.type === 'break') pages.push([]); else pages.at(-1).push(b); });
  const sheets = pages.filter(p => p.length).map(page => {
    const rows = [], merges = []; let n = 0;
    const cell = (v, col) => `<c r="${String.fromCharCode(65 + col)}${n}" s="1" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    for (const b of page) {
      for (const values of b.type === 'table' ? b.rows : [[b.text]]) {
        n++; rows.push(`<row r="${n}" ht="${values.length === 1 ? Math.max(28, String(values[0]).split('\n').length * 18) : 25}" customHeight="1">${values.map(cell).join('')}</row>`);
        if (values.length === 1) merges.push(`<mergeCell ref="A${n}:D${n}"/>`);
      }
    }
    return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${[22,12,42,24].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells><pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0" footer="0"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/></worksheet>`;
  });
  return zip([
    {name:'[Content_Types].xml',text:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'},
    {name:'_rels/.rels',text:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',text:'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((_,i)=>`<sheet name="İmza ${i+1}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('') + '</sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',text:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('') + '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',text:'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
    ...sheets.map((text,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,text}))
  ]);
}

export { openDocuments } from './document-editor.js';
