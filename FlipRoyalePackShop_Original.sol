// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlipRoyalePackShop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable virtualToken;
    
    uint256 public commonPackPrice = 5 * 10**18;
    uint256 public rarePackPrice = 15 * 10**18;
    
    uint256 public referralCommissionRate = 100; // %10
    uint256 public constant RATE_DENOMINATOR = 1000;
    
    address public treasury;
    
    mapping(address => address) public referrerOf;
    mapping(address => uint256) public totalEarnedByReferrer;
    mapping(address => uint256) public packsPurchasedBy;
    
    event PackPurchased(address indexed buyer, uint8 packType, uint256 quantity, uint256 totalPrice, address indexed referrer, uint256 referralCommission);
    event ReferrerSet(address indexed user, address indexed referrer);
    
    constructor(address _virtualToken, address _treasury) Ownable(msg.sender) {
        require(_virtualToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        virtualToken = IERC20(_virtualToken);
        treasury = _treasury;
    }
    
    function setReferrer(address referrer) external {
        require(referrerOf[msg.sender] == address(0), "Referrer already set");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer != address(0), "Invalid referrer");
        referrerOf[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }
    
    function buyPack(uint8 packType, uint256 quantity) external nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity");
        require(packType <= 1, "Invalid pack type");
        
        uint256 unitPrice = packType == 0 ? commonPackPrice : rarePackPrice;
        uint256 totalPrice = unitPrice * quantity;
        
        address referrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            virtualToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            virtualToken.safeTransferFrom(msg.sender, referrer, commission);
            totalEarnedByReferrer[referrer] += commission;
        } else {
            virtualToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        packsPurchasedBy[msg.sender] += quantity;
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, referrer, commission);
    }
    
    function buyPackWithReferrer(uint8 packType, uint256 quantity, address referrer) external {
        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender) {
            referrerOf[msg.sender] = referrer;
            emit ReferrerSet(msg.sender, referrer);
        }
        this.buyPack(packType, quantity);
    }
    
    function getPackPrice(uint8 packType) external view returns (uint256) {
        return packType == 0 ? commonPackPrice : rarePackPrice;
    }
    
    function updatePrices(uint256 _commonPrice, uint256 _rarePrice) external onlyOwner {
        commonPackPrice = _commonPrice;
        rarePackPrice = _rarePrice;
    }
    
    function updateCommissionRate(uint256 _rate) external onlyOwner {
        require(_rate <= 300, "Max 30%");
        referralCommissionRate = _rate;
    }
    
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid");
        treasury = _treasury;
    }
    
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
