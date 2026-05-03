import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Badge } from './UI';

function Balance({ contract, account, refreshTrigger, onTransactionComplete, ethPrice, priceChange, isUSD }) {
    const [balance, setBalance] = useState('0');
    const [loading, setLoading] = useState(true);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [dailyLimit, setDailyLimit] = useState({ limit: '0', spent: '0', remaining: '0' });

    useEffect(() => {
        if (contract && account) {
            fetchBalance();
            fetchSecurityInfo();
        }
    }, [contract, account, refreshTrigger]);

    const fetchBalance = async () => {
        try {
            setLoading(true);
            const balanceWei = await contract.getBalance(account);
            setBalance(ethers.formatEther(balanceWei));
        } catch { setBalance('0'); }
        finally { setLoading(false); }
    };

    const fetchSecurityInfo = async () => {
        try {
            const verified = await contract.isKYCVerified(account);
            setKycVerified(verified);
            const paused = await contract.isPaused();
            setIsPaused(paused);
            const limitInfo = await contract.getDailyLimitInfo(account);
            setDailyLimit({
                limit: ethers.formatEther(limitInfo[0]),
                spent: ethers.formatEther(limitInfo[1]),
                remaining: ethers.formatEther(limitInfo[2]),
            });
        } catch {}
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) { toast.error('Enter a valid amount'); return; }
        setWithdrawing(true);
        try {
            const tx = await contract.withdraw(ethers.parseEther(withdrawAmount));
            toast.loading('Processing withdrawal…');
            await tx.wait();
            toast.success(`Withdrawn ${withdrawAmount} ETH`);
            setWithdrawAmount('');
            setShowWithdraw(false);
            if (onTransactionComplete) onTransactionComplete(tx.hash);
        } catch (err) { toast.error(err.reason || 'Withdrawal failed'); }
        finally { setWithdrawing(false); }
    };

    const displayBalance = isUSD
        ? `$${(parseFloat(balance) * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : `${parseFloat(balance).toFixed(4)} ETH`;

    const usdValue = `$${(parseFloat(balance) * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    return (
        <>
            {/* Hero Balance Card */}
            <div className="hero-panel" style={{ marginBottom: 24 }}>
                <div className="smart-grid" style={{ alignItems: 'center' }}>
                    <div className="col-8">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <Badge variant={kycVerified ? 'success' : 'warning'}>
                                {kycVerified ? '✓ KYC Verified' : '⚠ KYC Unverified'}
                            </Badge>
                            {isPaused && <Badge variant="danger">Paused</Badge>}
                        </div>

                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                            Total Balance
                        </div>

                        {loading ? (
                            <div className="skeleton" style={{ height: 52, width: 220, borderRadius: 10 }} />
                        ) : (
                            <>
                                <div className="balance-value">
                                    {displayBalance}
                                </div>
                                {isUSD ? (
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
                                        {parseFloat(balance).toFixed(4)} ETH
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
                                        {usdValue} USD
                                    </div>
                                )}
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 12, fontWeight: 600, marginTop: 8,
                                    color: priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                                }}>
                                    {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange || 0).toFixed(2)}% (24h)
                                </div>
                            </>
                        )}

                        {/* Wallet Address Row */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            marginTop: 24, padding: '10px 14px',
                            background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                        }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Wallet</span>
                            <code style={{ fontSize: 12.5, flex: 1, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                {account?.slice(0, 10)}...{account?.slice(-6)}
                            </code>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { navigator.clipboard.writeText(account); toast.success('Address copied!'); }}
                            >
                                ⧉ Copy
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <Button variant="primary" style={{ flex: 1 }} onClick={() => toast.success('Deposit via MetaMask')}>
                                ↓ Deposit
                            </Button>
                            <Button variant="secondary" style={{ flex: 1 }} onClick={() => setShowWithdraw(true)}>
                                ↑ Withdraw
                            </Button>
                            <Button variant="secondary" style={{ flex: 1 }} onClick={() => toast('Swap coming soon')}>
                                ⇄ Swap
                            </Button>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="col-4" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div className="qr-section">
                            <QRCodeSVG value={account || ''} size={140} />
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Scan to receive
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Withdraw Modal */}
            {showWithdraw && (
                <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Withdraw Funds</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                            Available: {parseFloat(balance).toFixed(4)} ETH
                        </p>
                        <form onSubmit={handleWithdraw}>
                            <div className="input-group">
                                <label>Amount (ETH)</label>
                                <input
                                    type="number" step="0.0001"
                                    placeholder="0.0"
                                    value={withdrawAmount}
                                    onChange={e => setWithdrawAmount(e.target.value)}
                                    autoFocus
                                />
                                {withdrawAmount && (
                                    <div className="input-hint">
                                        ≈ ${(parseFloat(withdrawAmount || 0) * ethPrice).toLocaleString()} USD
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <Button variant="secondary" style={{ flex: 1 }} type="button" onClick={() => setShowWithdraw(false)}>Cancel</Button>
                                <Button variant="primary" style={{ flex: 1 }} type="submit" disabled={withdrawing}>
                                    {withdrawing ? 'Processing…' : 'Confirm Withdrawal'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default Balance;
