import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import WalletConnect from './components/WalletConnect'
import Balance from './components/Balance'
import SendPayment from './components/SendPayment'
import Transactions from './components/Transactions'
import Analytics from './components/Analytics'
import MultiSig from './components/MultiSig'
import RecurringPayments from './components/RecurringPayments'
import QRCode from './components/QRCode'
import Notifications from './components/Notifications'
import AdminPanel from './components/AdminPanel'
import GasEstimator from './components/GasEstimator'
import './App.css'

// Contract configuration - loaded from .env (VITE_CONTRACT_ADDRESS)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x72bA8BD7071473b6c429BBf37440aa1347204ae6";

// Updated ABI with all functions including getMyTransactions
const CONTRACT_ABI = [
    // Basic functions
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function sendPayment(address payable receiver) public payable",
    "function getTransactions() public view returns (tuple(address sender, address receiver, uint256 amount, uint256 timestamp, uint8 txType)[])",
    "function getMyTransactions() public view returns (tuple(address sender, address receiver, uint256 amount, uint256 timestamp, uint8 txType)[])",
    "function getBalance(address user) public view returns (uint256)",
    "function getTransactionCount() public view returns (uint256)",

    // Multi-signature functions
    "function addCoSigner(address coSigner) public",
    "function removeCoSigner(address coSigner) public",
    "function setApprovalThreshold(uint256 threshold) public",
    "function proposeMultiSigTransaction(address receiver, uint256 amount) public returns (uint256)",
    "function approveMultiSigTransaction(uint256 txId) public",
    "function executeMultiSigTransaction(uint256 txId) public",
    "function getCoSigners(address user) public view returns (address[])",
    "function getApprovalThreshold(address user) public view returns (uint256)",
    "function getMultiSigTransaction(uint256 txId) public view returns (address, address, uint256, uint256, bool, uint256)",

    // Recurring payment functions
    "function scheduleRecurringPayment(address receiver, uint256 amount, uint256 interval) public returns (uint256)",
    "function executeRecurringPayment(uint256 scheduleId) public",
    "function cancelRecurringPayment(uint256 scheduleId) public",
    "function getRecurringPayment(uint256 scheduleId) public view returns (address, address, uint256, uint256, uint256, bool)",
    "function getUserRecurringPayments(address user) public view returns (uint256[])",

    // Gas estimation functions
    "function estimateDepositGas() public pure returns (uint256)",
    "function estimatePaymentGas() public pure returns (uint256)",
    "function estimateWithdrawalGas() public pure returns (uint256)",

    // Security & Compliance functions
    "function transferOwnership(address newOwner) public",
    "function verifyUser(address user) public",
    "function revokeVerification(address user) public",
    "function pause() public",
    "function unpause() public",
    "function setDailyLimit(uint256 limit) public",
    "function isKYCVerified(address user) public view returns (bool)",
    "function isPaused() public view returns (bool)",
    "function getOwner() public view returns (address)",
    "function getDailyLimitInfo(address user) public view returns (uint256, uint256, uint256, uint256)",

    // Events
    "event Deposit(address indexed user, uint256 amount, uint256 timestamp)",
    "event Payment(address indexed sender, address indexed receiver, uint256 amount, uint256 timestamp)",
    "event Withdrawal(address indexed user, uint256 amount, uint256 timestamp)",
    "event CoSignerAdded(address indexed user, address indexed coSigner)",
    "event MultiSigTxProposed(uint256 indexed txId, address indexed initiator, address indexed receiver, uint256 amount)",
    "event RecurringPaymentScheduled(uint256 indexed scheduleId, address indexed sender, address indexed receiver, uint256 amount, uint256 interval)",

    // Security events
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "event UserVerified(address indexed user)",
    "event VerificationRevoked(address indexed user)",
    "event DailyLimitSet(address indexed user, uint256 limit)",
    "event PauseStateChanged(bool paused)"
];

// Sepolia chain ID
const SEPOLIA_CHAIN_ID = 11155111n;

/**
 * Main Application Component for EtherNexus Blockchain Banking.
 * Handles global state including wallet connection, theme management,
 * ETH price tracking, and main navigation routing.
 * 
 * @component
 */
function App() {
    /** @type {[string|null, function]} User's connected wallet address */
    const [account, setAccount] = useState(null);
    /** @type {[ethers.Contract|null, function]} Instance of the PaymentSystem contract */
    const [contract, setContract] = useState(null);
    /** @type {[ethers.BrowserProvider|null, function]} Ethers provider for blockchain interaction */
    const [provider, setProvider] = useState(null);
    /** @type {[ethers.Signer|null, function]} Signed instance of the provider */
    const [signer, setSigner] = useState(null);
    /** @type {[number, function]} Counter to trigger data refresh across components */
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    /** @type {[string, function]} Currently active view/tab (main|analytics|multisig|recurring|admin|gas) */
    const [activeView, setActiveView] = useState('main');

    // Global features states
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [isUSD, setIsUSD] = useState(false);
    const [ethPrice, setEthPrice] = useState(2500);
    const [priceChange, setPriceChange] = useState(0);
    const [addressBook, setAddressBook] = useState(() => {
        const saved = localStorage.getItem('addressBook');
        return saved ? JSON.parse(saved) : {};
    });
    const [processingTx, setProcessingTx] = useState(null);
    const [showAddressBook, setShowAddressBook] = useState(false);
    const [networkName, setNetworkName] = useState('Sepolia');
    const [wrongNetwork, setWrongNetwork] = useState(false);

    // Apply theme
    useEffect(() => {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    // Initialize contract when wallet is connected
    useEffect(() => {
        if (account && signer) {
            const contractInstance = new ethers.Contract(
                CONTRACT_ADDRESS,
                CONTRACT_ABI,
                signer
            );
            setContract(contractInstance);
            fetchPrice();
        }
    }, [account, signer]);

    // Auto-refresh ETH price every 60 seconds
    useEffect(() => {
        if (!account) return;
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, [account]);

    // Listen for network changes to show wrong-network warning
    useEffect(() => {
        if (!window.ethereum) return;
        const handleChainChange = async () => {
            try {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                const numChainId = BigInt(chainId);
                setWrongNetwork(numChainId !== SEPOLIA_CHAIN_ID);
            } catch (e) { /* ignore */ }
        };
        window.ethereum.on('chainChanged', handleChainChange);
        return () => window.ethereum.removeListener('chainChanged', handleChainChange);
    }, []);

    const fetchPrice = async () => {
        try {
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true');
            const data = await res.json();
            if (data.ethereum) {
                setEthPrice(data.ethereum.usd);
                setPriceChange(data.ethereum.usd_24h_change || 0);
            }
        } catch (e) { console.error("Price fetch failed", e); }
    };

    // Trigger refresh for balance and transactions
    const handleTransactionComplete = (txHash) => {
        setProcessingTx({ hash: txHash, status: 'Completed' });
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setProcessingTx(null), 10000);
    };

    const addToAddressBook = (address, name) => {
        const newBook = { ...addressBook, [address.toLowerCase()]: name };
        setAddressBook(newBook);
        localStorage.setItem('addressBook', JSON.stringify(newBook));
    };

    const removeFromAddressBook = (address) => {
        const newBook = { ...addressBook };
        delete newBook[address.toLowerCase()];
        setAddressBook(newBook);
        localStorage.setItem('addressBook', JSON.stringify(newBook));
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(() => { });
    };

    const toggleCurrency = () => setIsUSD(prev => !prev);

    return (
        <div className="app">
            <Notifications contract={contract} account={account} />

            <div className="app-container">
                <header className="app-header">
                    <div className="header-top">
                        <div className="system-status">
                            <span className="dot pulse"></span> Network: {networkName}
                        </div>
                        <div className="header-actions">
                            <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                                {theme === 'dark' ? '☀️' : '🌙'}
                            </button>
                            <div className="eth-price-ticker" title="ETH Price (auto-refreshes every 60s)">
                                <span className="ticker-label">ETH</span>
                                <span className="ticker-price">${ethPrice.toLocaleString()}</span>
                                <span className={`ticker-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                                </span>
                            </div>
                            <button className={`currency-toggle ${isUSD ? 'usd' : 'eth'}`} onClick={toggleCurrency}>
                                {isUSD ? '💵 USD' : '💎 ETH'}
                            </button>
                            <button className="icon-btn" onClick={() => setShowAddressBook(true)} title="Address Book">
                                📔
                            </button>
                        </div>
                    </div>
                    <h1>🔐 EtherNexus</h1>
                    <p className="subtitle">The Next Generation of Secure Blockchain Banking</p>
                </header>

                {/* Wrong Network Banner */}
                {wrongNetwork && (
                    <div className="network-warning-banner">
                        ⚠️ Wrong network detected! Please switch to <strong>Sepolia Testnet</strong> in MetaMask.
                    </div>
                )}

                <WalletConnect
                    account={account}
                    setAccount={setAccount}
                    setProvider={setProvider}
                    setSigner={setSigner}
                    setNetworkName={setNetworkName}
                    setWrongNetwork={setWrongNetwork}
                />

                {account && contract ? (
                    <>
                        {/* Navigation Tabs */}
                        <div className="view-tabs">
                            <button className={`view-tab ${activeView === 'main' ? 'active' : ''}`} onClick={() => setActiveView('main')}>
                                🏠 Home
                            </button>
                            <button className={`view-tab ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>
                                📈 Stats
                            </button>
                            <button className={`view-tab ${activeView === 'multisig' ? 'active' : ''}`} onClick={() => setActiveView('multisig')}>
                                🔐 MultiSig
                            </button>
                            <button className={`view-tab ${activeView === 'recurring' ? 'active' : ''}`} onClick={() => setActiveView('recurring')}>
                                🔄 Auto
                            </button>
                            <button className={`view-tab ${activeView === 'gas' ? 'active' : ''}`} onClick={() => setActiveView('gas')}>
                                ⛽ Gas
                            </button>
                            <button className={`view-tab ${activeView === 'admin' ? 'active' : ''}`} onClick={() => setActiveView('admin')}>
                                🛡️ Admin
                            </button>
                        </div>

                        {/* Main View */}
                        {activeView === 'main' && (
                            <div className="main-content">
                                <div className="top-section">
                                    <Balance
                                        contract={contract}
                                        account={account}
                                        refreshTrigger={refreshTrigger}
                                        onTransactionComplete={handleTransactionComplete}
                                        ethPrice={ethPrice}
                                        priceChange={priceChange}
                                        isUSD={isUSD}
                                    />

                                    <div className="qr-section">
                                        <QRCode address={account} />
                                    </div>
                                </div>

                                <SendPayment
                                    contract={contract}
                                    account={account}
                                    provider={provider}
                                    onTransactionComplete={handleTransactionComplete}
                                    setProcessingTx={setProcessingTx}
                                    addressBook={addressBook}
                                    ethPrice={ethPrice}
                                />

                                <Transactions
                                    contract={contract}
                                    refreshTrigger={refreshTrigger}
                                    addressBook={addressBook}
                                    isUSD={isUSD}
                                    ethPrice={ethPrice}
                                    account={account}
                                />
                            </div>
                        )}

                        {/* Analytics View */}
                        {activeView === 'analytics' && (
                            <div className="main-content">
                                <Analytics
                                    contract={contract}
                                    account={account}
                                    isUSD={isUSD}
                                    ethPrice={ethPrice}
                                />
                            </div>
                        )}

                        {/* Multi-Sig View */}
                        {activeView === 'multisig' && (
                            <div className="main-content">
                                <MultiSig
                                    contract={contract}
                                    account={account}
                                    provider={provider}
                                />
                            </div>
                        )}

                        {/* Recurring Payments View */}
                        {activeView === 'recurring' && (
                            <div className="main-content">
                                <RecurringPayments
                                    contract={contract}
                                    account={account}
                                />
                            </div>
                        )}

                        {/* Gas Estimator View */}
                        {activeView === 'gas' && (
                            <div className="main-content">
                                <div className="gas-page-card">
                                    <h3>⛽ Gas Fee Estimator</h3>
                                    <p className="gas-page-desc">Real-time gas estimation for all transaction types on Sepolia.</p>
                                    <div className="gas-page-grid">
                                        <div>
                                            <h4>Deposit Gas</h4>
                                            <GasEstimator contract={contract} provider={provider} transactionType="deposit" amount="0.01" ethPrice={ethPrice} />
                                        </div>
                                        <div>
                                            <h4>Payment Gas</h4>
                                            <GasEstimator contract={contract} provider={provider} transactionType="payment" amount="0.01" ethPrice={ethPrice} />
                                        </div>
                                        <div>
                                            <h4>Withdrawal Gas</h4>
                                            <GasEstimator contract={contract} provider={provider} transactionType="withdrawal" amount="0.01" ethPrice={ethPrice} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Admin View */}
                        {activeView === 'admin' && (
                            <div className="main-content">
                                <AdminPanel
                                    contract={contract}
                                    account={account}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="welcome-message">
                        <div className="welcome-card">
                            <h2>Welcome to EtherNexus</h2>
                            <p>The Next Generation of Secure Blockchain Banking</p>
                            <ul className="features-list">
                                <li>✓ Secure deposits &amp; withdrawals on Sepolia testnet</li>
                                <li>✓ Instant peer-to-peer transfers with gas estimation</li>
                                <li>✓ Multi-signature wallet for enhanced security</li>
                                <li>✓ Recurring payment scheduling (max 10 per user)</li>
                                <li>✓ Real-time analytics dashboard with CSV export</li>
                                <li>✓ USD price conversion &amp; QR codes</li>
                                <li>✓ Advanced transaction filtering &amp; pagination</li>
                                <li>✓ 48-hour MultiSig proposal expiry for safety</li>
                            </ul>
                        </div>
                    </div>
                )}

            </div>

            {/* Global Processing Overlay */}
            {processingTx && (
                <div className="tx-overlay">
                    <div className="tx-modal">
                        <div className={`spinner ${processingTx.status.toLowerCase()}`}></div>
                        <h3>Transaction {processingTx.status}</h3>
                        <button className="modal-close" onClick={() => setProcessingTx(null)}>✕</button>
                        {processingTx.hash && (
                            <a
                                href={`https://sepolia.etherscan.io/tx/${processingTx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link"
                            >
                                View on Etherscan ↗
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Address Book Modal */}
            {showAddressBook && (
                <div className="modal-overlay" onClick={() => setShowAddressBook(false)}>
                    <div className="modal-content address-book" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowAddressBook(false)}>✕</button>
                        <h3>📔 Address Book</h3>
                        <div className="address-book-list">
                            {Object.entries(addressBook).map(([addr, name]) => (
                                <div key={addr} className="address-book-item">
                                    <div className="alias-info">
                                        <span className="alias-name">{name}</span>
                                        <span className="alias-addr">{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                                    </div>
                                    <div className="alias-actions">
                                        <button
                                            className="copy-btn"
                                            onClick={() => copyToClipboard(addr)}
                                            title="Copy address"
                                        >
                                            📋
                                        </button>
                                        <button
                                            className="delete-contact-btn"
                                            onClick={() => removeFromAddressBook(addr)}
                                            title="Delete contact"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(addressBook).length === 0 && <p className="empty-state">No contacts saved yet.</p>}
                        </div>
                        <div className="add-alias">
                            <h4>Add New Contact</h4>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const addr = e.target.addr.value.trim();
                                const name = e.target.name.value.trim();
                                if (!ethers.isAddress(addr)) {
                                    alert('Invalid Ethereum address');
                                    return;
                                }
                                if (addr && name) {
                                    addToAddressBook(addr, name);
                                    e.target.reset();
                                }
                            }}>
                                <input name="name" placeholder="Name (e.g. Alice)" required />
                                <input name="addr" placeholder="Address (0x...)" required />
                                <button type="submit" className="submit-button">Save Contact</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
