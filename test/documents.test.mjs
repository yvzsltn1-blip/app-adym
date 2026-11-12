import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { buildDocument, documentDefaults, wordBlob, signatureXlsx } from '../public/js/documents.js';
import { documentDraftKey } from '../public/js/document-editor.js';
import { createStore } from '../public/js/store.js';

test('initial signer names follow supplied documents and configured names take precedence', () => {
  const cfg=E.defaultConfig();
  assert.equal(documentDefaults(cfg,'2026-11').chief,'Recep ÇAPKIN');
  assert.equal(documentDefaults(cfg,'2026-11').deputy,'Ender Ahmet PERVANLAR');
  assert.equal(documentDefaults(cfg,'2026-11').director,'Mustafa HÜSEYİNPAŞAOĞLU');
  cfg.settings.signers=[{name:'Yeni Şube Müdürü',title:'Şube Müdürü V.'},{name:'Yeni İl Müdürü',title:'İl Müdürü V.'}];
  assert.equal(documentDefaults(cfg,'2026-11').director,'Yeni İl Müdürü');
});

test('draft keys separate months and leave applicants without splitting shared documents by applicant', () => {
  const s={kind:'signature',month:'2026-11',personId:'a'};
  assert.equal(documentDraftKey(s),documentDraftKey({...s,personId:'b'}));
  assert.notEqual(documentDraftKey(s),documentDraftKey({...s,month:'2026-12'}));
  assert.notEqual(documentDraftKey({...s,kind:'leave'}),documentDraftKey({...s,kind:'leave',personId:'b'}));
});

test('saved fields, edited document and last selection survive store reload and updates retain other drafts', async () => {
  const local=new Map(), session=new Map();
  const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
  globalThis.localStorage=storage(local); globalThis.sessionStorage=storage(session); globalThis.location={search:'?demo'};
  let store=await createStore();
  await store.setup({username:'draft@example.com',password:'test123',displayName:'Test',seed:true});
  const first={kind:'leave',month:'2026-11',personId:'p_gulden'}, second={kind:'approval',month:'2026-12',personId:'p_mehmet'};
  await store.saveDocumentDraft(documentDraftKey(first),{fields:{chief:'Müdür A'},html:'<p>Elle düzeltilen metin</p>'},{defaults:{chief:'Müdür A'},lastSelection:first});
  await store.saveDocumentDraft(documentDraftKey(second),{fields:{chief:'Müdür B'},html:'<p>İkinci belge</p>'},{defaults:{chief:'Müdür B'},lastSelection:second});
  store=await createStore();
  assert.deepEqual((await store.loadDocumentSettings()).lastSelection,second);
  assert.equal((await store.loadDocumentSettings()).defaults.chief,'Müdür B');
  assert.equal((await store.loadDocumentDraft(documentDraftKey(first))).html,'<p>Elle düzeltilen metin</p>');
  assert.equal((await store.loadDocumentDraft(documentDraftKey(first))).fields.chief,'Müdür A');
  assert.equal(await store.loadDocumentDraft('missing'),null);
});

test('handover covers every shift and carries final delivery into next month', () => {
  const cfg = E.defaultConfig(), ym = '2026-12', s = E.emptySchedule(ym);
  E.setDayList(s, cfg.posts[0].id, 30, [cfg.people[0].id]);
  const html = buildDocument('signature', cfg, {[ym]:s}, ym, documentDefaults(cfg,ym));
  assert.equal((html.match(/<tbody>/g) || []).length, 2);
  assert.equal((html.match(/<td>08:00<\/td>/g) || []).length, 62);
  assert.ok(html.includes(E.fmtDate('2027-01-01')));
  assert.ok(html.includes(E.fullName(cfg.people[0])));
});

test('approval counts unique shift dates, subtracts target and rounds complete days down', () => {
  const cfg=E.defaultConfig(), ym='2026-12', s=E.emptySchedule(ym), pid=cfg.people[0].id;
  for(let d=0;d<8;d++) E.setDayList(s,cfg.posts[0].id,d,[pid]);
  E.setDayList(s,cfg.posts[1].id,0,[pid]);
  const v={...documentDefaults(cfg,ym),divisor:'8',chief:'A & B <C>'};
  const html=buildDocument('approval',cfg,{[ym]:s},ym,v);
  const stats=E.monthHours(cfg,s,ym).find(r=>r.person.id===pid);
  assert.ok(html.includes('<td>'+Math.floor(Math.max(0,stats.hours-stats.target)/8)+'</td>'));
  assert.ok(html.includes('A &amp; B &lt;C&gt;'));
  assert.equal(E.dayList(s,cfg.posts[0].id,0)[0],pid);
});

test('leave form uses supplied person and editable dates without sample personal information', () => {
  const cfg=E.defaultConfig(), ym='2027-01', p=cfg.people[0];
  const html=buildDocument('leave',cfg,{},ym,{...documentDefaults(cfg,ym),days:'3',from:'2027-01-04',returnDate:'2027-01-07'},p.id);
  assert.ok(html.includes(E.fullName(p)));
  assert.ok(html.includes(E.fmtDate('2027-01-07')));
  assert.match(html,/3 gün/);
  assert.doesNotMatch(html,/05333394880|1625|15 Yıl/);
});

test('Office downloads preserve edited text, XML escaping and multiple sheets', async () => {
  const blocks=[{type:'heading',text:'İMZA & ÇİZELGE'},{type:'table',rows:[['Tarih','Saat','Ad','İmza'],['01.01.2027','08:00','Örnek <İsim>','']]},{type:'break'},{type:'paragraph',text:'İkinci sayfa'},{type:'break'}];
  const word=await wordBlob(blocks).text(), excel=await signatureXlsx(blocks).text();
  assert.match(word,/Örnek &lt;İsim&gt;/);
  assert.match(word,/w:type="page"/);
  assert.match(excel,/sheet2.xml/);
  assert.match(excel,/İMZA &amp; ÇİZELGE/);
  assert.doesNotMatch(excel,/sheet3.xml/);
});

test('approval includes exactly the selected people, including selected people without shifts', () => {
  const cfg=E.defaultConfig(), ym='2026-11', v={...documentDefaults(cfg,ym),personIds:['p_mehmet','p_ismail']};
  const html=buildDocument('approval',cfg,{},ym,v);
  assert.match(html,/Mehmet Ali TOMAR/); assert.match(html,/İsmail ŞİRİN/);
  assert.doesNotMatch(html,/Gülden GENÇ|Kutay ZENGİN/);
  assert.match(html,/<td>1<\/td>/); assert.match(html,/<td>2<\/td>/);
});

test('Word signature blocks have separate left and right columns and source page margins', async () => {
  const blocks=[{type:'paragraph',text:'Şube Müdürü',center:true,signPosition:'right'},{type:'paragraph',text:'Müdür Yardımcısı',center:true,signPosition:'left'},{type:'paragraph',text:'OLUR',center:true,signPosition:'center'}];
  const xml=await wordBlob(blocks,'approval').text();
  assert.match(xml,/<w:ind w:left="5988" w:right="0"\/>/);
  assert.match(xml,/<w:ind w:left="0" w:right="5806"\/>/);
  assert.match(xml,/<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"\/>/);
});
