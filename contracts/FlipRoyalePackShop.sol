// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FlipRoyalePackShop
 * @notice Pack satış kontratı - VIRTUAL token ile ödeme, referral komisyon sistemi
 * @dev Komisyon fiyata dahil: Kullanıcı 10 öder → 9 platform, 1 referrer
 */
contract FlipRoyalePackShop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────
    
    IERC20 public immutable virtualToken;
    
    // Paket fiyatları (18 decimals)
    uint256 public commonPackPrice = 5 * 10**18;  // 5 VIRTUAL
    uint256 public rarePackPrice = 15 * 10**18;   // 15 VIRTUAL
    
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
    
    // ─────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────
    
    event PackPurchased(
        address indexed buyer,
        uint8 packType,      // 0 = common, 1 = rare
        uint256 quantity,
        uint256 totalPrice,
        address indexed referrer,
        uint256 referralCommission
    );
    
    event ReferrerSet(address indexed user, address indexed referrer);
    event PricesUpdated(uint256 commonPrice, uint256 rarePrice);
    event CommissionRateUpdated(uint256 newRate);
    event TreasuryUpdated(address newTreasury);
    
    // ─────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @param _virtualToken VIRTUAL token adresi (Base chain)
     * @param _treasury Platform gelir cüzdanı
     */
    constructor(address _virtualToken, address _treasury) Ownable(msg.sender) {
        require(_virtualToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        virtualToken = IERC20(_virtualToken);
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
     * @param packType 0 = common, 1 = rare
     * @param quantity Kaç paket
     */
    function buyPack(uint8 packType, uint256 quantity) external nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity");
        require(packType <= 1, "Invalid pack type");
        
        uint256 unitPrice = packType == 0 ? commonPackPrice : rarePackPrice;
        uint256 totalPrice = unitPrice * quantity;
        
        // Referrer kontrolü
        address referrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            // Komisyon hesapla (%10)
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            // Transfer: Platform payı
            virtualToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            
            // Transfer: Referrer komisyonu
            virtualToken.safeTransferFrom(msg.sender, referrer, commission);
            
            // İstatistik güncelle
            totalEarnedByReferrer[referrer] += commission;
        } else {
            // Referrer yoksa tamamı platforma
            virtualToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        // Alıcı istatistiği
        packsPurchasedBy[msg.sender] += quantity;
        
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, referrer, commission);
    }
    
    /**
     * @notice Paket satın al + referrer ayarla (tek işlemde)
     */
    function buyPackWithReferrer(uint8 packType, uint256 quantity, address referrer) external {
        // Referrer henüz ayarlanmadıysa ayarla
        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender) {
            referrerOf[msg.sender] = referrer;
            emit ReferrerSet(msg.sender, referrer);
        }
        
        // Paketi satın al
        this.buyPack(packType, quantity);
    }
    
    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    function getPackPrice(uint8 packType) external view returns (uint256) {
        return packType == 0 ? commonPackPrice : rarePackPrice;
    }
    
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
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    function updatePrices(uint256 _commonPrice, uint256 _rarePrice) external onlyOwner {
        require(_commonPrice > 0 && _rarePrice > 0, "Invalid prices");
        commonPackPrice = _commonPrice;
        rarePackPrice = _rarePrice;
        emit PricesUpdated(_commonPrice, _rarePrice);
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
