TURNİKE ZAMAN YÖNETİMİ – DEMO KURULUM

Bu demo, Node / PostgreSQL kurmadan, sadece Docker ile çalışır.

1) GEREKSİNİMLER

Windows / macOS / Linux

Docker Desktop kurulu olmalı
(https://www.docker.com/products/docker-desktop/
)

Not: Bilgisayarda Node.js, npm veya PostgreSQL kurulu olmasına gerek yoktur.

2) DEMO’YU ÇALIŞTIRMA

Zip dosyasını bir klasöre çıkar
(Örnek: C:\Work\turnike-demo)

Klasör içinde şu dosyalar görünmeli:

docker-compose.demo.yml

Dockerfile

.env.demo

Klasör içinde terminal aç:

Windows (PowerShell):

docker compose -f docker-compose.demo.yml up -d --build


macOS / Linux:

docker compose -f docker-compose.demo.yml up -d --build


İlk kurulum 5–15 dakika sürebilir (sadece ilk sefer).

3) UYGULAMAYI AÇMA

Tarayıcıdan:

http://localhost:3000


Demo ortamında login ekranı yoktur, sistem otomatik açılır.

4) DEMO’YU DURDURMA
docker compose -f docker-compose.demo.yml down

5) TAM SIFIRDAN YENİDEN KURULUM (DB DAHİL)

Tüm verileri silip tekrar kurmak için:

docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d --build


Bu işlem sadece demo verilerini siler.

6) SIK YAŞANAN DURUMLAR

3000 portu doluysa:
Başka bir uygulama kapatılmalı veya destek istenmeli.

Docker çalışmıyorsa:
Docker Desktop açık olmalıdır.

7) DESTEK

Herhangi bir sorun yaşanırsa, sadece şu komut çıktıları yeterlidir:

docker compose -f docker-compose.demo.yml ps


Turnike Zaman Yönetimi – Demo Paket
(On-prem, container tabanlı çalışır)