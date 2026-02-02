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
 * @title FlipRoyaleArena V1.1 (Upgrade)
 * @notice UPGRADE for existing V1 proxy - adds emergencyWithdraw functions
 * @dev Storage layout MUST match V1 exactly! Only add new functions at the end.
 * 
 * NEW FUNCTIONS:
 * - emergencyWithdrawOpen: Owner can refund Open rooms (no player2)
 * - emergencyWithdrawAll: Owner can extract all USDC to treasury
 * - cancelRoom: Creator can cancel their Open room
 */
contract FlipRoyaleArenaV1_1 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS (same as V1)
    // ═══════════════════════════════════════════════════════════════
    
    IERC20 public immutable usdc;
    
    uint256 public constant WINNER_RATE = 900;
    uint256 public constant FEE_RATE = 100;
    uint256 public constant RATE_DENOMINATOR = 1000;

    // ═══════════════════════════════════════════════════════════════
    // ENUMS & STRUCTS (same as V1 - DO NOT CHANGE ORDER!)
    // ═══════════════════════════════════════════════════════════════
    
    enum RoomStatus { Open, Filled, Resolved, Draw, Cancelled }
    enum GameMode { Duel, Taso }
    
    struct Room {
        bytes32 id;
        address player1;
        address player2;
        uint256 stake;
        uint8 tier;
        GameMode gameMode;
        RoomStatus status;
        address winner;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE (same as V1 - DO NOT CHANGE ORDER!)
    // ═══════════════════════════════════════════════════════════════
    
    uint256 public bronzeStake;
    uint256 public silverStake;
    uint256 public goldStake;
    uint256 public diamondStake;
    
    address public treasury;
    address public oracle;
    
    mapping(bytes32 => Room) public rooms;
    bytes32[] public allRoomIds;
    
    mapping(address => bytes32[]) public userRooms;
    mapping(address => uint256) public userWins;
    mapping(address => uint256) public userLosses;
    mapping(address => uint256) public userTotalWinnings;
    
    mapping(uint8 => uint256) public totalRoomsByTier;
    mapping(uint8 => uint256) public totalVolumeByTier;
    
    mapping(bytes32 => bool) public usedNonces;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    
    event RoomCreated(bytes32 indexed roomId, address indexed player1, uint8 tier, GameMode gameMode, uint256 stake);
    event RoomJoined(bytes32 indexed roomId, address indexed player2, uint256 stake);
    event RoomResolved(bytes32 indexed roomId, address indexed winner, uint256 winnerPayout, uint256 teamFee, uint256 replyCorpFee);
    event RoomDraw(bytes32 indexed roomId, address player1, address player2, uint256 refundEach);
    event RoomCancelled(bytes32 indexed roomId, address indexed player, uint256 refund);
    event EmergencyWithdraw(bytes32 indexed roomId, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════
    
    constructor(address _usdc, address _treasury, address _oracle) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        oracle = _oracle;
        
        bronzeStake = 10 * 10**6;
        silverStake = 25 * 10**6;
        goldStake = 50 * 10**6;
        diamondStake = 100 * 10**6;
    }

    // ═══════════════════════════════════════════════════════════════
    // EXISTING FUNCTIONS (from V1)
    // ═══════════════════════════════════════════════════════════════
    
    function createRoom(uint8 tier, GameMode gameMode) external nonReentrant whenNotPaused returns (bytes32 roomId) {
        require(tier <= 3, "Invalid tier");
        uint256 stake = getTierStake(tier);
        
        roomId = keccak256(abi.encodePacked(msg.sender, block.timestamp, allRoomIds.length));
        
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
        
        usdc.safeTransferFrom(msg.sender, address(this), stake);
        emit RoomCreated(roomId, msg.sender, tier, gameMode, stake);
    }
    
    function joinRoom(bytes32 roomId) external nonReentrant whenNotPaused {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Open, "Room not open");
        require(room.player1 != msg.sender, "Cannot join own room");
        
        usdc.safeTransferFrom(msg.sender, address(this), room.stake);
        
        room.player2 = msg.sender;
        room.status = RoomStatus.Filled;
        
        userRooms[msg.sender].push(roomId);
        totalVolumeByTier[room.tier] += room.stake * 2;
        
        emit RoomJoined(roomId, msg.sender, room.stake);
    }
    
    function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Filled, "Room not filled");
        require(!usedNonces[nonce], "Nonce already used");
        require(winner == room.player1 || winner == room.player2, "Invalid winner");
        
        bytes32 messageHash = keccak256(abi.encodePacked(roomId, winner, nonce));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(ethSignedHash.recover(signature) == oracle, "Invalid oracle signature");
        
        usedNonces[nonce] = true;
        
        uint256 totalPot = room.stake * 2;
        uint256 winnerPayout = (totalPot * WINNER_RATE) / RATE_DENOMINATOR;
        uint256 fee = (totalPot * FEE_RATE) / RATE_DENOMINATOR;
        
        room.status = RoomStatus.Resolved;
        room.winner = winner;
        room.resolvedAt = block.timestamp;
        
        address loser = winner == room.player1 ? room.player2 : room.player1;
        userWins[winner]++;
        userLosses[loser]++;
        userTotalWinnings[winner] += winnerPayout;
        
        usdc.safeTransfer(winner, winnerPayout);
        usdc.safeTransfer(treasury, fee);
        
        emit RoomResolved(roomId, winner, winnerPayout, fee, 0);
    }
    
    function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.status == RoomStatus.Filled, "Room not filled");
        require(!usedNonces[nonce], "Nonce already used");
        
        bytes32 messageHash = keccak256(abi.encodePacked(roomId, address(0), nonce));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        require(ethSignedHash.recover(signature) == oracle, "Invalid oracle signature");
        
        usedNonces[nonce] = true;
        
        room.status = RoomStatus.Draw;
        room.winner = address(0);
        room.resolvedAt = block.timestamp;
        
        usdc.safeTransfer(room.player1, room.stake);
        usdc.safeTransfer(room.player2, room.stake);
        
        emit RoomDraw(roomId, room.player1, room.player2, room.stake);
    }
    
    function getTierStake(uint8 tier) public view returns (uint256) {
        if (tier == 0) return bronzeStake;
        if (tier == 1) return silverStake;
        if (tier == 2) return goldStake;
        if (tier == 3) return diamondStake;
        revert("Invalid tier");
    }
    
    function getUserRooms(address user) external view returns (bytes32[] memory) {
        return userRooms[user];
    }
    
    function getUserStats(address user) external view returns (uint256 wins, uint256 losses, uint256 totalWinnings, uint256 roomCount) {
        return (userWins[user], userLosses[user], userTotalWinnings[user], userRooms[user].length);
    }

    // ═══════════════════════════════════════════════════════════════
    // NEW FUNCTIONS (V1.1 additions)
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice Cancel an Open room (creator only)
     * @dev NEW in V1.1 - allows room creator to cancel unfilled rooms
     */
    function cancelRoom(bytes32 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Open, "Room not open");
        require(room.player1 == msg.sender, "Not room creator");
        
        room.status = RoomStatus.Cancelled;
        room.resolvedAt = block.timestamp;
        
        usdc.safeTransfer(msg.sender, room.stake);
        
        emit RoomCancelled(roomId, msg.sender, room.stake);
    }
    
    /**
     * @notice Emergency refund for Open room (Owner only)
     * @dev NEW in V1.1 - Owner can refund stuck Open rooms
     */
    function emergencyWithdrawOpen(bytes32 roomId) external onlyOwner {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Open, "Room not open");
        
        room.status = RoomStatus.Cancelled;
        room.resolvedAt = block.timestamp;
        
        usdc.safeTransfer(room.player1, room.stake);
        
        emit EmergencyWithdraw(roomId, room.stake);
    }
    
    /**
     * @notice Emergency refund for Filled room (Owner only)
     * @dev NEW in V1.1 - Owner can refund stuck Filled rooms (both players)
     */
    function emergencyWithdrawFilled(bytes32 roomId) external onlyOwner {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Filled, "Room not filled");
        
        room.status = RoomStatus.Cancelled;
        room.resolvedAt = block.timestamp;
        
        usdc.safeTransfer(room.player1, room.stake);
        usdc.safeTransfer(room.player2, room.stake);
        
        emit EmergencyWithdraw(roomId, room.stake * 2);
    }
    
    /**
     * @notice Emergency withdraw ALL USDC to treasury (Owner only)
     * @dev NEW in V1.1 - Last resort emergency extraction
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");
        
        usdc.safeTransfer(treasury, balance);
        
        emit EmergencyWithdraw(bytes32(0), balance);
    }
    
    /**
     * @notice Get all room IDs
     */
    function getAllRoomIds() external view returns (bytes32[] memory) {
        return allRoomIds;
    }
    
    /**
     * @notice Get contract USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    // Admin functions
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = _oracle;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
