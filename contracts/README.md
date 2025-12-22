# FlipRoyale Smart Contract

VIRTUAL token ile paket satış ve referral komisyon sistemi.

## Özellikler

- ✅ VIRTUAL token (ERC20) ile ödeme
- ✅ Otomatik referral komisyon split (%10 referrer, %90 platform)
- ✅ OpenZeppelin güvenlik standartları
- ✅ Base chain uyumlu

## Kurulum

```bash
# Hardhat ve bağımlılıkları yükle
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv

# Kontratı derle
npx hardhat compile
```

## Deploy

1. `.env.contracts.example` dosyasını `.env` olarak kopyala
2. Gerekli değerleri doldur:
   - `PRIVATE_KEY`: Deploy cüzdanı private key
   - `TREASURY_ADDRESS`: Platform gelir cüzdanı
   - `BASESCAN_API_KEY`: Verification için (opsiyonel)

3. Deploy et:
```bash
# Testnet (Base Sepolia)
npx hardhat run scripts/deploy-pack-shop.js --network baseSepolia

# Mainnet (Base)
npx hardhat run scripts/deploy-pack-shop.js --network base
```

## Kontrat Kullanımı

### Kullanıcı İşlemleri

```javascript
// 1. VIRTUAL token approve (frontend'de)
await virtualToken.approve(packShopAddress, amount);

// 2. Referrer ile paket al
await packShop.buyPackWithReferrer(
  0,           // packType: 0=common, 1=rare
  1,           // quantity
  referrerAddress
);
```

### Admin İşlemleri

```javascript
// Fiyat güncelle
await packShop.updatePrices(
  ethers.parseEther("5"),   // common: 5 VIRTUAL
  ethers.parseEther("15")   // rare: 15 VIRTUAL
);

// Komisyon oranı güncelle (100 = %10)
await packShop.updateCommissionRate(100);

// Treasury güncelle
await packShop.updateTreasury(newTreasuryAddress);
```

## Komisyon Matematiği

```
Paket Fiyatı: 10 VIRTUAL
├── Kullanıcı öder: 10 VIRTUAL
├── Referrer alır: 1 VIRTUAL (%10)
└── Platform alır: 9 VIRTUAL (%90)
```

Komisyon fiyata **dahil**, ek değil!

## Güvenlik

- ✅ OpenZeppelin Ownable (admin kontrolü)
- ✅ ReentrancyGuard (reentrancy koruması)
- ✅ SafeERC20 (güvenli token transferi)
- ✅ Max komisyon limiti (%30)
- ✅ Emergency token rescue fonksiyonu

## Adresler

| Network | VIRTUAL Token |
|---------|---------------|
| Base Mainnet | `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b` |

## License

MIT
