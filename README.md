# FLIP ROYALE 🎮

A cryptocurrency prediction game built on Next.js where players predict token price movements and compete for points.



## 🎮 Game Features

- **PLAY Mode**: Daily prediction rounds with 5 cards
- **Arena Mode**: 1v1 duels with entry fees
- **Leaderboard**: Daily rankings and bonuses
- **Inventory**: Card collection system
- **Live Prices**: Real-time token prices from Dexscreener/GeckoTerminal



Private project - All rights reserved

## 🔌 Veri Kaynağı (Leaderboard)
- Üretimde `ORACLE_URL` ve `ORACLE_SECRET` ayarları mevcutsa liderlik tablosu verileri doğrudan Oracle backend'inden `/api/users/all` ile çekilir.
- Bu iki değişken yoksa üretimde hata fırlatılır; geliştirme ortamında ise sadece `data/local-users.json` dosyası yedek veri kaynağı olarak kullanılır.


