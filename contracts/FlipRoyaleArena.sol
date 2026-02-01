// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title FlipRoyaleArena
 * @notice PvP Arena contract - USDC stakes, oracle resolution, automatic payouts
 * @dev Tier-based matchmaking with 4 stake levels: Bronze($10), Silver($25), Gold($50), Diamond($100)
 * 
 * Fee Structure:
 * - Winner: 90%
 * - Team: 5%
 * - ReplyCorp: 5% (accumulated, paid later)
 */
contract FlipRoyaleArena is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────
    
    // Base chain USDC (6 decimals)
    IERC20 public immutable usdc;
    
    // Fee rates (1000 = 100%)
    uint256 public constant WINNER_RATE = 900;        // 90%
    uint256 public constant TEAM_RATE = 50;           // 5%
    uint256 public constant REPLYCORP_RATE = 50;      // 5%
    uint256 public constant RATE_DENOMINATOR = 1000;
    
    // ─────────────────────────────────────────────────────────────
    // ENUMS & STRUCTS
    // ─────────────────────────────────────────────────────────────
    
    enum RoomStatus { Open, Filled, Resolved, Cancelled }
    enum GameMode { Duel, Taso }
    
    struct Room {
        bytes32 id;
        address player1;
        address player2;
        uint256 stake;              // USDC amount per player (6 decimals)
        uint8 tier;                 // 0=Bronze, 1=Silver, 2=Gold, 3=Diamond
        GameMode gameMode;          // Duel or Taso
        RoomStatus status;
        address winner;
        uint256 createdAt;
        uint256 resolvedAt;
    }
    
    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────
    
    // Tier prices in USDC (6 decimals)
    uint256 public bronzeStake  = 10 * 10**6;   // $10
    uint256 public silverStake  = 25 * 10**6;   // $25
    uint256 public goldStake    = 50 * 10**6;   // $50
    uint256 public diamondStake = 100 * 10**6;  // $100
    
    // Wallets
    address public treasury;        // Team wallet (5%)
    address public oracle;          // Signer for resolving games
    
    // ReplyCorp tracking (accumulated, paid later)
    uint256 public pendingReplyCorpFees;
    uint256 public totalReplyCorpPaid;
    
    // Room storage
    mapping(bytes32 => Room) public rooms;
    bytes32[] public allRoomIds;
    
    // User tracking
    mapping(address => bytes32[]) public userRooms;
    mapping(address => uint256) public userWins;
    mapping(address => uint256) public userLosses;
    mapping(address => uint256) public userTotalWinnings;
    
    // Tier statistics
    mapping(uint8 => uint256) public totalRoomsByTier;
    mapping(uint8 => uint256) public totalVolumeByTier;
    
    // Nonce for signature replay protection
    mapping(bytes32 => bool) public usedNonces;
    
    // ─────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────
    
    event RoomCreated(
        bytes32 indexed roomId,
        address indexed player1,
        uint8 tier,
        GameMode gameMode,
        uint256 stake
    );
    
    event RoomJoined(
        bytes32 indexed roomId,
        address indexed player2
    );
    
    event RoomResolved(
        bytes32 indexed roomId,
        address indexed winner,
        uint256 winnerPayout,
        uint256 teamFee,
        uint256 replyCorpFee
    );
    
    event RoomCancelled(
        bytes32 indexed roomId,
        address indexed player1
    );
    
    event ReplyCorpFeesWithdrawn(
        address indexed to,
        uint256 amount
    );
    
    event OracleUpdated(address indexed newOracle);
    event TreasuryUpdated(address indexed newTreasury);
    event TierStakeUpdated(uint8 tier, uint256 newStake);
    
    // ─────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @param _usdc Base chain USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
     * @param _treasury Team wallet for 5% fees
     * @param _oracle Trusted signer for game resolution
     */
    constructor(
        address _usdc,
        address _treasury,
        address _oracle
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        require(_oracle != address(0), "Invalid oracle");
        
        usdc = IERC20(_usdc);
        treasury = _treasury;
        oracle = _oracle;
    }
    
    // ─────────────────────────────────────────────────────────────
    // USER FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Create a new room with USDC stake
     * @param tier 0=Bronze($10), 1=Silver($25), 2=Gold($50), 3=Diamond($100)
     * @param gameMode 0=Duel, 1=Taso
     * @return roomId The created room ID
     */
    function createRoom(
        uint8 tier,
        GameMode gameMode
    ) external nonReentrant whenNotPaused returns (bytes32 roomId) {
        require(tier <= 3, "Invalid tier");
        
        uint256 stake = getTierStake(tier);
        
        // Generate unique room ID
        roomId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            allRoomIds.length
        ));
        
        // Transfer stake to contract
        usdc.safeTransferFrom(msg.sender, address(this), stake);
        
        // Create room
        rooms[roomId] = Room({
            id: roomId,
            player1: msg.sender,
            player2: address(0),
            stake: stake,
            tier: tier,
            gameMode: gameMode,
            status: RoomStatus.Open,
            winner: address(0),
            createdAt: block.timestamp,
            resolvedAt: 0
        });
        
        allRoomIds.push(roomId);
        userRooms[msg.sender].push(roomId);
        totalRoomsByTier[tier]++;
        
        emit RoomCreated(roomId, msg.sender, tier, gameMode, stake);
        
        return roomId;
    }
    
    /**
     * @notice Join an existing room with matching stake
     * @param roomId The room to join
     */
    function joinRoom(bytes32 roomId) external nonReentrant whenNotPaused {
        Room storage room = rooms[roomId];
        
        require(room.player1 != address(0), "Room not found");
        require(room.status == RoomStatus.Open, "Room not open");
        require(room.player1 != msg.sender, "Cannot join own room");
        
        // Transfer stake to contract
        usdc.safeTransferFrom(msg.sender, address(this), room.stake);
        
        // Update room
        room.player2 = msg.sender;
        room.status = RoomStatus.Filled;
        
        userRooms[msg.sender].push(roomId);
        totalVolumeByTier[room.tier] += room.stake * 2;
        
        emit RoomJoined(roomId, msg.sender);
    }
    
    /**
     * @notice Cancel own room (only if not filled)
     * @param roomId The room to cancel
     */
    function cancelRoom(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        
        require(room.player1 == msg.sender, "Not room creator");
        require(room.status == RoomStatus.Open, "Cannot cancel");
        
        room.status = RoomStatus.Cancelled;
        
        // Refund stake
        usdc.safeTransfer(msg.sender, room.stake);
        
        emit RoomCancelled(roomId, msg.sender);
    }
    
    // ─────────────────────────────────────────────────────────────
    // ORACLE FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Resolve room with oracle signature
     * @param roomId The room to resolve
     * @param winner The winner address (must be player1 or player2)
     * @param nonce Unique nonce for replay protection
     * @param signature Oracle signature of (roomId, winner, nonce)
     */
    function resolveRoom(
        bytes32 roomId,
        address winner,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        Room storage room = rooms[roomId];
        
        require(room.status == RoomStatus.Filled, "Room not filled");
        require(winner == room.player1 || winner == room.player2, "Invalid winner");
        require(!usedNonces[nonce], "Nonce already used");
        
        // Verify oracle signature
        bytes32 messageHash = keccak256(abi.encodePacked(roomId, winner, nonce));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == oracle, "Invalid oracle signature");
        
        // Mark nonce as used
        usedNonces[nonce] = true;
        
        // Calculate payouts
        uint256 totalPot = room.stake * 2;
        uint256 winnerPayout = (totalPot * WINNER_RATE) / RATE_DENOMINATOR;    // 90%
        uint256 teamFee = (totalPot * TEAM_RATE) / RATE_DENOMINATOR;           // 5%
        uint256 replyCorpFee = (totalPot * REPLYCORP_RATE) / RATE_DENOMINATOR; // 5%
        
        // Update room
        room.status = RoomStatus.Resolved;
        room.winner = winner;
        room.resolvedAt = block.timestamp;
        
        // Update stats
        address loser = winner == room.player1 ? room.player2 : room.player1;
        userWins[winner]++;
        userLosses[loser]++;
        userTotalWinnings[winner] += winnerPayout;
        
        // Accumulate ReplyCorp fee
        pendingReplyCorpFees += replyCorpFee;
        
        // Transfer payouts
        usdc.safeTransfer(winner, winnerPayout);
        usdc.safeTransfer(treasury, teamFee);
        
        emit RoomResolved(roomId, winner, winnerPayout, teamFee, replyCorpFee);
    }
    
    // ─────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Get tier stake amount
     */
    function getTierStake(uint8 tier) public view returns (uint256) {
        if (tier == 0) return bronzeStake;
        if (tier == 1) return silverStake;
        if (tier == 2) return goldStake;
        if (tier == 3) return diamondStake;
        revert("Invalid tier");
    }
    
    /**
     * @notice Get all tier stakes
     */
    function getAllTierStakes() external view returns (
        uint256 bronze,
        uint256 silver,
        uint256 gold,
        uint256 diamond
    ) {
        return (bronzeStake, silverStake, goldStake, diamondStake);
    }
    
    /**
     * @notice Get room details
     */
    function getRoom(bytes32 roomId) external view returns (Room memory) {
        return rooms[roomId];
    }
    
    /**
     * @notice Get user's room history
     */
    function getUserRooms(address user) external view returns (bytes32[] memory) {
        return userRooms[user];
    }
    
    /**
     * @notice Get user statistics
     */
    function getUserStats(address user) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 totalWinnings,
        uint256 roomCount
    ) {
        return (
            userWins[user],
            userLosses[user],
            userTotalWinnings[user],
            userRooms[user].length
        );
    }
    
    /**
     * @notice Get total rooms count
     */
    function getTotalRoomsCount() external view returns (uint256) {
        return allRoomIds.length;
    }
    
    /**
     * @notice Get open rooms (for matchmaking)
     * @dev Returns up to 50 open rooms for the given tier
     */
    function getOpenRooms(uint8 tier, uint256 offset, uint256 limit) 
        external 
        view 
        returns (bytes32[] memory roomIds, uint256 total) 
    {
        // Count open rooms for tier
        uint256 count = 0;
        for (uint256 i = 0; i < allRoomIds.length; i++) {
            Room storage room = rooms[allRoomIds[i]];
            if (room.tier == tier && 
                room.status == RoomStatus.Open) {
                count++;
            }
        }
        
        total = count;
        
        // Apply pagination
        if (offset >= count) {
            return (new bytes32[](0), total);
        }
        
        uint256 remaining = count - offset;
        uint256 resultSize = remaining < limit ? remaining : limit;
        roomIds = new bytes32[](resultSize);
        
        uint256 found = 0;
        uint256 added = 0;
        
        for (uint256 i = 0; i < allRoomIds.length && added < resultSize; i++) {
            Room storage room = rooms[allRoomIds[i]];
            if (room.tier == tier && 
                room.status == RoomStatus.Open) {
                if (found >= offset) {
                    roomIds[added] = allRoomIds[i];
                    added++;
                }
                found++;
            }
        }
        
        return (roomIds, total);
    }
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────
    
    /**
     * @notice Update tier stake amount
     */
    function updateTierStake(uint8 tier, uint256 newStake) external onlyOwner {
        require(newStake > 0, "Invalid stake");
        require(tier <= 3, "Invalid tier");
        
        if (tier == 0) bronzeStake = newStake;
        else if (tier == 1) silverStake = newStake;
        else if (tier == 2) goldStake = newStake;
        else if (tier == 3) diamondStake = newStake;
        
        emit TierStakeUpdated(tier, newStake);
    }
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @notice Update oracle address
     */
    function updateOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }
    
    /**
     * @notice Withdraw accumulated ReplyCorp fees
     * @param to ReplyCorp wallet address
     * @param amount Amount to withdraw
     */
    function withdrawReplyCorpFees(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount <= pendingReplyCorpFees, "Insufficient pending fees");
        
        pendingReplyCorpFees -= amount;
        totalReplyCorpPaid += amount;
        
        usdc.safeTransfer(to, amount);
        
        emit ReplyCorpFeesWithdrawn(to, amount);
    }
    
    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency: rescue stuck tokens
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(usdc), "Cannot rescue USDC");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
