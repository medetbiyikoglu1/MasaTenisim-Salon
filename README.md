# Masa Tenisi Salon

Masa tenisi salonları için turnuva yönetimi, ELO reytingi ve masa kiralama uygulaması.

## Lokal geliştirme

Gerekenler: Node.js 22, Docker.

```bash
cp .env.example .env
docker compose up -d db        # PostgreSQL
npm install
npm run db:migrate             # tabloları oluşturur
npm run db:seed                # 5 masalı pilot salonu ekler
npm run dev                    # http://localhost:3000
```

Testler: `npm test`

## Sunucuda çalıştırma

```bash
POSTGRES_PASSWORD=guclu-bir-sifre docker compose --profile prod up -d --build
```

Uygulama 3000 portunda açılır; önüne HTTPS için Caddy veya Nginx konmalıdır.

## Yapı

- `src/lib/tournament/`: turnuva kuralları (ELO, yılan dizilim, grup fikstürü, sıralama, eleme tablosu, masa kuyruğu) ve testleri. Veritabanından bağımsızdır.
- `src/lib/services/`: kuralları veritabanına uygulayan servisler.
- `src/app/`: ekranlar (özet, turnuvalar, oyuncular, masalar).
- `prisma/schema.prisma`: veri modeli.

## Durum

Hazır: proje iskeleti, veri modeli, oyuncu ve masa yönetimi, hafta içi / hafta sonu ücreti, turnuva oluşturma (ELO'ya göre gruplar, her gruba masa, grup maçları, masaların kiralamaya kapatılması).

Sırada: e-posta ile giriş, turnuva günü ekranı (otomatik masa ataması, skor girişi ve onay), eleme tablosu ve ELO güncellemesi, TV ekranı, kiralama takvimi.
