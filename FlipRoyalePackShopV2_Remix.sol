// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ═══════════════════════════════════════════════════════════════════
// OpenZeppelin Contracts v5.0 - Flattened for Remix
// ═══════════════════════════════════════════════════════════════════

// Context.sol
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// Ownable.sol
abstract contract Ownable is Context {
    address private _owner;

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// ReentrancyGuard.sol
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        _status = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// IERC20.sol
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// IERC20Permit.sol
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

// Address.sol
library Address {
    error AddressInsufficientBalance(address account);
    error AddressEmptyCode(address target);
    error FailedInnerCall();

    function sendValue(address payable recipient, uint256 amount) internal {
        if (address(this).balance < amount) {
            revert AddressInsufficientBalance(address(this));
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert FailedInnerCall();
        }
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        if (address(this).balance < value) {
            revert AddressInsufficientBalance(address(this));
        }
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata);
    }

    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata
    ) internal view returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            if (returndata.length == 0 && target.code.length == 0) {
                revert AddressEmptyCode(target);
            }
            return returndata;
        }
    }

    function verifyCallResult(bool success, bytes memory returndata) internal pure returns (bytes memory) {
        if (!success) {
            _revert(returndata);
        } else {
            return returndata;
        }
    }

    function _revert(bytes memory returndata) private pure {
        if (returndata.length > 0) {
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert FailedInnerCall();
        }
    }
}

// SafeERC20.sol
library SafeERC20 {
    using Address for address;

    error SafeERC20FailedOperation(address token);
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool))) && address(token).code.length > 0;
    }
}

// ═══════════════════════════════════════════════════════════════════
// FlipRoyalePackShopV2 - Main Contract
// ═══════════════════════════════════════════════════════════════════

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
        uint8 packType,
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
    
    function setReferrer(address referrer) external {
        require(referrerOf[msg.sender] == address(0), "Referrer already set");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(referrer != address(0), "Invalid referrer");
        
        referrerOf[msg.sender] = referrer;
        emit ReferrerSet(msg.sender, referrer);
    }
    
    function buyPack(uint8 packType, uint256 quantity) external nonReentrant {
        require(quantity > 0 && quantity <= 10, "Invalid quantity (1-10)");
        require(packType <= 4, "Invalid pack type (0-4)");
        
        uint256 unitPrice = getPackPrice(packType);
        uint256 totalPrice = unitPrice * quantity;
        
        address referrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (referrer != address(0)) {
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            flipToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            flipToken.safeTransferFrom(msg.sender, referrer, commission);
            
            totalEarnedByReferrer[referrer] += commission;
        } else {
            flipToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        packsPurchasedBy[msg.sender] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, referrer, commission);
    }
    
    function buyPackWithReferrer(uint8 packType, uint256 quantity, address referrer) external nonReentrant {
        if (referrerOf[msg.sender] == address(0) && referrer != address(0) && referrer != msg.sender) {
            referrerOf[msg.sender] = referrer;
            emit ReferrerSet(msg.sender, referrer);
        }
        
        require(quantity > 0 && quantity <= 10, "Invalid quantity (1-10)");
        require(packType <= 4, "Invalid pack type (0-4)");
        
        uint256 unitPrice = getPackPrice(packType);
        uint256 totalPrice = unitPrice * quantity;
        
        address actualReferrer = referrerOf[msg.sender];
        uint256 commission = 0;
        
        if (actualReferrer != address(0)) {
            commission = (totalPrice * referralCommissionRate) / RATE_DENOMINATOR;
            uint256 platformAmount = totalPrice - commission;
            
            flipToken.safeTransferFrom(msg.sender, treasury, platformAmount);
            flipToken.safeTransferFrom(msg.sender, actualReferrer, commission);
            
            totalEarnedByReferrer[actualReferrer] += commission;
        } else {
            flipToken.safeTransferFrom(msg.sender, treasury, totalPrice);
        }
        
        packsPurchasedBy[msg.sender] += quantity;
        totalPacksSoldByType[packType] += quantity;
        
        emit PackPurchased(msg.sender, packType, quantity, totalPrice, actualReferrer, commission);
    }
    
    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    function getPackPrice(uint8 packType) public view returns (uint256) {
        if (packType == 0) return commonPackPrice;
        if (packType == 1) return rarePackPrice;
        if (packType == 2) return unicornPackPrice;
        if (packType == 3) return genesisPackPrice;
        if (packType == 4) return sentientPackPrice;
        revert("Invalid pack type");
    }
    
    function getAllPackPrices() external view returns (
        uint256 common,
        uint256 rare,
        uint256 unicorn,
        uint256 genesis,
        uint256 sentient
    ) {
        return (commonPackPrice, rarePackPrice, unicornPackPrice, genesisPackPrice, sentientPackPrice);
    }
    
    function getReferralInfo(address user) external view returns (
        address referrer,
        uint256 packsPurchased,
        uint256 totalEarned
    ) {
        return (referrerOf[user], packsPurchasedBy[user], totalEarnedByReferrer[user]);
    }
    
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
        require(_rate <= 300, "Max 30% commission");
        referralCommissionRate = _rate;
        emit CommissionRateUpdated(_rate);
    }
    
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
