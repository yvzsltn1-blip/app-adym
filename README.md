# Nöbet Çizelgesi — Afetlere Müdahale Şube Müdürlüğü

24/72 esaslı nöbet çizelgesi hazırlayan web uygulaması. Firebase (Authentication + Firestore) kullanır, derleme gerektirmez.

## Ne yapar?

- **24/72 kuralı:** Herkes 24 saat nöbetten sonra en az 72 saat dinlenir. Önceki ayın son günleri de hesaba katılır.
- **Adil dağılım ve devir:** Her gün, o gün nöbet beklenen kişiler arasında eşit pay olarak bölünür. Bir kişi hakkından fazla nöbet tutarsa (+), sonraki çizelgelerde ona daha az, eksik tutana (−) daha çok nöbet yazılır. Bakiye *Denge* sayfasında görülür.
- **İzinler:** İzinli günlere nöbet yazılmaz. *Telafi edilir* işaretli izin türlerinde (yıllık izin, rapor, mazeret) kişi izindeyken de hakkı işler; yerine tutanların fazlası sonraki aylarda düşer. *Görevlendirme* gibi telafi gerektirmeyen türlerde pay diğerlerine geçer. Yıllık izin hakkı ve kalan gün (iş günü) izlenir.
- **Aylık mesai hedefi (varsayılan 160 saat):** Herkes ayda en az hedef kadar saat nöbet tutar (24 saatlik nöbetle en az 7 nöbet). Yetmezse 2. nöbetçi gibi her gün olmayan görevlere ek gün açılır; ek günler normal nöbet gibi sayılır. Görevler arasında fark yoktur: denge ve bakiye kişi başına tüm görevlerin toplamıyla hesaplanır. İzinli iş günleri mesaiden sayılır. *Ayarlar → Dağıtım kuralları*'ndan değiştirilir ya da kapatılır.
- **İzinde yerine tutma:** İzin onaylanırken ya da girilirken boşalan her nöbet için adaylar en uygundan başlayarak listelenir (kurala uyanlar, bakiyesi en eksik olan önce; uymayanların nedeni yazılır). Yönetici seçer; uygun kimse yoksa ayın kalanı yeniden düzenlenir. Yerine tutana +24, izinliye (telafi gerektiren izinde) −24 saat yansır ve kayda geçer.
- **Saat bazlı denge:** Denge sayfası çalışılan saat, hak ve bakiyeyi saat olarak gösterir; her kişinin ayrıntısı (ay ay döküm, yerine tutmalar, elle düzeltmeler) yöneticiye ve personelin kendisine açıktır.
- **Hafta içi / hafta sonu dengesi:** Hafta içi, Cuma, Cumartesi, Pazar ve bayram/tatil nöbetleri birikimli olarak ayrı ayrı dengelenir; aynı kişiye hep aynı gün düşmez.
- **İki tür görev:** *Günlük* görev (ör. Enformasyon Memuru) her gün dolar. *Döngü* görevinde (ör. 2. nöbetçi, İsmail ŞİRİN) kişi kendi 24/72 döngüsünü sürdürür.
- **Özel kurallar:** "şu tarihlerde nöbet tutamaz / mutlaka tutar", "iki kişi aynı gün tutamaz", ayda en fazla hafta sonu/tatil nöbeti, art arda iki hafta sonu yazmama, kişiye özel nöbet payı (ör. %50).
- Takvim / Liste / Tablo görünümleri, "Bugün" kartı, toplam nöbet/saat göstergeleri, "Hedefler neden tam tutmuyor?" açıklaması, yardım ekranı, açık/koyu tema.
- Elle düzenleme, sabitleme (ve tümünü kaldırma), boş çizelgeyle elle doldurma, kural denetimi, taslak → kesinleştirme.
- Çıktılar: **PDF** (A4 yatay), **PNG**, **Excel**, yazdırma (hepsi kurumun mevcut çizelge düzeninde) ve WhatsApp için metin paylaşımı. JSON yedeği ve tüm verileri sıfırlama.
- **Kullanıcılar (kayıt ekranı yok):**
  - **Baş yönetici** (ilk kurulumda açılır, ör. `admin@afad.trabzon`): her şeye yetkilidir, yönetici hesaplarını açar ve şifrelerini belirler.
  - **Yönetici** (ör. `recep@afad.trabzon`): e-postasıyla girer. Çizelge, personel, izin, izin talebi onayı ve personel hesaplarını yönetir. Baş yöneticiye ve diğer yöneticilere dokunamaz.
  - **Personel:** **isim + yöneticinin belirlediği şifre** ile girer (ör. `Gülden Genç` ya da `gulden.genc`). Kesinleşmiş çizelgeyi görür, yazdırır/Excel alır, izin talebi gönderir ve talebinin durumunu izler.

## Kurulum (bir kez)

1. [Firebase konsolu](https://console.firebase.google.com/project/afetlere) → **Authentication** → *Get started* → *Sign-in method* → **E-posta/Şifre**'yi etkinleştirin.
2. **Firestore Database** → *Create database* (Production mode, bölge: `europe-west3` gibi yakın bir bölge).
3. Güvenlik kurallarını ve siteyi yayınlayın:
   ```
   firebase login
   firebase deploy
   ```
   (Yalnızca kurallar için: `firebase deploy --only firestore:rules`.) Yayından sonra adres: https://afetlere.web.app
4. Siteyi ilk açtığınızda **İlk kurulum** formu gelir: yönetici adı, e-postası ve şifresi. İsterseniz 6 personel ve PDF'teki Kasım 2026 çizelgesi başlangıç verisi olarak yüklenir; Aralık bakiyesi buradan hesaplanır.

> Kurulum formu yalnızca bir kez, yönetici oluşana kadar görünür. Siteyi yayınladıktan hemen sonra kurulumu kendiniz yapın.

## Denemek (Firebase olmadan)

```
py -m http.server 8765 --directory public
```
Sonra http://127.0.0.1:8765/?demo adresini açın. Deneme modunda veriler yalnızca o tarayıcıda saklanır.

Motor testi: `node test/engine.test.mjs`

Gün seçimleri testi: `node test/day-plan.test.mjs`

Çizelge oluşturmadan önce takvimde bir güne tıklayabilirsiniz. Görev altında kişi
seçmek o atamayı sabitler; **Bu gün nöbet tutamaz** bölümünde birden fazla kişiyi
hariç tutabilirsiniz. **Kaydet** ile seçimleri saklayın, diğer günleri de düzenleyip
**Çizelge oluştur / Yeniden oluştur** düğmesine basın. Gün kısıtları yeniden
oluşturmada korunur; aynı pencereyi açıp işaretlerini kaldırarak silebilirsiniz.
Seçimler çelişirse veya kurallara uygun dağıtım bulunamazsa nedenleri gösterilir ve
mevcut çizelgenin üzerine yazılmaz.

## Bilinmesi gerekenler

- Firebase, istemci tarafında başka bir kullanıcının şifresini değiştirmeye izin vermez. Bu yüzden yöneticinin belirlediği şifreler, yalnızca yöneticinin okuyabildiği `secrets` koleksiyonunda saklanır. Yönetici şifre değiştirme ve silme işlemlerini bu kayıtla yapar.
- Dini bayram tarihleri 2026–2027 için girilidir. Sonraki yıllar için *Ayarlar → Resmi tatiller* bölümünden ekleyin.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `public/js/engine.js` | Kurallar, bakiye hesabı, otomatik dağıtım (tavlama benzetimi), denetim |
| `public/js/store.js` | Firebase ve deneme modu veri/oturum katmanı |
| `public/js/app.js` | Arayüz |
| `public/js/xlsx.js` | Excel çıktısı |
| `firestore.rules` | Güvenlik kuralları |

## GitHub'a yükleme

Depo: <https://github.com/yvzsltn1-blip/app-adym>

Klasördeki **`yukle.bat`** dosyasına çift tıklayın. Betik sırayla:

1. Git'in kurulu olup olmadığını denetler (değilse uyarır).
2. Depo yoksa `git init` yapar, `origin` adresini ayarlar.
3. Tüm değişiklikleri ekler ve tarih/saat mesajıyla commit eder.
4. `main` dalını GitHub'a gönderir.

Yükleme sonunda pencere açık kalır; sonucu okuyup bir tuşa basarak kapatabilirsiniz.

> İlk gönderimde GitHub kullanıcı adı ve şifre (ya da kişisel erişim anahtarı) sorulabilir.
> Kimlik bilgileri Windows Kimlik Yöneticisi'nde saklanır, sonraki çalıştırmalarda tekrar sorulmaz.
> Uzak depoda sizde olmayan commit varsa betik uyarır: önce `git pull --rebase origin main` çalıştırın.
