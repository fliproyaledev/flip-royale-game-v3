// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FlipRoyalePackShopV2
 * @notice Pack satış kontratı - $FLIP token ile ödeme, 5 paket tipi, referral komisyon sistemi
 * @dev Pack Types: 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
 */
contract FlipRoyalePackShopV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────
    
    // $FLIP token (Base chain)
    IERC20 public immutable flipToken;
    
    // Paket fiyatları (18 decimals)
    // Pack Types: 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
    uint256 public commonPackPrice   = 50_000 * 10**18;   // 50,000 FLIP
    uint256 public rarePackPrice     = 100_000 * 10**18;  // 100,000 FLIP
    uint256 public unicornPackPrice  = 50_000 * 10**18;   // 50,000 FLIP
    uint256 public genesisPackPrice  = 50_000 * 10**18;   // 50,000 FLIP
    uint256 public sentientPackPrice = 50_000 * 10**18;   // 50,000 FLIP
    
    // Komisyon oranı (1000 = %100, yani 100 = %10)
    uint256 public referralCommissionRate = 100; // %10
    uint256 public constant RATE_DENOMINATOR = 1000;
    
    // Platform gelir cüzdanı
    address public treasury;
    
    // Kullanıcı referrer mapping
    mapping(address => address) public referrerOf;
    
    // İstatistikler
    mapping(address => uint256) public totalEarnedByReferrer;
    mapping(address => uint256) public packsPurchasedBy;
    mapping(uint8 => uint256) public totalPacksSoldByType;
    
    // ─────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────
    
    event PackPurchased(
        address indexed buyer,
        uint8 packType,      // 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
        uint256 quantity,
        uint256 totalPrice,
        address indexed referrer,
        uint256 referralCommission
    );
    
    event ReferrerSet(address indexed user, address indexed referrer);
    event PriceUpdated(uint8 packType, uint256 newPrice);
    event CommissionRateUpdated(uint256 newRate);
    event TreasuryUpdated(address newTreasury);
    
    // ─────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @param _flipToken $FLIP token adresi (Base chain): 0xB8E4a7b56BDc2a2598C2011e61eF7669Ee3F589e
     * @param _treasury Platform gelir cüzdanı
     */
    constructor(address _flipToken, address _treasury) Ownable(msg.sender) {
        require(_flipToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        flipToken = IERC20(_flipToken);
        treasury = _treasury;
    }
    
    // ─────────────────────────────────────────────────────────────
    // PUBLIC FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Referrer ayarla (sadece 1 kez, değiştirilemez)
     * @param referrer Referans veren adres
     */
    function setReferrer(address referrer) external {
        require(referrerOf[msg.sender] == address(0), "Referrer already set");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer != address(0), "Invalid referrer");
        
        referrerOf[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }
    
    /**
     * @notice Paket satın al
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param quantity Kaç paket (1-10)
     */
    function buyPack(uint8 packType, uint256 quantity) external nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity (1-10)");
        require(packType <= 4, "Invalid pack type (0-4)");
        
        uint256 unitPrice = getPackPrice(packType);
        uint256 totalPrice = unitPrice * quantity;
        
        // Referrer kontrolü
        address referrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            // Komisyon hesapla (%10)
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            // Transfer: Platform payı
            flipToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            
            // Transfer: Referrer komisyonu
            flipToken.safeTransferFrom(msg.sender, referrer, commission);
            
            // İstatistik güncelle
            totalEarnedByReferrer[referrer] += commission;
        } else {
            // Referrer yoksa tamamı platforma
            flipToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        // Alıcı istatistiği
        packsPurchasedBy[msg.sender] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, referrer, commission);
    }
    
    /**
     * @notice Paket satın al + referrer ayarla (tek işlemde)
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param quantity Kaç paket
     * @param referrer Referans veren adres (ilk kez ayarlanıyorsa)
     */
    function buyPackWithReferrer(uint8 packType, uint256 quantity, address referrer) external {
        // Referrer henüz ayarlanmadıysa ayarla
        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender) {
            referrerOf[msg.sender] = referrer;
            emit ReferrerSet(msg.sender, referrer);
        }
        
        // Paketi satın al (internal call ile nonReentrant bypass)
        _buyPackInternal(msg.sender, packType, quantity);
    }
    
    /**
     * @dev Internal buy function for combined operations
     */
    function _buyPackInternal(address buyer, uint8 packType, uint256 quantity) internal nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity (1-10)");
        require(packType <= 4, "Invalid pack type (0-4)");
        
        uint256 unitPrice = getPackPrice(packType);
        uint256 totalPrice = unitPrice * quantity;
        
        address referrer = referrerOf[buyer];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            flipToken.safeTransferFrom(buyer, treasury, platformAmount);
            flipToken.safeTransferFrom(buyer, referrer, commission);
            
            totalEarnedByReferrer[referrer] += commission;
        } else {
            flipToken.safeTransferFrom(buyer, treasury, totalPrice);
        }
        
        packsPurchasedBy[buyer] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(buyer, packType, quantity, totalPrice, referrer, commission);
    }
    
    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Paket fiyatını döndür
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     */
    function getPackPrice(uint8 packType) public view returns (uint256) {
        if (packType == 0) return commonPackPrice;
        if (packType == 1) return rarePackPrice;
        if (packType == 2) return unicornPackPrice;
        if (packType == 3) return genesisPackPrice;
        if (packType == 4) return sentientPackPrice;
        revert("Invalid pack type");
    }
    
    /**
     * @notice Tüm paket fiyatlarını döndür
     */
    function getAllPackPrices() external view returns (
        uint256 common,
        uint256 rare,
        uint256 unicorn,
        uint256 genesis,
        uint256 sentient
    ) {
        return (
            commonPackPrice,
            rarePackPrice,
            unicornPackPrice,
            genesisPackPrice,
            sentientPackPrice
        );
    }
    
    /**
     * @notice Kullanıcı referral bilgilerini döndür
     */
    function getReferralInfo(address user) external view returns (
        address referrer,
        uint256 packsPurchased,
        uint256 totalEarned
    ) {
        return (
            referrerOf[user],
            packsPurchasedBy[user],
            totalEarnedByReferrer[user]
        );
    }
    
    /**
     * @notice Toplam satış istatistikleri
     */
    function getTotalSales() external view returns (
        uint256 common,
        uint256 rare,
        uint256 unicorn,
        uint256 genesis,
        uint256 sentient
    ) {
        return (
            totalPacksSoldByType[0],
            totalPacksSoldByType[1],
            totalPacksSoldByType[2],
            totalPacksSoldByType[3],
            totalPacksSoldByType[4]
        );
    }
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Tek bir paket fiyatını güncelle
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param newPrice Yeni fiyat (18 decimals)
     */
    function updatePackPrice(uint8 packType, uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        require(packType <= 4, "Invalid pack type");
        
        if (packType == 0) commonPackPrice = newPrice;
        else if (packType == 1) rarePackPrice = newPrice;
        else if (packType == 2) unicornPackPrice = newPrice;
        else if (packType == 3) genesisPackPrice = newPrice;
        else if (packType == 4) sentientPackPrice = newPrice;
        
        emit PriceUpdated(packType, newPrice);
    }
    
    /**
     * @notice Tüm paket fiyatlarını tek seferde güncelle
     */
    function updateAllPrices(
        uint256 _common,
        uint256 _rare,
        uint256 _unicorn,
        uint256 _genesis,
        uint256 _sentient
    ) external onlyOwner {
        require(_common > 0 && _rare > 0 && _unicorn > 0 && _genesis > 0 && _sentient > 0, "Invalid prices");
        
        commonPackPrice = _common;
        rarePackPrice = _rare;
        unicornPackPrice = _unicorn;
        genesisPackPrice = _genesis;
        sentientPackPrice = _sentient;
        
        emit PriceUpdated(0, _common);
        emit PriceUpdated(1, _rare);
        emit PriceUpdated(2, _unicorn);
        emit PriceUpdated(3, _genesis);
        emit PriceUpdated(4, _sentient);
    }
    
    function updateCommissionRate(uint256 _rate) external onlyOwner {
        require(_rate <= 300, "Max 30% commission"); // Güvenlik limiti
        referralCommissionRate = _rate;
        emit CommissionRateUpdated(_rate);
    }
    
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    // Emergency: Yanlışlıkla gönderilen token'ları kurtar
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
