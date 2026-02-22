// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeRouter (18 Decimal Patched)
 * @notice Routes fees to influencers based on attribution data provided by ReplyCorp
 * @dev Custom patch to scale ReplyCorp's 4-decimal values to 18-decimal token WEI internally.
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

    function _increaseReserved(uint256 amount) internal {
        totalReservedBalance += amount;
    }

    function _decreaseReserved(uint256 amount) internal {
        totalReservedBalance -= amount;
    }

    struct Distribution {
        address wallet;
        uint256 attributionWeightBps; // Attribution weight in basis points (10000 = 100%)
    }

    struct AttributionData {
        Distribution[] distributions; 
        uint256 commission;            // Total commission for influencers (SCALED to 18 decimals)
        uint256 replyCorpFee;         // Fee for ReplyCorp (SCALED to 18 decimals)
        uint256 totalAmount;           // commission + replyCorpFee (SCALED to 18 decimals)
        uint256 theoreticalTotalPayouts; 
        uint256 reservedBalance;       
        bytes32 attributionHash;      // Hash of attribution data (UNSCALED)
        bool distributed;              
        bool distributionStarted;      
        uint256 paidSoFar;             
        uint256 failedSoFar;           
    }

    mapping(bytes32 => AttributionData) private attributions;

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
        uint256 dustAmount 
    );

    event DustWithdrawn(address indexed owner, uint256 amount);
    event TokensRescued(address indexed owner, uint256 amount);
    event DistributionStarted(bytes32 indexed conversionId, uint256 totalAmount, uint256 commission, uint256 replyCorpFee);
    event BatchDistributed(bytes32 indexed conversionId, uint256 batchIndex, uint256 recipientsProcessed, uint256 failedCount, uint256 failedAmount, bool hasMoreBatches);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AttributionUpdaterUpdated(address indexed previousUpdater, address indexed newUpdater);
    event DistributionSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event ReplyCorpWalletUpdated(address indexed previousWallet, address indexed newWallet);

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

    constructor(address _tokenAddress, address _replyCorpWallet) {
        require(_tokenAddress != address(0), "FeeRouter: token address cannot be zero");
        require(_replyCorpWallet != address(0), "FeeRouter: ReplyCorp wallet cannot be zero");
        
        owner = msg.sender;
        tokenAddress = _tokenAddress;
        replyCorpWallet = _replyCorpWallet;
    }

    function setAttributionUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "FeeRouter: attribution updater cannot be zero");
        address previousUpdater = attributionUpdater;
        attributionUpdater = newUpdater;
        emit AttributionUpdaterUpdated(previousUpdater, newUpdater);
    }

    function setDistributionSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "FeeRouter: distribution signer cannot be zero");
        require(newSigner != tokenAddress, "FeeRouter: distribution signer cannot be token contract");
        require(newSigner != address(this), "FeeRouter: distribution signer cannot be this contract");
        address previousSigner = distributionSigner;
        distributionSigner = newSigner;
        emit DistributionSignerUpdated(previousSigner, newSigner);
    }

    function setReplyCorpWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "FeeRouter: ReplyCorp wallet cannot be zero");
        require(newWallet != tokenAddress, "FeeRouter: ReplyCorp wallet cannot be token contract");
        require(newWallet != address(this), "FeeRouter: ReplyCorp wallet cannot be this contract");
        address previousWallet = replyCorpWallet;
        replyCorpWallet = newWallet;
        emit ReplyCorpWalletUpdated(previousWallet, newWallet);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FeeRouter: new owner cannot be zero");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function updateAttribution(
        bytes32 conversionId,
        Distribution[] calldata distributions,
        uint256 _rawCommission,
        uint256 _rawReplyCorpFee
    ) external onlyAttributionUpdater {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        require(distributionSigner != address(0), "FeeRouter: distribution signer not set");
        require(distributions.length > 0, "FeeRouter: distributions array cannot be empty");
        require(_rawCommission > 0, "FeeRouter: commission must be greater than zero");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < distributions.length; i++) {
            address wallet = distributions[i].wallet;
            require(wallet != address(0), "FeeRouter: wallet address cannot be zero");
            require(wallet != tokenAddress, "FeeRouter: wallet cannot be token contract");
            require(wallet != address(this), "FeeRouter: wallet cannot be this contract");
            
            if (i > 0) {
                require(distributions[i-1].wallet < wallet, "FeeRouter: wallets must be sorted in ascending order");
            }
            totalWeight += distributions[i].attributionWeightBps;
        }
        require(totalWeight == 10000, "FeeRouter: attribution weights must sum to 10000 (100%)");

        address[] memory wallets = new address[](distributions.length);
        uint256[] memory weightsBps = new uint256[](distributions.length);
        uint256[] memory computedAmounts = new uint256[](distributions.length);
        
        // CUSTOM PATCH: Multiply by 10^14 because ReplyCorp backend supplies 4-decimal currency, while VIRTUAL is 18 decimals
        uint256 commission = _rawCommission * 1e14;
        uint256 replyCorpFee = _rawReplyCorpFee * 1e14;

        for (uint256 i = 0; i < distributions.length; i++) {
            wallets[i] = distributions[i].wallet;
            weightsBps[i] = distributions[i].attributionWeightBps;
            computedAmounts[i] = (commission * distributions[i].attributionWeightBps) / 10000;
        }

        // KEEP RAW HASH matching what ReplyCorp sends to the UI API Response
        bytes32 attributionHash = keccak256(
            abi.encode(conversionId, wallets, weightsBps, _rawCommission, _rawReplyCorpFee)
        );

        AttributionData storage data = attributions[conversionId];
        require(!data.distributed, "FeeRouter: attribution already distributed");
        require(!data.distributionStarted, "FeeRouter: cannot update attribution after distribution started");
        require(data.reservedBalance == 0, "FeeRouter: stale reserved balance");

        routeVersion[conversionId]++;
        delete data.distributions;

        uint256 theoreticalTotal = 0;
        for (uint256 i = 0; i < distributions.length; i++) {
            data.distributions.push(distributions[i]);
            theoreticalTotal += computedAmounts[i];
        }

        data.commission = commission;
        data.replyCorpFee = replyCorpFee;
        data.totalAmount = commission + replyCorpFee;
        data.theoreticalTotalPayouts = theoreticalTotal;
        
        require(theoreticalTotal <= commission, "FeeRouter: theoretical payouts exceed commission");
        
        data.reservedBalance = 0; 
        data.attributionHash = attributionHash;
        data.distributed = false;
        data.distributionStarted = false;
        data.paidSoFar = 0;
        data.failedSoFar = 0;

        emit AttributionUpdated(conversionId, wallets, weightsBps, commission, replyCorpFee, attributionHash, computedAmounts);
    }

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

        token.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        data.reservedBalance = totalAmount;
        _increaseReserved(totalAmount);
        
        if (data.replyCorpFee > 0) {
            token.safeTransfer(replyCorpWallet, data.replyCorpFee);
            data.reservedBalance -= data.replyCorpFee; 
            _decreaseReserved(data.replyCorpFee);
        }
        
        data.distributionStarted = true;
        
        require(data.reservedBalance == data.commission, "FeeRouter: reservedBalance invariant violation");
        require(totalReservedBalance >= data.reservedBalance, "FeeRouter: totalReservedBalance desync");
        
        emit DistributionStarted(conversionId, totalAmount, data.commission, data.replyCorpFee);
    }

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

        uint256 startIndex = batchIndex * 200;
        require(startIndex < data.distributions.length, "FeeRouter: batch index out of range");
        
        uint256 endIndex = startIndex + 200;
        if (endIndex > data.distributions.length) {
            endIndex = data.distributions.length;
        }

        uint256 batchPayouts = 0;
        uint256 failedCount = 0;
        uint256 failedAmount = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 payout = (data.commission * data.distributions[i].attributionWeightBps) / 10000;
            
            if (payout > 0) {
                (bool success, bytes memory returnData) = address(token).call(
                    abi.encodeWithSelector(IERC20.transfer.selector, data.distributions[i].wallet, payout)
                );
                
                bool transferSuccess = success && (returnData.length == 0 || abi.decode(returnData, (bool)));
                
                if (transferSuccess) {
                    batchPayouts += payout;
                } else {
                    failedCount++;
                    failedAmount += payout;
                }
            }
        }

        data.paidSoFar += batchPayouts;
        data.failedSoFar += failedAmount;

        data.reservedBalance -= batchPayouts;
        _decreaseReserved(batchPayouts);
        
        if (failedAmount > 0) {
            data.reservedBalance -= failedAmount;
            _decreaseReserved(failedAmount);
            accumulatedDust += failedAmount;
        }

        batchCompleted[conversionId][currentVersion][batchIndex] = true;

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

    function finalizeDistribution(bytes32 conversionId) external nonReentrant onlyDistributionSigner {
        require(conversionId != bytes32(0), "FeeRouter: conversionId cannot be zero");
        
        AttributionData storage data = attributions[conversionId];
        require(data.distributionStarted, "FeeRouter: distribution not started");
        require(!data.distributed, "FeeRouter: distribution already finalized");
        
        uint256 remainingReserved = data.reservedBalance;
        
        if (remainingReserved > 0) {
            accumulatedDust += remainingReserved;
            _decreaseReserved(remainingReserved);
            data.reservedBalance = 0;
        }
        
        require(data.reservedBalance == 0, "FeeRouter: reservedBalance should be zero after finalization");
        require(totalReservedBalance >= data.reservedBalance, "FeeRouter: totalReservedBalance desync");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= accumulatedDust, "FeeRouter: contract balance invariant violation");
        
        data.distributed = true;
        emit FeesDistributed(conversionId, data.totalAmount, remainingReserved + data.failedSoFar);
    }

    function withdrawDust(uint256 amount) external nonReentrant onlyOwner {
        require(amount > 0, "FeeRouter: amount must be greater than zero");
        require(amount <= accumulatedDust, "FeeRouter: insufficient dust");

        accumulatedDust -= amount;

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(owner, amount);

        emit DustWithdrawn(owner, amount);
    }

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

    function isBatchCompleted(bytes32 conversionId, uint256 batchIndex) external view returns (bool) {
        uint256 version = routeVersion[conversionId];
        return batchCompleted[conversionId][version][batchIndex];
    }

    function getBatchCount(bytes32 conversionId) external view returns (uint256) {
        AttributionData storage data = attributions[conversionId];
        if (data.distributions.length == 0) {
            return 0;
        }
        return (data.distributions.length + 199) / 200;
    }
}
