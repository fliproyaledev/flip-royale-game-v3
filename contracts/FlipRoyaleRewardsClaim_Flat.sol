// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import removed
// import removed
// import removed
// import removed
// import removed
// import removed

/**
 * @title FlipRoyaleRewardsClaim
 * @notice Allows users to claim their USDC rewards with oracle verification
 * @dev Uses signature-based authorization to prevent unauthorized claims
 */
contract FlipRoyaleRewardsClaim is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Base chain USDC (6 decimals)
    IERC20 public immutable usdc;
    
    // Oracle signer address
    address public oracle;
    
    // Nonce for replay protection
    mapping(address => uint256) public claimNonces;
    
    // Total claimed by user
    mapping(address => uint256) public totalClaimed;
    
    // Events
    event Claimed(address indexed user, uint256 amount, uint256 nonce);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    
    constructor(address _usdc, address _oracle) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_oracle != address(0), "Invalid oracle");
        
        usdc = IERC20(_usdc);
        oracle = _oracle;
    }
    
    /**
     * @notice Claim USDC rewards with oracle signature
     * @param amount Amount of USDC to claim (6 decimals)
     * @param nonce Unique nonce for this claim
     * @param signature Oracle signature authorizing this claim
     */
    function claim(
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(nonce == claimNonces[msg.sender], "Invalid nonce");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            amount,
            nonce,
            address(this),
            block.chainid
        ));
        
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        
        require(signer == oracle, "Invalid signature");
        
        // Check contract has enough balance
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= amount, "Insufficient contract balance");
        
        // Update state
        claimNonces[msg.sender]++;
        totalClaimed[msg.sender] += amount;
        
        // Transfer USDC
        usdc.safeTransfer(msg.sender, amount);
        
        emit Claimed(msg.sender, amount, nonce);
    }
    
    /**
     * @notice Get user's current claim nonce
     */
    function getNonce(address user) external view returns (uint256) {
        return claimNonces[user];
    }
    
    /**
     * @notice Get contract USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Update oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        address oldOracle = oracle;
        oracle = newOracle;
        emit OracleUpdated(oldOracle, newOracle);
    }
    
    /**
     * @notice Deposit USDC to contract for rewards pool
     */
    function deposit(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }
    
    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        usdc.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount);
    }
}
