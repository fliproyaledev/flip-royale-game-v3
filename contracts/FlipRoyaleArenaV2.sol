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
 * @title FlipRoyaleArena V2
 * @author Flip Royale Team
 * @notice Production-ready PvP Arena for USDC stakes
 * @dev Complete rewrite with:
 *      - cancelRoom: Creators can cancel unfilled rooms
 *      - getOpenRoomsByMode: GameMode-based room listing  
 *      - emergencyWithdraw: Owner can refund stuck rooms
 *      - withdrawToTreasury: Emergency fund extraction
 * 
 * Game Modes:
 *   0 = Flip Duel (FDV-based card game)
 *   1 = Flip Flop (Front/Back prediction)
 * 
 * Tiers: Bronze($10), Silver($25), Gold($50), Diamond($100)
 * Fees: Winner 90%, Treasury 10%
 */
contract FlipRoyaleArenaV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS & IMMUTABLES
    // ═══════════════════════════════════════════════════════════════
    
    IERC20 public immutable usdc;
    
    uint256 public constant WINNER_RATE = 900;     // 90%
    uint256 public constant FEE_RATE = 100;        // 10%
    uint256 public constant RATE_DENOMINATOR = 1000;
    
    // Tier stakes (USDC 6 decimals)
    uint256 public constant BRONZE_STAKE  = 10 * 1e6;   // $10
    uint256 public constant SILVER_STAKE  = 25 * 1e6;   // $25
    uint256 public constant GOLD_STAKE    = 50 * 1e6;   // $50
    uint256 public constant DIAMOND_STAKE = 100 * 1e6;  // $100
    
    // Room expiry (users can cancel after this time)
    uint256 public constant ROOM_EXPIRY = 24 hours;

    // ═══════════════════════════════════════════════════════════════
    // ENUMS & STRUCTS
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
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    address public treasury;
    address public oracle;
    
    // Room storage
    mapping(bytes32 => Room) public rooms;
    bytes32[] public allRoomIds;
    
    // Open rooms indexed by gameMode for fast listing
    mapping(uint8 => bytes32[]) private openRoomsByMode;
    mapping(bytes32 => uint256) private openRoomIndex;
    
    // User tracking
    mapping(address => bytes32[]) public userRooms;
    mapping(address => uint256) public userWins;
    mapping(address => uint256) public userLosses;
    mapping(address => uint256) public userTotalWinnings;
    
    // Nonces for signature replay protection
    mapping(bytes32 => bool) public usedNonces;
    
    // Stats
    uint256 public totalRooms;
    uint256 public totalVolume;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    
    event RoomCreated(bytes32 indexed roomId, address indexed player1, uint8 tier, GameMode gameMode, uint256 stake);
    event RoomJoined(bytes32 indexed roomId, address indexed player2);
    event RoomResolved(bytes32 indexed roomId, address indexed winner, uint256 payout);
    event RoomDraw(bytes32 indexed roomId);
    event RoomCancelled(bytes32 indexed roomId, address indexed player, uint256 refund);
    event EmergencyWithdraw(bytes32 indexed roomId, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════
    
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════
    
    constructor(address _usdc, address _treasury, address _oracle) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        require(_oracle != address(0), "Invalid oracle");
        
        usdc = IERC20(_usdc);
        treasury = _treasury;
        oracle = _oracle;
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE GAME FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice Create a new room and deposit stake
     * @param tier 0=Bronze, 1=Silver, 2=Gold, 3=Diamond
     * @param gameMode 0=Duel, 1=Taso
     * @return roomId The created room ID
     */
    function createRoom(uint8 tier, GameMode gameMode) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bytes32 roomId) 
    {
        require(tier <= 3, "Invalid tier");
        
        uint256 stake = getStakeForTier(tier);
        require(usdc.balanceOf(msg.sender) >= stake, "Insufficient USDC");
        require(usdc.allowance(msg.sender, address(this)) >= stake, "Approve USDC first");
        
        // Generate unique room ID
        roomId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            allRoomIds.length
        ));
        
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
        
        // Index room
        allRoomIds.push(roomId);
        userRooms[msg.sender].push(roomId);
        totalRooms++;
        
        // Add to open rooms for fast lookup
        uint8 gameModeIndex = uint8(gameMode);
        openRoomIndex[roomId] = openRoomsByMode[gameModeIndex].length;
        openRoomsByMode[gameModeIndex].push(roomId);
        
        // Transfer USDC
        usdc.safeTransferFrom(msg.sender, address(this), stake);
        
        emit RoomCreated(roomId, msg.sender, tier, gameMode, stake);
    }
    
    /**
     * @notice Join an open room
     * @param roomId The room to join
     */
    function joinRoom(bytes32 roomId) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Open, "Room not open");
        require(room.player1 != msg.sender, "Cannot join own room");
        require(usdc.allowance(msg.sender, address(this)) >= room.stake, "Approve USDC first");
        
        // Transfer USDC
        usdc.safeTransferFrom(msg.sender, address(this), room.stake);
        
        // Update room
        room.player2 = msg.sender;
        room.status = RoomStatus.Filled;
        
        // Track user
        userRooms[msg.sender].push(roomId);
        totalVolume += room.stake * 2;
        
        // Remove from open rooms
        _removeFromOpenRooms(roomId, uint8(room.gameMode));
        
        emit RoomJoined(roomId, msg.sender);
    }
    
    /**
     * @notice Cancel an unfilled room (creator only)
     * @dev Can cancel anytime if room is still open
     */
    function cancelRoom(bytes32 roomId) 
        external 
        nonReentrant 
    {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Open, "Room not open");
        require(room.player1 == msg.sender, "Not room creator");
        
        // Update status
        room.status = RoomStatus.Cancelled;
        room.resolvedAt = block.timestamp;
        
        // Remove from open rooms
        _removeFromOpenRooms(roomId, uint8(room.gameMode));
        
        // Refund USDC
        usdc.safeTransfer(msg.sender, room.stake);
        
        emit RoomCancelled(roomId, msg.sender, room.stake);
    }
    
    /**
     * @notice Resolve room with winner (Oracle only, with signature)
     */
    function resolveRoom(
        bytes32 roomId, 
        address winner, 
        bytes32 nonce,
        bytes calldata signature
    ) 
        external 
        nonReentrant 
    {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Filled, "Room not filled");
        require(!usedNonces[nonce], "Nonce already used");
        require(winner == room.player1 || winner == room.player2, "Invalid winner");
        
        // Verify oracle signature
        bytes32 messageHash = keccak256(abi.encodePacked(roomId, winner, nonce));
        bytes32 ethHash = messageHash.toEthSignedMessageHash();
        require(ethHash.recover(signature) == oracle, "Invalid oracle signature");
        
        usedNonces[nonce] = true;
        
        // Calculate payouts
        uint256 pot = room.stake * 2;
        uint256 winnerPayout = (pot * WINNER_RATE) / RATE_DENOMINATOR;
        uint256 fee = pot - winnerPayout;
        
        // Update room
        room.status = RoomStatus.Resolved;
        room.winner = winner;
        room.resolvedAt = block.timestamp;
        
        // Update stats
        address loser = winner == room.player1 ? room.player2 : room.player1;
        userWins[winner]++;
        userLosses[loser]++;
        userTotalWinnings[winner] += winnerPayout;
        
        // Transfer payouts
        usdc.safeTransfer(winner, winnerPayout);
        usdc.safeTransfer(treasury, fee);
        
        emit RoomResolved(roomId, winner, winnerPayout);
    }
    
    /**
     * @notice Resolve room as draw - refund both players (Oracle only)
     */
    function resolveRoomDraw(
        bytes32 roomId,
        bytes32 nonce,
        bytes calldata signature
    ) 
        external 
        nonReentrant 
    {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Filled, "Room not filled");
        require(!usedNonces[nonce], "Nonce already used");
        
        // Verify oracle signature
        bytes32 messageHash = keccak256(abi.encodePacked(roomId, "DRAW", nonce));
        bytes32 ethHash = messageHash.toEthSignedMessageHash();
        require(ethHash.recover(signature) == oracle, "Invalid oracle signature");
        
        usedNonces[nonce] = true;
        
        // Update room
        room.status = RoomStatus.Draw;
        room.resolvedAt = block.timestamp;
        
        // Refund both players
        usdc.safeTransfer(room.player1, room.stake);
        usdc.safeTransfer(room.player2, room.stake);
        
        emit RoomDraw(roomId);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice Get all open rooms for a game mode
     * @param gameMode 0=Duel, 1=Taso
     */
    function getOpenRoomsByMode(uint8 gameMode) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return openRoomsByMode[gameMode];
    }
    
    /**
     * @notice Get open rooms filtered by mode and tier
     */
    function getOpenRooms(uint8 gameMode, uint8 tier) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        bytes32[] memory modeRooms = openRoomsByMode[gameMode];
        
        // Count matching
        uint256 count = 0;
        for (uint256 i = 0; i < modeRooms.length; i++) {
            if (rooms[modeRooms[i]].tier == tier) {
                count++;
            }
        }
        
        // Build result
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < modeRooms.length; i++) {
            if (rooms[modeRooms[i]].tier == tier) {
                result[idx++] = modeRooms[i];
            }
        }
        
        return result;
    }
    
    /**
     * @notice Get total open room count for a game mode
     */
    function getOpenRoomCount(uint8 gameMode) external view returns (uint256) {
        return openRoomsByMode[gameMode].length;
    }
    
    function getUserRooms(address user) external view returns (bytes32[] memory) {
        return userRooms[user];
    }
    
    function getUserStats(address user) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 totalWinnings,
        uint256 roomCount
    ) {
        return (userWins[user], userLosses[user], userTotalWinnings[user], userRooms[user].length);
    }
    
    function getStakeForTier(uint8 tier) public pure returns (uint256) {
        if (tier == 0) return BRONZE_STAKE;
        if (tier == 1) return SILVER_STAKE;
        if (tier == 2) return GOLD_STAKE;
        if (tier == 3) return DIAMOND_STAKE;
        revert("Invalid tier");
    }
    
    function getAllRoomIds() external view returns (bytes32[] memory) {
        return allRoomIds;
    }
    
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * @notice Emergency refund for a specific stuck room
     * @dev Only owner can call. Refunds all players and cancels room.
     */
    function emergencyWithdrawRoom(bytes32 roomId) external onlyOwner {
        Room storage room = rooms[roomId];
        require(room.id != bytes32(0), "Room not found");
        require(room.status == RoomStatus.Open || room.status == RoomStatus.Filled, "Already resolved");
        
        uint256 totalRefund = room.stake;
        if (room.player2 != address(0)) {
            totalRefund += room.stake;
        }
        
        room.status = RoomStatus.Cancelled;
        room.resolvedAt = block.timestamp;
        
        // Remove from open rooms if still open
        if (room.player2 == address(0)) {
            _removeFromOpenRooms(roomId, uint8(room.gameMode));
        }
        
        // Refund players
        usdc.safeTransfer(room.player1, room.stake);
        if (room.player2 != address(0)) {
            usdc.safeTransfer(room.player2, room.stake);
        }
        
        emit EmergencyWithdraw(roomId, totalRefund);
    }
    
    /**
     * @notice Emergency withdraw ALL contract funds to treasury
     * @dev ONLY USE IN CRITICAL EMERGENCY. This will break all pending games!
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance");
        
        usdc.safeTransfer(treasury, balance);
        
        emit EmergencyWithdraw(bytes32(0), balance);
    }
    
    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }
    
    /**
     * @notice Update oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        address old = oracle;
        oracle = _oracle;
        emit OracleUpdated(old, _oracle);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    function _removeFromOpenRooms(bytes32 roomId, uint8 gameMode) internal {
        uint256 index = openRoomIndex[roomId];
        uint256 lastIndex = openRoomsByMode[gameMode].length - 1;
        
        if (index != lastIndex) {
            bytes32 lastRoomId = openRoomsByMode[gameMode][lastIndex];
            openRoomsByMode[gameMode][index] = lastRoomId;
            openRoomIndex[lastRoomId] = index;
        }
        
        openRoomsByMode[gameMode].pop();
        delete openRoomIndex[roomId];
    }
}
