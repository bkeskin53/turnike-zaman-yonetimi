# MIGRATIONS Disiplini (Zorunlu)

Bu projede DB şeması için **tek kaynak**: `prisma/schema.prisma`

## Yasaklar (KIRMIZI ÇİZGİ)
- `prisma db push` KULLANILMAZ.
- Veritabanına elle müdahale (DDL) YAPILMAZ.
- Trigger/procedure/function yazılmaz (DB iş kuralı içermez).
- Migration klasörleri silinmez / yeniden yazılmaz.

## Günlük geliştirme akışı (DEV)
1) Şema değişikliğini **yalnızca** `prisma/schema.prisma` içinde yap.
2) Migration üret + uygula:
   - `npx prisma migrate dev --name <kisa_anlamli_isim>`
3) Prisma Client’ı üret:
   - `npx prisma generate` (çoğu zaman migrate dev zaten çalıştırır)

> Geliştirmede amaç: `schema.prisma` + `prisma/migrations/*` her zaman repo’da gerçeği temsil etsin.

## Üretim/CI akışı (PROD)
- Üretimde migration uygulama komutu:
  - `npx prisma migrate deploy`

`migrate deploy`, repodaki migration’ları sırasıyla uygular ve “reset” yapmaz. (Prod için doğru yöntem budur.)

## Drift (Şema Sapması) Notu
Eğer DB’ye elle müdahale edilirse veya `db push` kullanılırsa, Prisma migration geçmişi ile DB arasında sapma oluşur.
Bu projede sapmayı düzeltme yaklaşımı:
- Önce hatanın çıktısını paylaş (asla kafana göre resetleme/silme).
- Gerekirse kontrollü bir “fix migration” üretiriz.

## İsimlendirme
Migration isimleri:
- `init`
- `add_user_auth`
- `add_company_policy`
gibi, kısa ve anlamlı olmalı.
