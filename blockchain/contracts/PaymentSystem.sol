// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PaymentSystem - Advanced v2
 * @dev Secure Banking Transaction System with Multi-Sig, Recurring Payments, and Withdrawals
 * @notice Enhanced contract with withdrawal, multi-signature wallet, and recurring payment features
 */
contract PaymentSystem {
    
    // Transaction types
    enum TransactionType { Deposit, Payment, Withdrawal }
    
    // Transaction structure to store payment details
    struct Transaction {
        address sender;
        address receiver;
        uint256 amount;
        uint256 timestamp;
        TransactionType txType;
    }
    
    // Multi-signature transaction proposal
    struct MultiSigTransaction {
        address initiator;
        address receiver;
        uint256 amount;
        uint256 approvalCount;
        bool executed;
        uint256 expiresAt; // NEW: proposal expiry timestamp
        mapping(address => bool) approvals;
    }
    
    // Recurring payment schedule
    struct RecurringPayment {
        address sender;
        address receiver;
        uint256 amount;
        uint256 interval; // in seconds
        uint256 lastExecution;
        bool active;
    }
    
    // Daily transaction limit tracking
    struct DailyLimit {
        uint256 spent;
        uint256 lastReset;
        uint256 limit;
    }
    
    // Array to store all transactions
    Transaction[] private transactions;
    
    // Mapping to track user balances
    mapping(address => uint256) private balances;
    
    // Multi-signature wallet mappings
    mapping(address => address[]) private coSigners; // user => list of co-signers
    mapping(address => uint256) private approvalThreshold; // user => required approvals
    mapping(uint256 => MultiSigTransaction) private multiSigTxs;
    uint256 private multiSigTxCounter;

    // NEW: MultiSig proposal expiry duration (48 hours)
    uint256 public constant MULTISIG_EXPIRY = 48 hours;
    
    // Recurring payments
    mapping(uint256 => RecurringPayment) private recurringPayments;
    uint256 private recurringPaymentCounter;
    mapping(address => uint256[]) private userRecurringPayments;

    // NEW: Maximum recurring payments per user
    uint256 public constant MAX_RECURRING_PAYMENTS = 10;
    
    // ==================== SECURITY & COMPLIANCE ====================
    
    // Contract owner for admin functions
    address private owner;
    
    // KYC verification system
    mapping(address => bool) private kycVerified;
    
    // Daily transaction limits
    mapping(address => DailyLimit) private dailyLimits;
    
    // Emergency pause mechanism
    bool private paused;
    
    // Events for logging
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Payment(address indexed sender, address indexed receiver, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event CoSignerAdded(address indexed user, address indexed coSigner);
    event CoSignerRemoved(address indexed user, address indexed coSigner);
    event MultiSigTxProposed(uint256 indexed txId, address indexed initiator, address indexed receiver, uint256 amount);
    event MultiSigTxApproved(uint256 indexed txId, address indexed approver);
    event MultiSigTxExecuted(uint256 indexed txId);
    event RecurringPaymentScheduled(uint256 indexed scheduleId, address indexed sender, address indexed receiver, uint256 amount, uint256 interval);
    event RecurringPaymentExecuted(uint256 indexed scheduleId);
    event RecurringPaymentCancelled(uint256 indexed scheduleId);
    
    // Security & Compliance events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event UserVerified(address indexed user);
    event VerificationRevoked(address indexed user);
    event DailyLimitSet(address indexed user, uint256 limit);
    event DailyLimitExceeded(address indexed user, uint256 attempted, uint256 remaining); // FIXED: only emitted on actual violation
    event PauseStateChanged(bool paused);
    
    // ==================== MODIFIERS ====================
    
    /**
     * @dev Restricts function access to contract owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Requires user to be KYC verified
     */
    modifier requireKYC() {
        require(kycVerified[msg.sender], "KYC verification required");
        _;
    }
    
    /**
     * @dev Prevents function execution when contract is paused
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    /**
     * @dev Checks and updates daily transaction limit
     * @param amount Amount to check against limit (FIXED: event only emits on violation)
     */
    modifier checkDailyLimit(uint256 amount) {
        DailyLimit storage limit = dailyLimits[msg.sender];
        
        // Reset if 24 hours have passed
        if (block.timestamp >= limit.lastReset + 1 days) {
            limit.spent = 0;
            limit.lastReset = block.timestamp;
        }
        
        // Check if user has set a limit — only revert AND emit if truly exceeded
        if (limit.limit > 0) {
            uint256 remaining = limit.limit > limit.spent ? limit.limit - limit.spent : 0;
            if (limit.spent + amount > limit.limit) {
                emit DailyLimitExceeded(msg.sender, amount, remaining);
                revert("Daily transaction limit exceeded");
            }
        }
        
        _;
        
        // Update spent amount after transaction
        if (limit.limit > 0) {
            limit.spent += amount;
        }
    }
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @dev Sets the contract deployer as the initial owner
     */
    constructor() {
        owner = msg.sender;
        paused = false;
    }
    
    /**
     * @dev Deposit ETH into the contract
     * @notice User sends ETH to this function to deposit into their account
     */
    function deposit() public payable whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than zero");
        
        balances[msg.sender] += msg.value;
        
        // Record deposit as a transaction
        transactions.push(Transaction({
            sender: msg.sender,
            receiver: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            txType: TransactionType.Deposit
        }));
        
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Withdraw ETH from the contract
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) public whenNotPaused checkDailyLimit(amount) {
        require(amount > 0, "Withdrawal amount must be greater than zero");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        
        // Record withdrawal transaction
        transactions.push(Transaction({
            sender: msg.sender,
            receiver: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            txType: TransactionType.Withdrawal
        }));
        
        payable(msg.sender).transfer(amount);
        
        emit Withdrawal(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Send payment to another address
     * @param receiver Address of the recipient
     */
    function sendPayment(address payable receiver) public payable whenNotPaused checkDailyLimit(msg.value) {
        require(msg.value > 0, "Payment amount must be greater than zero");
        require(receiver != address(0), "Invalid receiver address");
        require(receiver != msg.sender, "Cannot send payment to yourself");
        require(balances[msg.sender] >= msg.value, "Insufficient balance");
        
        // Deduct from sender's balance
        balances[msg.sender] -= msg.value;
        
        // Add to receiver's balance
        balances[receiver] += msg.value;
        
        // Record the transaction
        transactions.push(Transaction({
            sender: msg.sender,
            receiver: receiver,
            amount: msg.value,
            timestamp: block.timestamp,
            txType: TransactionType.Payment
        }));
        
        // Transfer the ETH
        receiver.transfer(msg.value);
        
        emit Payment(msg.sender, receiver, msg.value, block.timestamp);
    }
    
    // ==================== MULTI-SIGNATURE WALLET ====================
    
    /**
     * @dev Add a co-signer to your multi-sig wallet
     * @param coSigner Address of the co-signer
     */
    function addCoSigner(address coSigner) public requireKYC {
        require(coSigner != address(0), "Invalid co-signer address");
        require(coSigner != msg.sender, "Cannot add yourself as co-signer");
        
        coSigners[msg.sender].push(coSigner);
        
        // Set default threshold to 2 if this is the first co-signer
        if (approvalThreshold[msg.sender] == 0) {
            approvalThreshold[msg.sender] = 2;
        }
        
        emit CoSignerAdded(msg.sender, coSigner);
    }
    
    /**
     * @dev Remove a co-signer from your multi-sig wallet
     * @param coSigner Address of the co-signer to remove
     */
    function removeCoSigner(address coSigner) public {
        address[] storage signers = coSigners[msg.sender];
        for (uint i = 0; i < signers.length; i++) {
            if (signers[i] == coSigner) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                emit CoSignerRemoved(msg.sender, coSigner);
                break;
            }
        }
    }
    
    /**
     * @dev Set approval threshold for multi-sig transactions
     * @param threshold Number of approvals required
     */
    function setApprovalThreshold(uint256 threshold) public {
        require(threshold > 0, "Threshold must be greater than zero");
        require(threshold <= coSigners[msg.sender].length + 1, "Threshold too high");
        approvalThreshold[msg.sender] = threshold;
    }
    
    /**
     * @dev Propose a multi-sig transaction (expires in 48 hours)
     * @param receiver Address of the recipient
     * @param amount Amount to send
     * @return Transaction ID
     */
    function proposeMultiSigTransaction(address receiver, uint256 amount) public requireKYC returns (uint256) {
        require(receiver != address(0), "Invalid receiver address");
        require(amount > 0, "Amount must be greater than zero");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(coSigners[msg.sender].length > 0, "No co-signers configured");
        
        uint256 txId = multiSigTxCounter++;
        MultiSigTransaction storage msTx = multiSigTxs[txId];
        msTx.initiator = msg.sender;
        msTx.receiver = receiver;
        msTx.amount = amount;
        msTx.approvalCount = 1; // Initiator's approval
        msTx.executed = false;
        msTx.expiresAt = block.timestamp + MULTISIG_EXPIRY; // NEW: 48-hour expiry
        msTx.approvals[msg.sender] = true;
        
        emit MultiSigTxProposed(txId, msg.sender, receiver, amount);
        return txId;
    }
    
    /**
     * @dev Approve a multi-sig transaction
     * @param txId Transaction ID to approve
     */
    function approveMultiSigTransaction(uint256 txId) public {
        MultiSigTransaction storage msTx = multiSigTxs[txId];
        require(!msTx.executed, "Transaction already executed");
        require(block.timestamp < msTx.expiresAt, "Proposal has expired"); // NEW: expiry check
        require(!msTx.approvals[msg.sender], "Already approved");
        
        // Check if sender is a co-signer or the initiator
        bool isAuthorized = (msg.sender == msTx.initiator);
        if (!isAuthorized) {
            address[] memory signers = coSigners[msTx.initiator];
            for (uint i = 0; i < signers.length; i++) {
                if (signers[i] == msg.sender) {
                    isAuthorized = true;
                    break;
                }
            }
        }
        require(isAuthorized, "Not authorized to approve");
        
        msTx.approvals[msg.sender] = true;
        msTx.approvalCount++;
        
        emit MultiSigTxApproved(txId, msg.sender);
    }
    
    /**
     * @dev Execute a multi-sig transaction if threshold is met
     * @param txId Transaction ID to execute
     */
    function executeMultiSigTransaction(uint256 txId) public whenNotPaused {
        MultiSigTransaction storage msTx = multiSigTxs[txId];
        require(!msTx.executed, "Transaction already executed");
        require(block.timestamp < msTx.expiresAt, "Proposal has expired"); // NEW: expiry check
        require(msTx.approvalCount >= approvalThreshold[msTx.initiator], "Insufficient approvals");
        require(balances[msTx.initiator] >= msTx.amount, "Insufficient balance");
        
        msTx.executed = true;
        
        // Execute the payment
        balances[msTx.initiator] -= msTx.amount;
        balances[msTx.receiver] += msTx.amount;
        
        transactions.push(Transaction({
            sender: msTx.initiator,
            receiver: msTx.receiver,
            amount: msTx.amount,
            timestamp: block.timestamp,
            txType: TransactionType.Payment
        }));
        
        payable(msTx.receiver).transfer(msTx.amount);
        
        emit MultiSigTxExecuted(txId);
        emit Payment(msTx.initiator, msTx.receiver, msTx.amount, block.timestamp);
    }
    
    // ==================== RECURRING PAYMENTS ====================
    
    /**
     * @dev Schedule a recurring payment (max 10 per user)
     * @param receiver Address of the recipient
     * @param amount Amount to send each time
     * @param interval Time interval in seconds between payments
     * @return Schedule ID
     */
    function scheduleRecurringPayment(address receiver, uint256 amount, uint256 interval) public requireKYC returns (uint256) {
        require(receiver != address(0), "Invalid receiver address");
        require(amount > 0, "Amount must be greater than zero");
        require(interval > 0, "Interval must be greater than zero");
        // NEW: Cap recurring payments per user
        require(userRecurringPayments[msg.sender].length < MAX_RECURRING_PAYMENTS, "Maximum recurring payments reached");
        
        uint256 scheduleId = recurringPaymentCounter++;
        recurringPayments[scheduleId] = RecurringPayment({
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            interval: interval,
            lastExecution: block.timestamp,
            active: true
        });
        
        userRecurringPayments[msg.sender].push(scheduleId);
        
        emit RecurringPaymentScheduled(scheduleId, msg.sender, receiver, amount, interval);
        return scheduleId;
    }
    
    /**
     * @dev Execute a recurring payment if it's due
     * @param scheduleId Schedule ID to execute
     */
    function executeRecurringPayment(uint256 scheduleId) public whenNotPaused {
        RecurringPayment storage schedule = recurringPayments[scheduleId];
        require(schedule.active, "Schedule is not active");
        require(block.timestamp >= schedule.lastExecution + schedule.interval, "Payment not due yet");
        require(balances[schedule.sender] >= schedule.amount, "Insufficient balance");
        
        // Execute payment
        balances[schedule.sender] -= schedule.amount;
        balances[schedule.receiver] += schedule.amount;
        
        transactions.push(Transaction({
            sender: schedule.sender,
            receiver: schedule.receiver,
            amount: schedule.amount,
            timestamp: block.timestamp,
            txType: TransactionType.Payment
        }));
        
        schedule.lastExecution = block.timestamp;
        
        payable(schedule.receiver).transfer(schedule.amount);
        
        emit RecurringPaymentExecuted(scheduleId);
        emit Payment(schedule.sender, schedule.receiver, schedule.amount, block.timestamp);
    }
    
    /**
     * @dev Cancel a recurring payment schedule
     * @param scheduleId Schedule ID to cancel
     */
    function cancelRecurringPayment(uint256 scheduleId) public {
        RecurringPayment storage schedule = recurringPayments[scheduleId];
        require(schedule.sender == msg.sender, "Not authorized");
        require(schedule.active, "Schedule already cancelled");
        
        schedule.active = false;
        emit RecurringPaymentCancelled(scheduleId);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Get all transactions (global - for analytics)
     * @return Array of all transactions
     */
    function getTransactions() public view returns (Transaction[] memory) {
        return transactions;
    }

    /**
     * @dev NEW: Get transactions relevant to the caller (sent or received)
     * @return Array of transactions where caller is sender or receiver
     */
    function getMyTransactions() public view returns (Transaction[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (transactions[i].sender == msg.sender || transactions[i].receiver == msg.sender) {
                count++;
            }
        }
        Transaction[] memory myTxs = new Transaction[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (transactions[i].sender == msg.sender || transactions[i].receiver == msg.sender) {
                myTxs[idx++] = transactions[i];
            }
        }
        return myTxs;
    }
    
    /**
     * @dev Get balance of a specific user
     * @param user Address of the user
     * @return Balance of the user
     */
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @dev Get total number of transactions
     * @return Total transaction count
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
    
    /**
     * @dev Get contract's total ETH balance
     * @return Contract balance
     */
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get co-signers for a user
     * @param user Address of the user
     * @return Array of co-signer addresses
     */
    function getCoSigners(address user) public view returns (address[] memory) {
        return coSigners[user];
    }
    
    /**
     * @dev Get approval threshold for a user
     * @param user Address of the user
     * @return Approval threshold
     */
    function getApprovalThreshold(address user) public view returns (uint256) {
        return approvalThreshold[user];
    }
    
    /**
     * @dev Get multi-sig transaction details
     * @param txId Transaction ID
     * @return initiator, receiver, amount, approvalCount, executed, expiresAt
     */
    function getMultiSigTransaction(uint256 txId) public view returns (
        address initiator,
        address receiver,
        uint256 amount,
        uint256 approvalCount,
        bool executed,
        uint256 expiresAt
    ) {
        MultiSigTransaction storage msTx = multiSigTxs[txId];
        return (msTx.initiator, msTx.receiver, msTx.amount, msTx.approvalCount, msTx.executed, msTx.expiresAt);
    }
    
    /**
     * @dev Get recurring payment details
     * @param scheduleId Schedule ID
     * @return sender, receiver, amount, interval, lastExecution, active
     */
    function getRecurringPayment(uint256 scheduleId) public view returns (
        address sender,
        address receiver,
        uint256 amount,
        uint256 interval,
        uint256 lastExecution,
        bool active
    ) {
        RecurringPayment storage schedule = recurringPayments[scheduleId];
        return (schedule.sender, schedule.receiver, schedule.amount, schedule.interval, schedule.lastExecution, schedule.active);
    }
    
    /**
     * @dev Get user's recurring payment schedules
     * @param user Address of the user
     * @return Array of schedule IDs
     */
    function getUserRecurringPayments(address user) public view returns (uint256[] memory) {
        return userRecurringPayments[user];
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Transfer contract ownership to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    /**
     * @dev Verify a user for KYC compliance
     * @param user Address of the user to verify
     */
    function verifyUser(address user) public onlyOwner {
        require(user != address(0), "Invalid user address");
        kycVerified[user] = true;
        emit UserVerified(user);
    }
    
    /**
     * @dev Revoke KYC verification for a user
     * @param user Address of the user
     */
    function revokeVerification(address user) public onlyOwner {
        require(user != address(0), "Invalid user address");
        kycVerified[user] = false;
        emit VerificationRevoked(user);
    }
    
    /**
     * @dev Pause all contract operations (emergency use only)
     */
    function pause() public onlyOwner {
        require(!paused, "Contract is already paused");
        paused = true;
        emit PauseStateChanged(true);
    }
    
    /**
     * @dev Unpause contract operations
     */
    function unpause() public onlyOwner {
        require(paused, "Contract is not paused");
        paused = false;
        emit PauseStateChanged(false);
    }
    
    /**
     * @dev Set daily transaction limit for the caller
     * @param limit Maximum amount that can be transacted per day
     */
    function setDailyLimit(uint256 limit) public {
        dailyLimits[msg.sender].limit = limit;
        dailyLimits[msg.sender].lastReset = block.timestamp;
        dailyLimits[msg.sender].spent = 0;
        emit DailyLimitSet(msg.sender, limit);
    }
    
    // ==================== SECURITY VIEW FUNCTIONS ====================
    
    /**
     * @dev Check if a user is KYC verified
     * @param user Address to check
     * @return Whether the user is verified
     */
    function isKYCVerified(address user) public view returns (bool) {
        return kycVerified[user];
    }
    
    /**
     * @dev Check if contract is paused
     * @return Pause status
     */
    function isPaused() public view returns (bool) {
        return paused;
    }
    
    /**
     * @dev Get contract owner address
     * @return Owner address
     */
    function getOwner() public view returns (address) {
        return owner;
    }
    
    /**
     * @dev Get daily limit information for a user
     * @param user Address of the user
     * @return limit, spent, remaining, lastReset
     */
    function getDailyLimitInfo(address user) public view returns (
        uint256 limit,
        uint256 spent,
        uint256 remaining,
        uint256 lastReset
    ) {
        DailyLimit storage userLimit = dailyLimits[user];
        
        // Calculate if reset is needed
        uint256 currentSpent = userLimit.spent;
        if (block.timestamp >= userLimit.lastReset + 1 days) {
            currentSpent = 0;
        }
        
        uint256 remainingAmount = 0;
        if (userLimit.limit > currentSpent) {
            remainingAmount = userLimit.limit - currentSpent;
        }
        
        return (
            userLimit.limit,
            currentSpent,
            remainingAmount,
            userLimit.lastReset
        );
    }
    
    /**
     * @dev Estimate gas for deposit
     * @return Estimated gas units
     */
    function estimateDepositGas() public pure returns (uint256) {
        return 50000;
    }
    
    /**
     * @dev Estimate gas for payment
     * @return Estimated gas units
     */
    function estimatePaymentGas() public pure returns (uint256) {
        return 65000;
    }
    
    /**
     * @dev Estimate gas for withdrawal
     * @return Estimated gas units
     */
    function estimateWithdrawalGas() public pure returns (uint256) {
        return 55000;
    }
    
    /**
     * @dev Fallback function to accept ETH
     */
    receive() external payable {
        deposit();
    }
}
