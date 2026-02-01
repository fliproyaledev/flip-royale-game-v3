// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FlipRoyalePackShopV3
 * @notice Pack sales contract - Virtual token payment, 5 pack types, referral commission
 * @dev Pack Types: 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
 * @dev Virtual token on Base: 0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b (18 decimals)
 */
contract FlipRoyalePackShopV3 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────
    
    // Virtual token (Base chain) - 18 decimals
    IERC20 public immutable virtualToken;
    
    // Pack prices (18 decimals) - in Virtual tokens
    // Pack Types: 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
    uint256 public commonPackPrice   = 50_000 * 10**18;   // 50,000 VIRTUAL
    uint256 public rarePackPrice     = 100_000 * 10**18;  // 100,000 VIRTUAL
    uint256 public unicornPackPrice  = 50_000 * 10**18;   // 50,000 VIRTUAL
    uint256 public genesisPackPrice  = 50_000 * 10**18;   // 50,000 VIRTUAL
    uint256 public sentientPackPrice = 50_000 * 10**18;   // 50,000 VIRTUAL
    
    // Referral commission rate (1000 = 100%, so 100 = 10%)
    uint256 public referralCommissionRate = 100; // 10%
    uint256 public constant RATE_DENOMINATOR = 1000;
    
    // Platform treasury wallet
    address public treasury;
    
    // User referrer mapping
    mapping(address => address) public referrerOf;
    
    // Statistics
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
     * @param _virtualToken Virtual token address (Base): 0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b
     * @param _treasury Platform treasury wallet
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
     * @notice Set referrer (only once, cannot be changed)
     * @param referrer Referrer address
     */
    function setReferrer(address referrer) external {
        require(referrerOf[msg.sender] == address(0), "Referrer already set");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer != address(0), "Invalid referrer");
        
        referrerOf[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }
    
    /**
     * @notice Buy pack(s)
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param quantity How many packs (1-10)
     */
    function buyPack(uint8 packType, uint256 quantity) external nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity (1-10)");
        require(packType <= 4, "Invalid pack type (0-4)");
        
        uint256 unitPrice = getPackPrice(packType);
        uint256 totalPrice = unitPrice * quantity;
        
        // Check referrer
        address referrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            // Calculate commission (10%)
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            // Transfer: Platform share
            virtualToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            
            // Transfer: Referrer commission
            virtualToken.safeTransferFrom(msg.sender, referrer, commission);
            
            // Update stats
            totalEarnedByReferrer[referrer] += commission;
        } else {
            // No referrer - all goes to platform
            virtualToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        // Buyer stats
        packsPurchasedBy[msg.sender] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, referrer, commission);
    }
    
    /**
     * @notice Buy pack + set referrer (in one transaction)
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param quantity How many packs
     * @param referrer Referrer address (set if not already set)
     */
    function buyPackWithReferrer(uint8 packType, uint256 quantity, address referrer) external {
        // Set referrer if not already set
        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender) {
            referrerOf[msg.sender] = referrer;
            emit ReferrerSet(msg.sender, referrer);
        }
        
        // Buy pack (internal call)
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
            
            virtualToken.safeTransferFrom(buyer, treasury, platformAmount);
            virtualToken.safeTransferFrom(buyer, referrer, commission);
            
            totalEarnedByReferrer[referrer] += commission;
        } else {
            virtualToken.safeTransferFrom(buyer, treasury, totalPrice);
        }
        
        packsPurchasedBy[buyer] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(buyer, packType, quantity, totalPrice, referrer, commission);
    }
    
    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Get pack price
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
     * @notice Get all pack prices
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
     * @notice Get user referral info
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
     * @notice Get total sales statistics
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
     * @notice Update single pack price
     * @param packType 0=common, 1=rare, 2=unicorn, 3=genesis, 4=sentient
     * @param newPrice New price (18 decimals)
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
     * @notice Update all pack prices at once
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
        require(_rate <= 300, "Max 30% commission"); // Safety limit
        referralCommissionRate = _rate;
        emit CommissionRateUpdated(_rate);
    }
    
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    // Emergency: Rescue tokens sent by mistake
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
