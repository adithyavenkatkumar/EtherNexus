import { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import GasEstimator from './GasEstimator';
import { Card, Button } from './UI';

function SendPayment({ contract, account, provider, onTransactionComplete, setProcessingTx, addressBook, ethPrice }) {
    const [recipient, setRecipient]         = useState('');
    const [amount, setAmount]               = useState('');
    const [loading, setLoading]             = useState(false);
    const [activeTab, setActiveTab]         = useState('deposit');
    const [addressError, setAddressError]   = useState('');
    const [showConfirm, setShowConfirm]     = useState(false);

    const validateRecipient = (val) => {
        setRecipient(val);
        if (!val) { setAddressError(''); return; }
        const alias = Object.entries(addressBook).find(([,n]) => n.toLowerCase() === val.toLowerCase());
        setAddressError(!alias && !ethers.isAddress(val) ? 'Invalid Ethereum address' : '');
    };

    const resolveAddress = () => {
        const alias = Object.entries(addressBook).find(([,n]) => n.toLowerCase() === recipient.toLowerCase());
        return alias ? alias[0] : recipient;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (activeTab === 'send') {
            const addr = resolveAddress();
            if (!ethers.isAddress(addr)) { toast.error('Invalid recipient'); return; }
        }
        if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
        setShowConfirm(true);
    };

    const confirmTransaction = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            const amountWei = ethers.parseEther(amount);
            let tx;
            if (activeTab === 'deposit') {
                tx = await contract.deposit({ value: amountWei });
            } else {
                tx = await contract.sendPayment(resolveAddress(), amountWei);
            }
            setProcessingTx({ hash: tx.hash, status: 'Confirming…' });
            await tx.wait();
            toast.success(activeTab === 'deposit' ? `Deposited ${amount} ETH!` : `Sent ${amount} ETH!`);
            setAmount(''); setRecipient('');
            onTransactionComplete(tx.hash);
        } catch (err) {
            toast.error(err.reason || 'Transaction failed');
            setProcessingTx(null);
        } finally { setLoading(false); }
    };

    const usdValue = amount ? `≈ $${(parseFloat(amount||0) * ethPrice).toLocaleString(undefined,{maximumFractionDigits:2})} USD` : '';

    return (
        <>
            <Card title="Send / Deposit">
                <div className="seg-control" style={{ marginBottom: 20, width:'100%' }}>
                    <button className={`seg-btn${activeTab==='deposit'?' active':''}`} style={{ flex:1 }} onClick={()=>setActiveTab('deposit')}>
                        Deposit
                    </button>
                    <button className={`seg-btn${activeTab==='send'?' active':''}`} style={{ flex:1 }} onClick={()=>setActiveTab('send')}>
                        Send
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {activeTab === 'send' && (
                        <div className="input-group">
                            <label>Recipient Address</label>
                            <input
                                type="text"
                                placeholder="0x… or contact name"
                                value={recipient}
                                onChange={e => validateRecipient(e.target.value)}
                                className={addressError ? 'error' : ''}
                            />
                            {addressError && <div className="input-error">{addressError}</div>}
                        </div>
                    )}

                    <div className="input-group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number" step="0.0001" min="0"
                            placeholder="0.0000"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                        {usdValue && <div className="input-hint">{usdValue}</div>}
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <GasEstimator
                                contract={contract} provider={provider}
                                transactionType={activeTab} amount={amount} ethPrice={ethPrice}
                            />
                        </div>
                    )}

                    <Button variant="primary" type="submit" style={{ width:'100%' }} disabled={loading || !!addressError}>
                        {loading
                            ? 'Processing…'
                            : activeTab === 'deposit' ? '↓ Confirm Deposit' : '↑ Confirm Payment'}
                    </Button>
                </form>
            </Card>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Confirm Transaction</h3>
                        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>
                            Please review before submitting to the network.
                        </p>

                        <div style={{ background:'var(--bg-page)', borderRadius:'var(--radius-sm)', padding:16, marginBottom:24, display:'flex', flexDirection:'column', gap:10 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span style={{ color:'var(--text-muted)' }}>Type</span>
                                <span style={{ fontWeight:600 }}>{activeTab === 'deposit' ? 'Deposit' : 'Payment'}</span>
                            </div>
                            {activeTab === 'send' && (
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                    <span style={{ color:'var(--text-muted)' }}>To</span>
                                    <code style={{ fontSize:12, fontFamily:'monospace' }}>{resolveAddress().slice(0,10)}…{resolveAddress().slice(-6)}</code>
                                </div>
                            )}
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span style={{ color:'var(--text-muted)' }}>Amount</span>
                                <span style={{ fontWeight:700, color:'var(--blue)' }}>{amount} ETH</span>
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span style={{ color:'var(--text-muted)' }}>USD Value</span>
                                <span style={{ fontWeight:600 }}>{usdValue}</span>
                            </div>
                        </div>

                        <div style={{ display:'flex', gap:10 }}>
                            <Button variant="secondary" style={{ flex:1 }} onClick={() => setShowConfirm(false)}>Cancel</Button>
                            <Button variant="primary" style={{ flex:1 }} onClick={confirmTransaction}>Confirm & Send</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default SendPayment;
