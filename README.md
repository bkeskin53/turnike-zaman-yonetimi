🔷 Turnike Zaman Motoru – GPT Master Talimatları

Enterprise Workforce Time Management Platform
(On-Premise / Hybrid Architecture)

🧠 1. Sistem Tanımı

Turnike Zaman Motoru;

çalışanlardan gelen tüm zaman hareketlerini (IN / OUT event’leri):

turnike
kiosk
mobil
manuel giriş
entegrasyonlar

üzerinden toplar ve tek bir deterministic hesap motoru ile değerlendirir.

👉 Bu sistem:

SAP Time Management
UKG Kronos

seviyesinde bir enterprise workforce time management engine’dir.

👉 Bu bir UI uygulaması değildir
👉 Bu bir ERP seviyesinde hesap motorudur

🎯 2. Amaç

Tek bir platform ile:

sabit mesai (09:00–18:00)
çok vardiyalı üretim
gece vardiyası (cross-midnight)
7/24 operasyon
saha ekipleri
segment bazlı kurumsal yapı

tam doğrulukla yönetilmelidir.

⚙️ 3. Teknoloji Yığını
Frontend
Next.js (App Router)
React
TypeScript
Backend
Next.js API Routes
Domain-Driven Service Layer
Data
PostgreSQL
Prisma ORM
Time Engine
Luxon (timezone & tarih yönetimi)
Mimari
On-Premise uyumlu
Hybrid deployment
Stateless API
Recompute orchestration
Deterministic engine
🧠 4. Temel Mimari Prensip
🔴 Tek Hesap Motoru

Tüm hesaplamalar:

👉 sadece domain layer içinde yapılır

Kesin kurallar:
UI hesap yapmaz
API hesap yapmaz
Rapor hesap yapmaz
SQL içinde business logic yok

👉 Tek gerçek veri:

DailyAttendance

🧱 5. Sistem Katmanları
Company Policy → global varsayılan
Policy RuleSet → davranış kuralları
Shift Template → vardiya saatleri
Work Schedule Pattern → rota
Assignment → kime ne uygulanır
Time Evaluation Engine → hesaplama
🧠 6. Time Evaluation Engine (KRİTİK)

Bu sistem klasik değildir.

❌ IN → OUT eşleştirme sistemi yok
✔ Event Ownership sistemi var

🔑 Event Ownership (ÇEKİRDEK MODEL)

Her event için sistem şu soruyu çözer:

👉 “Bu event hangi güne / vardiyaya ait?”

Adaylar:
CURRENT_DAY
PREVIOUS_DAY
NEXT_DAY
Skorlama:
tolerance window uyumu
shift başlangıcına yakınlık
shift bitişine yakınlık
direction uyumu
minimum rest kontrolü
cross-day penalty
off-day penalty

👉 En yüksek skoru alan sahip olur

🔑 Kritik Kural

❌ Event önce eşleştirilmez
✔ Önce sahipliği belirlenir

Sonra:

ownership → pairing → attendance → anomaly

🔑 Engine Özellikleri
Next Shift Lookahead
sonraki vardiyayı aday yapar
önceki vardiyayı uzatmaz
tek başına karar vermez
Multi IN/OUT
native destek
segment bazlı çalışma
Pairing
ownership sonrası yapılır
Anomaly
en son çalışır
false anomaly üretmez
📅 7. Canonical Day

Tüm sistem:

👉 policy.timezone bazlıdır

Tek gerçek:

👉 dayKey

🔄 8. Recompute Modeli

Zaman hesaplama:

❌ statik değildir
✔ her zaman yeniden hesaplanır

Tetikleyiciler:
policy değişimi
vardiya değişimi
rota değişimi
event değişimi
⚠️ 9. OFF vs LEAVE
OFF → planlı çalışmama
LEAVE → izin (bordro etkiler)
🔐 10. Veri Güvenliği
master veri import ile override edilmez
employeeCode tek kimliktir
audit log zorunludur
recompute zorunludur
🎨 11. UI Kuralı

UI:

hesap yapmaz
sadece gösterir
🕒 12. Zaman Semantiği (KRİTİK – YENİ)

Bu sistemde zaman 3 farklı kavramdır ve ASLA karıştırılmaz:

12.1 Absolute Event Time

Gerçek olay anı

Örnek:

RawEvent.occurredAt
NormalizedEvent.occurredAt
DailyAttendance.firstIn / lastOut
Kurallar:
DB: TIMESTAMPTZ
UTC instant saklanır
JSON: ISO UTC (Z)
UI: policy timezone ile gösterir
12.2 Business Date

İş günü / dönem

Örnek:

workDate
weekStartDate
Kurallar:
DB: DATE
timezone içermez
dayKey ile uyumludur
12.3 Shift Clock
startMinute / endMinute
local saat
Kurallar:
timestamp değildir
UTC’ye çevrilmez
🔑 Altın Zaman Kuralı
DB → UTC timestamptz
İş günü → date / dayKey
UI → policy timezone
🔧 Serialization Kuralı

❌ Browser timezone kullanılmaz
✔ Policy timezone kullanılır

Akış:

UI input → policy timezone parse → UTC ISO → DB
⚠️ Geçmiş Kritik Bug (Çözüldü)

Sorun:

datetime-local yanlış parse
timestamp without time zone kullanımı

Sonuç:

yanlış saatler
cross-midnight bug
false anomaly

Çözüm:

UI timezone düzeltildi
DB timestamptz yapıldı
engine stabilize oldu
🤖 13. GPT DAVRANIŞ TALİMATI
❗ YASAKLAR

GPT:

❌ UI içinde hesap önermez
❌ API içinde logic yazmaz
❌ SQL hack önermez
❌ if/else patch önermez
❌ “ilk giriş / son çıkış” mantığı kullanmaz

❗ EVENT MODEL HATASI YASAK

❌ IN → OUT pairing varsayımı
✔ ownership-first model

❗ SINGLE SEGMENT YASAK

❌ tek giriş çıkış varsayımı
✔ multi segment native

❗ SHORTCUT YASAK

❌ edge-case patch
✔ root cause çözüm

❗ DETERMINISM

❌ heuristic karar
✔ deterministic model

❗ RECOMPUTE

❌ save edip geçme
✔ recompute zorunlu

❗ DOMAIN DIŞI KARAR

❌ UI çözümü
❌ SQL çözümü
✔ domain çözümü

✅ 14. GPT NASIL DAVRANMALI?

GPT:

problemi domain açısından analiz eder
ownership etkisini değerlendirir
pairing etkisini inceler
anomaly sonuçlarını kontrol eder
🧩 ALTIN KURAL

Event’ler önce eşleştirilmez
Önce hangi güne ait oldukları belirlenir

🚀 SON NOT

Bu sistem:

SAP/Kronos seviyesindedir
demo değildir
SaaS oyuncak değildir
ERP seviyesindedir

Amaç:

👉 Türkiye’nin en sağlam zaman yönetimi motorunu üretmek