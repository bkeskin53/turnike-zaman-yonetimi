# Import Cleanup Prep
<!-- Patch 10.0.5 inventory only; no behavior change -->

Bu dosya `Patch 10.0.5` kapsamında import modülündeki geçiş kalıntılarını envanterlemek için tutulur.

Amaç:
- Faz 11 öncesi hangi parçaların bilinçli olarak geçiş amaçlı bırakıldığını görünür kılmak
- Hangi cleanup işinin hangi invariant'ı bozma riski taşıdığını kaydetmek
- "artık ürünleşti ama hâlâ geçiş kodu taşıyoruz" noktalarını tek yerde toplamak

Bu dosya bir refactor talimatı değildir.
Bu patch kapsamında hiçbir write-path semantiği değiştirilmemiştir.

## Faz 11'de Tamamlananlar

### CLN-01 - Capability alias removal
- Durum:
  - `Capabilities.canImport` kaldirildi.
  - Calisan ekrani import CTA gorunurlugu dogrudan `employeeImport.canAccessWorkspace` ile hizalandi.

### CLN-03 - Run ref contract consolidation
- Durum:
  - `runInfo` ve `applyRun` alanlari tek `runRef` sozlesmesinde birlestirildi.
  - Dry-run ve apply sonuc kartlari ayni run referansi ile hizalandi.

### CLN-05 - Import UI state and fetch simplification
- Durum:
  - Run gecmisi liste istegi ortak helper uzerinden okunuyor.
  - Ilk yukleme, manuel yenileme ve sonuc-sonrasi yenileme ayni liste akisini kullaniyor.
  - Run detail acilisinda drawer state gecisleri tek helper ile toplandi.

### CLN-04 - Reference sheet terminology alignment
- Durum:
  - `ALL_FIELDS` enum degeri ile kullaniciya gorunen referans tab dili ayni sozlukten uretiliyor.
  - Referans tab uyarisi `Tum Basliklar (00_Tum_Alanlar)` cizgisine cekildi.

### CLN-06 - Inspection policy label alignment
- Durum:
  - Inspection policy metinleri import privacy servisinden uretiliyor.
  - UI tarafinda saklama suresi, maskeleme ve preview bos-durum etiketleri tek kaynaktan okunuyor.

## Faz 11 İçin Adaylar

### CLN-01 — `Capabilities.canImport` uyumluluk alias'ı
- Dosyalar:
  - `app/_auth/capabilities.ts`
  - `app/admin/employees/page.tsx`
  - `app/admin/employees/ui.tsx`
- Neden duruyor:
  - Eski çalışan ekranı import CTA görünürlüğünü hâlâ boolean `canImport` üzerinden okuyor.
  - Faz 10 permission + visibility modeli artık `employeeImport` nesnesi üzerinden çalışıyor.
- Faz 11 hedefi:
  - `canImport` alias'ını kaldırmak
  - çalışan ekranı CTA kararını `employeeImport.canAccessWorkspace` ile doğrudan hizalamak
- Dikkat:
  - sadece tip temizliği değil; çalışan ekranı ve capability tüketicileri birlikte güncellenmeli

### CLN-02 — Patch numarası taşıyan explanatory copy
- Dosyalar:
  - `app/api/employees/import/route.ts`
  - `src/services/employees/importTemplateValidation.service.ts`
  - `app/admin/employees/import/ui.tsx`
- Neden duruyor:
  - Faz 8 ve Faz 9 boyunca patch bazlı açıklama metinleri karar akışını anlatmak için hızlıca işlendi.
  - Ürünleşmiş modülde "Patch 8.10", "Patch 9.0.2" gibi ifadeler kalıcı UX dili olmamalı.
- Faz 11 hedefi:
  - import modülündeki ürün dili ve teknik faz dili ayrıştırılmalı
  - kullanıcıya görünen açıklamalar patch/version bağımsız hale getirilmeli
- Dikkat:
  - backend response mesajı ve UI yardımcı metinleri birlikte ele alınmalı

### CLN-03 — `runInfo` / `applyRun` response shape ayrılığı
- Dosyalar:
  - `app/api/employees/import/route.ts`
  - `app/admin/employees/import/ui.tsx`
- Neden duruyor:
  - Dry-run ve apply journaling farklı fazlarda açıldığı için response contract iki ayrı alan taşıyor
  - UI bu iki alanı ayrı render ediyor
- Faz 11 hedefi:
  - ortak bir `runRef` veya benzeri response parçasında birleşmek
  - UI tarafında run kartı tekrarını azaltmak
- Dikkat:
  - mevcut network contract kullanan ekran/entegrasyon varsa kırılmamalı

### CLN-04 — Reference sheet / enum isim tutarsızlığı
- Dosyalar:
  - `app/api/employees/import/route.ts`
  - `src/services/employees/employeeImportRunHttpQuery.util.ts`
  - `src/features/employees/importTemplate*`
- Neden duruyor:
  - sistemde `ALL_FIELDS` enum değeri, UI'da `00_Tum_Alanlar` referans sheet'i ve "reference sözlüğü" dili birlikte yaşıyor
- Faz 11 hedefi:
  - enum, title ve kullanıcı dili aynı kavrama tek terminolojiyle bağlanmalı
- Dikkat:
  - workbook/sheet contract bozulmamalı

### CLN-05 — Import UI fetch/state tekrarları
- Dosya:
  - `app/admin/employees/import/ui.tsx`
- Neden duruyor:
  - history listesi hem `loadRunHistory()` içinde hem ilk yükleme effect'inde benzer fetch akışı taşıyor
  - drawer/detail ve sonuç kartları arasında da benzer state geçişleri var
- Faz 11 hedefi:
  - import workspace client state'i daha küçük parçalara ayrılmalı
  - history fetch helper veya hook seviyesinde sadeleşmeli
- Dikkat:
  - mevcut sade `İçe Aktarım / Geçmiş ve İnceleme` UX'i korunmalı

### CLN-06 — Inspection policy metinlerinin merkezi olmaması
- Dosyalar:
  - `src/services/employees/employeeImportRunPrivacy.service.ts`
  - `app/admin/employees/import/ui.tsx`
- Neden duruyor:
  - retention / masking politikası bu fazda ilk kez açıldı
  - policy metinleri şimdilik UI içinde gömülü
- Faz 11 hedefi:
  - policy labels / help text tek kaynakta toplanmalı
- Dikkat:
  - retention günleri değişirse UI metni ve backend policy metası birlikte güncellenmeli

## Bu Patchte Bilinçli Olarak Yapılmayanlar
- hiçbir import write-path silinmedi
- response contract refactor edilmedi
- UI component parçalama yapılmadı
- patch/version copy temizliği hemen yapılmadı
- eski alanlar kaldırılmadı

Sebep:
- `10.0.5` bir cleanup uygulaması değil, cleanup hazırlığıdır
- Faz 10'un governance/hardening hedefi korunmuştur

## Faz 11 İçin Önerilen Sıra
1. Patch/version copy temizliği
2. `runInfo` / `applyRun` contract birleşimi
3. `canImport` alias kaldırma
4. UI fetch/state sadeleştirme
5. Terminoloji hizası (`ALL_FIELDS` / referans sheet)
