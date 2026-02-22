// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeRouter
 * @notice Routes fees to influencers based on attribution data provided by ReplyCorp
 * @dev Client deploys contract as owner, ReplyCorp has delegated permissions to update attribution
 * @dev ERC20 only - no native token support
 * 
 * @dev BEST-EFFORT PAYOUT ENGINE:
 * This contract implements a best-effort distribution model. Transfers MAY fail silently
 * and be converted to dust. The contract does NOT guarantee delivery to all recipients.
 * Failed transfers, rounding remainders, and skipped batches all accumulate as dust
 * that can be withdrawn by the owner.
 * 
 * @dev DUST OWNERSHIP POLICY:
 * All dust (rounding remainders, failed transfers, skipped batches, unreachable recipients)
 * belongs permanently to the contract owner. This is an irreversible on-chain policy.
 * ReplyCorp and influencers have no claim on undelivered funds. The owner is expected
 * to handle dust according to their own business policies off-chain.
 * 
 * @dev BOUNDED-LIFETIME USE:
 * This contract is intended for bounded-lifetime use (e.g. per campaign, per client, or per epoch).
 * It permanently stores attribution data, batch completion flags, and per-conversion accounting.
 * It is NOT designed for unbounded conversion counts. Deploy a new contract instance for
 * new campaigns/clients/epochs to avoid unbounded storage growth.
 */
contract FeeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Contract version for compatibility tracking
    uint256 public constant VERSION = 1;

    /// @notice Contract owner (client who deployed)
    address public owner;

    /// @notice ReplyCorp address authorized to update attribution
    address public attributionUpdater;

    /// @notice Authorized wallet that can call distributeFees
    address public distributionSigner;

    /// @notice ERC20 token address for fee distribution (immutable)
    address public immutable tokenAddress;

    /// @notice ReplyCorp wallet address to receive fees
    address public replyCorpWallet;

    /// @notice Total dust accumulated from rounding remainders
    uint256 public accumulatedDust;

    /// @notice Total reserved balance across all active conversions (for efficient rescueTokens calculation)
    uint256 public totalReservedBalance;

    /// @notice Track route version/nonce per conversion (incremented on each updateAttribution)
    mapping(bytes32 => uint256) public routeVersion;

    /// @notice Track completed batches per conversion and version (conversionId => version => batchIndex => completed)
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => bool))) public batchCompleted;

    /**
     * @notice Internal helper to increase total reserved balance
     * @dev All mutations to totalReservedBalance must go through these helpers to prevent desync
     */
    function _increaseReserved(uint256 amount) internal {
        totalReservedBalance += amount;
    }

    /**
     * @notice Internal helper to decrease total reserved balance
     * @dev All mutations to totalReservedBalance must go through these helpers to prevent desync
     */
    function _decreaseReserved(uint256 amount) internal {
        totalReservedBalance -= amount;
    }

    /// @notice Distribution data structure
    struct Distribution {
        address wallet;
        uint256 attributionWeightBps; // Attribution weight in basis points (10000 = 100%)
        // Note: Weights calculated from totalVolume, but amounts distributed from commission
    }

    /// @notice Attribution data stored per conversion
    struct AttributionData {
        Distribution[] distributions; // Array of wallet + attribution weight
        uint256 commission;            // Total commission for influencers
        uint256 replyCorpFee;         // Fee for ReplyCorp
        uint256 totalAmount;           // commission + replyCorpFee
        uint256 theoreticalTotalPayouts; // Sum of all theoretical payouts (for dust calculation)
        uint256 reservedBalance;       // Reserved balance for this conversion (prevents rescue during distribution)
        bytes32 attributionHash;      // Hash of attribution data for verification
        bool distributed;              // Whether fees have been distributed
        bool distributionStarted;      // Whether distribution has started (tokens pulled)
        uint256 paidSoFar;             // Total successfully paid across all batches
        uint256 failedSoFar;           // Total failed transfers across all batches
    }

    /// @notice Mapping from conversionId to attribution data
    mapping(bytes32 => AttributionData) private attributions;

    /// @notice Events
    /// @dev Using parallel arrays instead of struct arrays for better tooling compatibility
    event AttributionUpdated(
        bytes32 indexed conversionId,
        address[] wallets,
        uint256[] attributionWeightBps,
        uint256 commission,
        uint256 replyCorpFee,
        bytes32 attributionHash,
        uint256[] computedAmounts
    );

    event FeesDistributed(
        bytes32 indexed conversionId,
        uint256 totalAmount,
        uint256 dustAmount // Total dust attributable to this conversion (failed transfers + rounding + skipped batches)
    );

    event DustWithdrawn(address indexed owner, uint256 amount);

    event TokensRescued(address indexed owner, uint256 amount);

    event DistributionStarted(
        bytes32 indexed conversionId,
        uint256 totalAmount,
        uint256 commission,
        uint256 replyCorpFee
    );

    event BatchDistributed(
        bytes32 indexed conversionId,
        uint256 batchIndex,
        uint256 recipientsProcessed,
        uint256 failedCount,
        uint256 failedAmount,
        bool hasMoreBatches
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AttributionUpdaterUpdated(address indexed previousUpdater, address indexed newUpdater);
    event DistributionSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event ReplyCorpWalletUpdated(address indexed previousWallet, address indexed newWallet);

    /// @notice Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "FeeRouter: caller is not the owner");
        _;
    }

    modifier onlyAttributionUpdater() {
        require(msg.sender == attributionUpdater, "FeeRouter: caller is not the attribution updater");
        _;
    }

    modifier onlyDistributionSigner() {
        require(msg.sender == distributionSigner, "FeeRouter: caller is not the distribution signer");
        _;
    }

    /**
     * @notice Constructor
     * @param _tokenAddress ERC20 token address for fee distribution (immutable)
     * @param _replyCorpWallet ReplyCorp wallet address to receive fees
     */
    constructor(address _tokenAddress, address _replyCorpWallet) {
        require(_tokenAddress != address(0), "FeeRouter: token address cannot be zero");
        require(_replyCorpWallet != address(0), "FeeRouter: ReplyCorp wallet cannot be zero");
        
        owner = msg.sender;
        tokenAddress = _tokenAddress;
        replyCorpWallet = _replyCorpWallet;
    }

    /**
     * @notice Set attribution updater address (only owner)
     * @param newUpdater New attribution updater address
     */
    function setAttributionUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "FeeRouter: attribution updater cannot be zero");
        address previousUpdater = attributionUpdater;
        attributionUpdater = newUpdater;
        emit AttributionUpdaterUpdated(previousUpdater, newUpdater);
    }

    /**
     * @notice Set distribution signer address (only owner)
     * @param newSigner New distribution signer address
     */
    function setDistributionSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "FeeRouter: distribution signer cannot be zero");
        require(newSigner != tokenAddress, "FeeRouter: distribution signer cannot be token contract");
        require(newSigner != address(this), "FeeRouter: distribution signer cannot be this contract");
        address previousSigner = distributionSigner;
        distributionSigner = newSigner;
        emit DistributionSignerUpdated(previousSigner, newSigner);
    }

    /**
     * @notice Set ReplyCorp wallet address (only owner)
     * @param newWallet New ReplyCorp wallet address
     */
    function setReplyCorpWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "FeeRouter: ReplyCorp wallet cannot be zero");
        require(newWallet != tokenAddress, "FeeRouter: ReplyCorp wallet cannot be token contract");
        require(newWallet != address(this), "FeeRouter: ReplyCorp wallet cannot be this contract");
        address previousWallet = replyCorpWallet;
        replyCorpWallet = newWallet;
        emit ReplyCorpWalletUpdated(previousWallet, newWallet);
    }

    /**
     * @notice Transfer ownership (only owner)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FeeRouter: new owner cannot be zero");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /**
     * @notice Update attribution data (only attribution updater)
     * @param conversionId Conversion ID (bytes32 hash)
     * @param distributions Array of distribution data (wallet + attribution weight)
     * @param commission Total commission for influencers (must be > 0)
     * @param replyCorpFee Fee for ReplyCorp (can be zero)
     * @dev Wallets must be provided in deterministic order (ascending address) for consistent hash computation
     * @dev Distribution signer must be set before attribution updates (enforced below)
     */
    function updateAttribution(
        bytes32 conversionId,
        Distribution[] calldata distributions,
        uint256 commission,
        uint256 replyCorpFee
    ) external onlyAttributionUpdater {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        require(distributionSigner != address(0), "FeeRouter: distribution signer not set");
        require(distributions.length > 0, "FeeRouter: distributions array cannot be empty");
        require(commission > 0, "FeeRouter: commission must be greater than zero");
        require(commission <= type(uint256).max / 10000, "FeeRouter: commission too large (overflow risk)");
        require(replyCorpFee <= type(uint256).max - commission, "FeeRouter: totalAmount overflow");

        // Validate attribution weights sum to 100% (10000 basis points)
        // Enforce strictly increasing wallet addresses (ensures deterministic ordering and prevents duplicates)
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < distributions.length; i++) {
            address wallet = distributions[i].wallet;
            require(wallet != address(0), "FeeRouter: wallet address cannot be zero");
            require(wallet != tokenAddress, "FeeRouter: wallet cannot be token contract");
            require(wallet != address(this), "FeeRouter: wallet cannot be this contract");
            
            // Enforce strictly increasing order (prevents duplicates and ensures deterministic hash)
            if (i > 0) {
                require(distributions[i-1].wallet < wallet, "FeeRouter: wallets must be sorted in ascending order");
            }
            
            totalWeight += distributions[i].attributionWeightBps;
        }
        require(totalWeight == 10000, "FeeRouter: attribution weights must sum to 10000 (100%)");

        // Build parallel arrays for hash computation and event emission
        // IMPORTANT: Wallets must be in deterministic order (ascending address) for consistent hash computation
        // Off-chain system (ReplyCorp) must sort wallets ascending before calling this function
        address[] memory wallets = new address[](distributions.length);
        uint256[] memory weightsBps = new uint256[](distributions.length);
        uint256[] memory computedAmounts = new uint256[](distributions.length);
        
        for (uint256 i = 0; i < distributions.length; i++) {
            wallets[i] = distributions[i].wallet;
            weightsBps[i] = distributions[i].attributionWeightBps;
            // Floor division: commission * weight / 10000
            computedAmounts[i] = (commission * distributions[i].attributionWeightBps) / 10000;
        }

        // Compute attribution hash using parallel arrays (more robust across languages)
        // Hash is order-dependent: same wallets in different order = different hash
        // Off-chain system must use deterministic ordering (ascending wallet addresses)
        bytes32 attributionHash = keccak256(
            abi.encode(conversionId, wallets, weightsBps, commission, replyCorpFee)
        );

        // Store attribution data
        AttributionData storage data = attributions[conversionId];
        require(!data.distributed, "FeeRouter: attribution already distributed");
        require(!data.distributionStarted, "FeeRouter: cannot update attribution after distribution started");
        
        // Defensive: ensure no stale reserved balance exists
        // This should never happen due to require(!data.distributionStarted), but we enforce it explicitly
        // to prevent accounting errors if the invariant is ever violated
        require(data.reservedBalance == 0, "FeeRouter: stale reserved balance");

        // Increment route version to invalidate old batch completion tracking
        routeVersion[conversionId]++;

        // Clear existing distributions array
        delete data.distributions;

        // Store new distributions and calculate theoretical total payouts
        uint256 theoreticalTotal = 0;
        for (uint256 i = 0; i < distributions.length; i++) {
            data.distributions.push(distributions[i]);
            theoreticalTotal += computedAmounts[i];
        }

        data.commission = commission;
        data.replyCorpFee = replyCorpFee;
        data.totalAmount = commission + replyCorpFee;
        data.theoreticalTotalPayouts = theoreticalTotal;
        
        // Invariant: theoretical payouts cannot exceed commission (floor division ensures this)
        require(theoreticalTotal <= commission, "FeeRouter: theoretical payouts exceed commission");
        
        data.reservedBalance = 0; // Explicitly reset (redundant but clear)
        data.attributionHash = attributionHash;
        data.distributed = false;
        data.distributionStarted = false;
        data.paidSoFar = 0;
        data.failedSoFar = 0;

        emit AttributionUpdated(conversionId, wallets, weightsBps, commission, replyCorpFee, attributionHash, computedAmounts);
    }

    /**
     * @notice Start fee distribution (only distribution signer)
     * @param conversionId Conversion ID
     * @param totalAmount Total amount to distribute (must match commission + replyCorpFee)
     * @param expectedHash Expected attribution hash (must match stored hash)
     * @dev Pulls tokens, transfers ReplyCorp fee, marks distribution as started
     * @dev Must be called before processBatch
     * @dev After this call, tokens are held in escrow until batches complete
     */
    function startDistribution(
        bytes32 conversionId,
        uint256 totalAmount,
        bytes32 expectedHash
    ) external nonReentrant onlyDistributionSigner {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        
        AttributionData storage data = attributions[conversionId];
        require(data.distributions.length > 0, "FeeRouter: attribution data not found");
        require(!data.distributed, "FeeRouter: fees already distributed");
        require(!data.distributionStarted, "FeeRouter: distribution already started");
        require(totalAmount == data.totalAmount, "FeeRouter: totalAmount mismatch");
        require(expectedHash == data.attributionHash, "FeeRouter: attribution hash mismatch");

        IERC20 token = IERC20(tokenAddress);

        // Pull tokens from caller (signer wallet)
        token.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Reserve the full amount for this conversion (will be released as batches complete)
        data.reservedBalance = totalAmount;
        _increaseReserved(totalAmount);
        
        // Transfer ReplyCorp fee
        if (data.replyCorpFee > 0) {
            token.safeTransfer(replyCorpWallet, data.replyCorpFee);
            data.reservedBalance -= data.replyCorpFee; // ReplyCorp fee is no longer reserved
            _decreaseReserved(data.replyCorpFee);
        }
        
        data.distributionStarted = true;
        
        // Invariant check: reservedBalance should equal commission after start
        require(data.reservedBalance == data.commission, "FeeRouter: reservedBalance invariant violation");
        
        // Invariant check: totalReservedBalance should be >= per-conversion reservedBalance
        // This ensures the global counter stays in sync with per-conversion balances
        require(totalReservedBalance >= data.reservedBalance, "FeeRouter: totalReservedBalance desync");
        
        emit DistributionStarted(conversionId, totalAmount, data.commission, data.replyCorpFee);
    }

    /**
     * @notice Process a batch of fee distributions (only distribution signer)
     * @param conversionId Conversion ID
     * @param batchIndex Batch index (0-indexed, processes up to 200 recipients per batch)
     * @dev For conversions with >200 recipients, call multiple times with increasing batchIndex
     * @dev Failed transfers are skipped and accumulated as dust (best-effort distribution)
     * 
     * @dev BATCH SKIPPING BEHAVIOR (intentional design):
     *      - Batches can be processed in ANY order (batch 3 before batch 0 is allowed)
     *      - Batches can be SKIPPED entirely (not all batches must be processed)
     *      - When the LAST batch index completes, distribution is finalized
     *      - Any skipped batches result in those funds remaining in the contract as dust
     *      - This is a BEST-EFFORT distribution model, not guaranteed delivery
     *      - Off-chain operators should track batch completion to ensure all batches are processed
     */
    // slither-disable-start reentrancy-no-eth,reentrancy-benign,calls-loop,low-level-calls
    // Protected by nonReentrant modifier - reentrancy is not possible
    // Intentional design: batch processing requires loops, bounded to 200 recipients per batch
    // Low-level call needed to handle non-standard ERC20 tokens that don&#39;t return bool
    function processBatch(
        bytes32 conversionId,
        uint256 batchIndex
    ) external nonReentrant onlyDistributionSigner {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        
        AttributionData storage data = attributions[conversionId];
        require(data.distributions.length > 0, "FeeRouter: attribution data not found");
        require(data.distributionStarted, "FeeRouter: distribution not started");
        require(!data.distributed, "FeeRouter: fees already distributed");
        
        uint256 currentVersion = routeVersion[conversionId];
        require(!batchCompleted[conversionId][currentVersion][batchIndex], "FeeRouter: batch already completed");

        IERC20 token = IERC20(tokenAddress);

        // Calculate batch boundaries (up to 200 recipients per batch)
        uint256 startIndex = batchIndex * 200;
        require(startIndex < data.distributions.length, "FeeRouter: batch index out of range");
        
        uint256 endIndex = startIndex + 200;
        if (endIndex > data.distributions.length) {
            endIndex = data.distributions.length;
        }

        // Process batch with best-effort transfers (skip failures using low-level call)
        uint256 batchPayouts = 0;
        uint256 failedCount = 0;
        uint256 failedAmount = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 payout = (data.commission * data.distributions[i].attributionWeightBps) / 10000;
            
            if (payout > 0) {
                // Best-effort transfer: use low-level call to catch reverts
                // This handles both standard ERC20 (returns bool) and non-standard (no return) tokens
                (bool success, bytes memory returnData) = address(token).call(
                    abi.encodeWithSelector(IERC20.transfer.selector, data.distributions[i].wallet, payout)
                );
                
                // Success if: call succeeded AND (no return data OR decoded bool == true)
                bool transferSuccess = success && (returnData.length == 0 || abi.decode(returnData, (bool)));
                
                if (transferSuccess) {
                    batchPayouts += payout;
                } else {
                    failedCount++;
                    failedAmount += payout;
                }
            }
        }

        // Update per-conversion totals
        data.paidSoFar += batchPayouts;
        data.failedSoFar += failedAmount;

        // Release reserved balance for successfully paid amounts
        data.reservedBalance -= batchPayouts;
        _decreaseReserved(batchPayouts);
        
        // Release failed amounts from reserved balance immediately and accumulate as dust
        // Failed transfers stay in contract but are no longer "reserved" for distribution
        // This makes reservedBalance accounting monotonic and easier to reason about
        if (failedAmount > 0) {
            data.reservedBalance -= failedAmount;
            _decreaseReserved(failedAmount);
            accumulatedDust += failedAmount;
        }

        // Mark batch as completed (using current version)
        batchCompleted[conversionId][currentVersion][batchIndex] = true;

        // Check if this is the last batch index
        bool hasMoreBatches = endIndex < data.distributions.length;

        emit BatchDistributed(
            conversionId,
            batchIndex,
            endIndex - startIndex,
            failedCount,
            failedAmount,
            hasMoreBatches
        );
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign,calls-loop,low-level-calls

    /**
     * @notice Finalize distribution for a conversion (only distribution signer)
     * @param conversionId Conversion ID
     * @dev Converts any unpaid amounts (from skipped batches) to dust and closes distribution
     * @dev Must be called explicitly - distribution does not auto-finalize
     * @dev Can be called multiple times safely (idempotent)
     * @dev WARNING: Can be called even if zero batches were processed, converting entire commission to dust.
     *      The distribution signer has significant responsibility - ensure batches are processed before finalizing.
     */
    function finalizeDistribution(bytes32 conversionId) external nonReentrant onlyDistributionSigner {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        
        AttributionData storage data = attributions[conversionId];
        require(data.distributionStarted, "FeeRouter: distribution not started");
        require(!data.distributed, "FeeRouter: distribution already finalized");
        
        // Calculate unpaid amounts from skipped batches and rounding dust
        // Remaining reserved balance = commission - paidSoFar - failedSoFar
        // This includes rounding dust plus any amounts from skipped batches
        uint256 remainingReserved = data.reservedBalance;
        
        // Convert remaining reserved balance to dust (includes rounding dust + skipped batch amounts)
        if (remainingReserved > 0) {
            accumulatedDust += remainingReserved;
            _decreaseReserved(remainingReserved);
            data.reservedBalance = 0;
        }
        
        // Invariant check: reservedBalance should be zero after finalization
        require(data.reservedBalance == 0, "FeeRouter: reservedBalance should be zero after finalization");
        
        // Invariant check: totalReservedBalance should be >= per-conversion reservedBalance (should be 0 now)
        // This ensures the global counter stays in sync with per-conversion balances
        require(totalReservedBalance >= data.reservedBalance, "FeeRouter: totalReservedBalance desync");
        
        // Additional invariant: contract balance should be at least accumulated dust
        // (accounting for dust from this conversion and any previous conversions)
        IERC20 token = IERC20(tokenAddress);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= accumulatedDust, "FeeRouter: contract balance invariant violation");
        
        data.distributed = true;
        
        // Emit event with total dust (failed transfers + rounding + skipped batches)
        // Note: failedSoFar was already added to accumulatedDust during batch processing,
        // but we include it in the event for accurate reporting of total dust for this conversion
        emit FeesDistributed(conversionId, data.totalAmount, remainingReserved + data.failedSoFar);
    }

    /**
     * @notice Withdraw accumulated dust (only owner)
     * @param amount Amount to withdraw (must be <= accumulatedDust)
     */
    function withdrawDust(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "FeeRouter: amount must be greater than zero");
        require(amount <= accumulatedDust, "FeeRouter: insufficient dust");

        accumulatedDust -= amount;

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(owner, amount);

        emit DustWithdrawn(owner, amount);
    }

    /**
     * @notice Rescue accidentally sent tokens (only owner)
     * @param amount Amount to rescue (must be <= rescuable balance)
     * @dev Can only rescue tokens that exceed accumulated dust and all reserved balances
     * @dev Rescuable = contract balance - accumulated dust - totalReservedBalance
     * @dev Reserved balances protect undistributed funds from being rescued mid-batch
     * @dev NOTE: Dust withdrawal via withdrawDust() reduces contract balance but not totalReservedBalance,
     *      which increases rescuable capacity. This is intentional and allows rescue of excess funds
     *      after dust is withdrawn.
     */
    function rescueTokens(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "FeeRouter: amount must be greater than zero");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 contractBalance = token.balanceOf(address(this));
        uint256 totalReserved = accumulatedDust + totalReservedBalance;
        uint256 rescuable = contractBalance > totalReserved ? contractBalance - totalReserved : 0;
        
        require(amount <= rescuable, "FeeRouter: insufficient rescuable balance");
        
        token.safeTransfer(owner, amount);
        
        emit TokensRescued(owner, amount);
    }

    /**
     * @notice Get distribution route for a conversion
     * @param conversionId Conversion ID
     * @return distributions Array of distributions
     * @return commission Total commission
     * @return replyCorpFee ReplyCorp fee
     * @return totalAmount Total amount
     * @return attributionHash Attribution hash
     * @return distributed Whether fees have been distributed
     * @return distributionStarted Whether distribution has started
     * @return paidSoFar Total successfully paid across all batches
     * @return failedSoFar Total failed transfers across all batches
     */
    function getDistributionRoute(bytes32 conversionId)
        external
        view
        returns (
            Distribution[] memory distributions,
            uint256 commission,
            uint256 replyCorpFee,
            uint256 totalAmount,
            bytes32 attributionHash,
            bool distributed,
            bool distributionStarted,
            uint256 paidSoFar,
            uint256 failedSoFar
        )
    {
        AttributionData storage data = attributions[conversionId];
        return (
            data.distributions,
            data.commission,
            data.replyCorpFee,
            data.totalAmount,
            data.attributionHash,
            data.distributed,
            data.distributionStarted,
            data.paidSoFar,
            data.failedSoFar
        );
    }


    /**
     * @notice Check if a batch has been completed
     * @param conversionId Conversion ID
     * @param batchIndex Batch index to check
     * @return Whether the batch has been completed
     */
    function isBatchCompleted(bytes32 conversionId, uint256 batchIndex) external view returns (bool) {
        uint256 version = routeVersion[conversionId];
        return batchCompleted[conversionId][version][batchIndex];
    }

    /**
     * @notice Get the number of batches required for a conversion
     * @param conversionId Conversion ID
     * @return Number of batches (ceiling of distributions.length / 200)
     */
    function getBatchCount(bytes32 conversionId) external view returns (uint256) {
        AttributionData storage data = attributions[conversionId];
        if (data.distributions.length == 0) {
            return 0;
        }
        return (data.distributions.length + 199) / 200; // Ceiling division
    }
}