import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import WalletConnect from './components/WalletConnect'
import Balance from './components/Balance'
import SendPayment from './components/SendPayment'
import Transactions from './components/Transactions'
import Analytics from './components/Analytics'
import MultiSig from './components/MultiSig'
import RecurringPayments from './components/RecurringPayments'
import Notifications from './components/Notifications'
import AdminPanel from './components/AdminPanel'
import GasEstimator from './components/GasEstimator'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { Button, Card } from './components/UI'
import toast from 'react-hot-toast'
import './App.css'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x72bA8BD7071473b6c429BBf37440aa1347204ae6";

const CONTRACT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function sendPayment(address payable receiver, uint256 amount) public",
    "function getTransactions() public view returns (tuple(address sender, address receiver, uint256 amount, uint256 timestamp, uint8 txType)[])",
    "function getMyTransactions() public view returns (tuple(address sender, address receiver, uint256 amount, uint256 timestamp, uint8 txType)[])",
    "function getBalance(address user) public view returns (uint256)",
    "function getTransactionCount() public view returns (uint256)",
    "function addCoSigner(address coSigner) public",
    "function removeCoSigner(address coSigner) public",
    "function setApprovalThreshold(uint256 threshold) public",
    "function proposeMultiSigTransaction(address receiver, uint256 amount) public returns (uint256)",
    "function approveMultiSigTransaction(uint256 txId) public",
    "function executeMultiSigTransaction(uint256 txId) public",
    "function getCoSigners(address user) public view returns (address[])",
    "function getApprovalThreshold(address user) public view returns (uint256)",
    "function getMultiSigTransaction(uint256 txId) public view returns (address, address, uint256, uint256, bool, uint256)",
    "function scheduleRecurringPayment(address receiver, uint256 amount, uint256 interval) public returns (uint256)",
    "function executeRecurringPayment(uint256 scheduleId) public",
    "function cancelRecurringPayment(uint256 scheduleId) public",
    "function getRecurringPayment(uint256 scheduleId) public view returns (address, address, uint256, uint256, uint256, bool)",
    "function getUserRecurringPayments(address user) public view returns (uint256[])",
    "function estimateDepositGas() public pure returns (uint256)",
    "function estimatePaymentGas() public pure returns (uint256)",
    "function estimateWithdrawalGas() public pure returns (uint256)",
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
    "event Payment(address indexed sender, address indexed receiver, uint256 amount, uint256 timestamp)",
    "event MultiSigTxProposed(uint256 indexed txId, address indexed initiator, address indexed receiver, uint256 amount)",
    "event DailyLimitExceeded(address indexed user, uint256 amount, uint256 remaining)",
    "event UserVerified(address indexed user)"
];

const SEPOLIA_CHAIN_ID = 11155111n;

// Dashboard summary stat cards
function StatCards({ contract, account, refreshTrigger, ethPrice, isUSD }) {
    const [balance, setBalance]   = useState('0');
    const [txCount, setTxCount]   = useState('—');
    const [recurring, setRec]     = useState('—');
    const [multiSig, setMS]       = useState('—');

    useEffect(() => {
        if (!contract || !account) return;
        const load = async () => {
            try {
                const b = await contract.getBalance(account);
                setBalance(ethers.formatEther(b));
            } catch {}
            try {
                const c = await contract.getTransactionCount();
                setTxCount(Number(c).toString());
            } catch {}
            try {
                const ids = await contract.getUserRecurringPayments(account);
                setRec(ids.length.toString());
            } catch {}
        };
        load();
    }, [contract, account, refreshTrigger]);

    const balDisplay = isUSD
        ? `$${(parseFloat(balance) * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `${parseFloat(balance).toFixed(3)} ETH`;

    const stats = [
        { label: 'Total Balance',           value: balDisplay,  sub: isUSD ? `${parseFloat(balance).toFixed(4)} ETH` : `$${(parseFloat(balance)*ethPrice).toLocaleString(undefined,{maximumFractionDigits:0})} USD`, ind: null },
        { label: 'Recurring Payments',      value: recurring,   sub: 'Active schedules',             ind: 'neutral' },
        { label: 'Pending MultiSig',        value: multiSig,    sub: 'Awaiting approval',            ind: 'neutral' },
        { label: 'Total Transactions',      value: txCount,     sub: 'On-chain records',             ind: 'neutral' },
    ];

    return (
        <div className="stat-grid">
            {stats.map((s, i) => (
                <div className="stat-card" key={i}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value">{s.value}</div>
                    {s.sub && <div className="stat-sub">{s.sub}</div>}
                </div>
            ))}
        </div>
    );
}

function App() {
    const [account, setAccount]             = useState(null);
    const [contract, setContract]           = useState(null);
    const [provider, setProvider]           = useState(null);
    const [signer, setSigner]               = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [activeView, setActiveView]       = useState('main');
    const [isUSD, setIsUSD]                 = useState(false);
    const [ethPrice, setEthPrice]           = useState(2500);
    const [priceChange, setPriceChange]     = useState(0);
    const [addressBook, setAddressBook]     = useState(() => {
        try { return JSON.parse(localStorage.getItem('addressBook') || '{}'); } catch { return {}; }
    });
    const [processingTx, setProcessingTx]   = useState(null);
    const [showAddressBook, setShowAddressBook] = useState(false);
    const [networkName, setNetworkName]     = useState('Sepolia Testnet');
    const [wrongNetwork, setWrongNetwork]   = useState(false);

    useEffect(() => {
        // Force light theme
        document.body.style.background = 'var(--bg-page)';
        document.body.style.color      = 'var(--text-primary)';
    }, []);

    useEffect(() => {
        if (account && signer) {
            setContract(new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer));
            fetchPrice();
        }
    }, [account, signer]);

    useEffect(() => {
        if (!account) return;
        fetchPrice();
        const iv = setInterval(fetchPrice, 60000);
        return () => clearInterval(iv);
    }, [account]);

    useEffect(() => {
        if (!window.ethereum) return;
        const handleChainChange = async () => {
            try {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                setWrongNetwork(BigInt(chainId) !== SEPOLIA_CHAIN_ID);
            } catch {}
        };
        window.ethereum.on('chainChanged', handleChainChange);
        return () => window.ethereum.removeListener('chainChanged', handleChainChange);
    }, []);

    const fetchPrice = async () => {
        try {
            const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true');
            const data = await res.json();
            if (data.ethereum) { setEthPrice(data.ethereum.usd); setPriceChange(data.ethereum.usd_24h_change || 0); }
        } catch {}
    };

    const handleTransactionComplete = (txHash) => {
        setProcessingTx({ hash: txHash, status: 'Completed' });
        setRefreshTrigger(p => p + 1);
        setTimeout(() => setProcessingTx(null), 10000);
    };

    const addToAddressBook    = (address, name) => { const b = { ...addressBook, [address.toLowerCase()]: name }; setAddressBook(b); localStorage.setItem('addressBook', JSON.stringify(b)); };
    const removeFromAddressBook = (address)   => { const b = { ...addressBook }; delete b[address.toLowerCase()]; setAddressBook(b); localStorage.setItem('addressBook', JSON.stringify(b)); };

    return (
        <div className="app-layout">
            <Sidebar activeView={activeView} setActiveView={setActiveView} />

            <Header
                account={account}
                networkName={networkName}
                ethPrice={ethPrice}
                priceChange={priceChange}
                isUSD={isUSD}
                toggleCurrency={() => setIsUSD(p => !p)}
                setShowAddressBook={setShowAddressBook}
                wrongNetwork={wrongNetwork}
            />

            <main className="app-main">
                <Notifications contract={contract} account={account} />

                {wrongNetwork && (
                    <div className="network-warning">
                        ⚠ Wrong Network — Please switch to Sepolia Testnet in MetaMask.
                    </div>
                )}

                {!account ? (
                    /* ── Connect Wallet Screen ── */
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'70vh' }}>
                        <div style={{ maxWidth:400, width:'100%', textAlign:'center' }}>
                            <div style={{
                                width:64, height:64, borderRadius:16,
                                background:'var(--blue)', color:'white',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:28, fontWeight:800, margin:'0 auto 24px',
                            }}>E</div>
                            <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:8 }}>
                                EtherNexus
                            </h1>
                            <p style={{ color:'var(--text-muted)', fontSize:15, marginBottom:36 }}>
                                Decentralized banking on Ethereum
                            </p>
                            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28, boxShadow:'var(--shadow-sm)' }}>
                                <WalletConnect
                                    account={account}
                                    setAccount={setAccount}
                                    setProvider={setProvider}
                                    setSigner={setSigner}
                                    setNetworkName={setNetworkName}
                                    setWrongNetwork={setWrongNetwork}
                                />
                            </div>
                            <p style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:16 }}>
                                Sepolia Testnet · Non-custodial · Open Source
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeView === 'main' && (
                            <>
                                <StatCards
                                    contract={contract} account={account}
                                    refreshTrigger={refreshTrigger}
                                    ethPrice={ethPrice} isUSD={isUSD}
                                />
                                <div style={{ marginBottom:24 }}>
                                    <Balance
                                        contract={contract} account={account}
                                        refreshTrigger={refreshTrigger}
                                        onTransactionComplete={handleTransactionComplete}
                                        ethPrice={ethPrice} priceChange={priceChange} isUSD={isUSD}
                                    />
                                </div>
                                <div className="smart-grid">
                                    <div className="col-8">
                                        <Transactions
                                            contract={contract} refreshTrigger={refreshTrigger}
                                            addressBook={addressBook} isUSD={isUSD}
                                            ethPrice={ethPrice} account={account}
                                        />
                                    </div>
                                    <div className="col-4">
                                        <SendPayment
                                            contract={contract} account={account}
                                            provider={provider}
                                            onTransactionComplete={handleTransactionComplete}
                                            setProcessingTx={setProcessingTx}
                                            addressBook={addressBook} ethPrice={ethPrice}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeView === 'analytics' && (
                            <Analytics
                                contract={contract} account={account}
                                isUSD={isUSD} ethPrice={ethPrice}
                            />
                        )}

                        {activeView === 'multisig' && (
                            <MultiSig
                                contract={contract} account={account} provider={provider}
                            />
                        )}

                        {activeView === 'recurring' && (
                            <RecurringPayments contract={contract} account={account} />
                        )}

                        {activeView === 'gas' && (
                            <Card title="Gas Estimator">
                                <p style={{ color:'var(--text-muted)', fontSize:13.5, marginBottom:24 }}>
                                    Real-time network fee estimation for each transaction type.
                                </p>
                                <div className="smart-grid">
                                    <div className="col-4"><GasEstimator contract={contract} provider={provider} transactionType="deposit"    amount="0.1" ethPrice={ethPrice} /></div>
                                    <div className="col-4"><GasEstimator contract={contract} provider={provider} transactionType="payment"    amount="0.1" ethPrice={ethPrice} /></div>
                                    <div className="col-4"><GasEstimator contract={contract} provider={provider} transactionType="withdrawal" amount="0.1" ethPrice={ethPrice} /></div>
                                </div>
                            </Card>
                        )}

                        {activeView === 'admin' && (
                            <AdminPanel contract={contract} account={account} />
                        )}
                    </>
                )}
            </main>

            {/* ── Processing TX Overlay ── */}
            {processingTx && (
                <div className="tx-overlay">
                    <div className="modal-box" style={{ textAlign:'center' }}>
                        <div className="spinner" style={{ margin:'0 auto 20px' }} />
                        <h3 style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>Broadcasting Transaction</h3>
                        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
                            Status: {processingTx.status}
                        </p>
                        {processingTx.hash && (
                            <a
                                href={`https://sepolia.etherscan.io/tx/${processingTx.hash}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ color:'var(--blue)', fontSize:13, fontWeight:600, textDecoration:'none', display:'block', marginBottom:20 }}
                            >
                                View on Etherscan ↗
                            </a>
                        )}
                        <Button variant="secondary" onClick={() => setProcessingTx(null)} style={{ width:'100%' }}>
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Address Book Modal ── */}
            {showAddressBook && (
                <div className="modal-overlay" onClick={() => setShowAddressBook(false)}>
                    <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-xl)', padding:32, maxWidth:560, width:'100%', boxShadow:'0 24px 48px rgba(0,0,0,0.18)', animation:'modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
                            <h3 style={{ fontSize:17, fontWeight:700 }}>Address Book</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddressBook(false)}>✕</button>
                        </div>

                        <div style={{ maxHeight:300, overflowY:'auto', marginBottom:20 }}>
                            {Object.entries(addressBook).length === 0 ? (
                                <div className="empty-state" style={{ padding:'32px 0' }}>
                                    <div className="empty-state-icon">📭</div>
                                    <h3>No contacts yet</h3>
                                    <p>Add your first contact below.</p>
                                </div>
                            ) : (
                                Object.entries(addressBook).map(([addr, name]) => (
                                    <div key={addr} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', marginBottom:8 }}>
                                        <div>
                                            <div style={{ fontWeight:600, fontSize:14 }}>{name}</div>
                                            <code style={{ fontSize:11.5, color:'var(--text-muted)', fontFamily:'monospace' }}>{addr}</code>
                                        </div>
                                        <div style={{ display:'flex', gap:6 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(addr); toast.success('Copied!'); }}>⧉</button>
                                            <button className="btn btn-secondary btn-sm" style={{ color:'var(--red)' }} onClick={() => removeFromAddressBook(addr)}>✕</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <hr className="divider" />
                        <p style={{ fontSize:12.5, fontWeight:600, color:'var(--text-secondary)', marginBottom:12 }}>Add Contact</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const addr = e.target.addr.value.trim();
                            const name = e.target.name.value.trim();
                            if (!ethers.isAddress(addr)) { toast.error('Invalid address'); return; }
                            if (addr && name) { addToAddressBook(addr, name); e.target.reset(); }
                        }}>
                            <div style={{ display:'flex', gap:10 }}>
                                <input name="name" placeholder="Contact name" required style={{ flex:'0 0 140px' }} />
                                <input name="addr" placeholder="0x… address" required style={{ flex:1 }} />
                                <Button variant="primary" type="submit">Add</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
