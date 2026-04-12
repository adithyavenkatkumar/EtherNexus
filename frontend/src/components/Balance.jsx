import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import PriceDisplay from './PriceDisplay';

function Balance({ contract, account, refreshTrigger, onTransactionComplete, ethPrice, priceChange }) {
    const [balance, setBalance] = useState('0');
    const [loading, setLoading] = useState(true);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [dailyLimit, setDailyLimit] = useState({ limit: '0', spent: '0', remaining: '0' });
    const [newLimit, setNewLimit] = useState('');
    const [showLimitSetter, setShowLimitSetter] = useState(false);

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
            const balanceEth = ethers.formatEther(balanceWei);
            setBalance(balanceEth);
        } catch (err) {
            console.error('Error fetching balance:', err);
            setBalance('0');
        } finally {
            setLoading(false);
        }
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
                remaining: ethers.formatEther(limitInfo[2])
            });
        } catch (err) {
            console.error('Error fetching security info:', err);
        }
    };

    const handleSetDailyLimit = async (e) => {
        e.preventDefault();
        if (!newLimit || parseFloat(newLimit) <= 0) {
            toast.error('Please enter a valid limit');
            return;
        }

        try {
            const limitWei = ethers.parseEther(newLimit);
            const tx = await contract.setDailyLimit(limitWei);
            toast.loading('Setting daily limit...');
            await tx.wait();
            toast.success(`Daily limit set to ${newLimit} ETH!`);
            setNewLimit('');
            setShowLimitSetter(false);
            fetchSecurityInfo();
        } catch (err) {
            console.error('Error setting limit:', err);
            toast.error(err.reason || 'Failed to set limit');
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();

        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (parseFloat(withdrawAmount) > parseFloat(balance)) {
            toast.error('Insufficient balance');
            return;
        }

        setWithdrawing(true);
        try {
            const amountWei = ethers.parseEther(withdrawAmount);
            const tx = await contract.withdraw(amountWei);
            toast.loading('Processing withdrawal...');
            await tx.wait();
            toast.success(`Successfully withdrawn ${withdrawAmount} ETH!`);
            setWithdrawAmount('');
            setShowWithdraw(false);
            if (onTransactionComplete) onTransactionComplete(tx.hash);
        } catch (err) {
            console.error('Withdrawal error:', err);
            toast.error(err.reason || 'Withdrawal failed. Please try again.');
        } finally {
            setWithdrawing(false);
        }
    };

    // Daily limit progress (0–100%)
    const limitNum = parseFloat(dailyLimit.limit);
    const spentNum = parseFloat(dailyLimit.spent);
    const spentPercent = limitNum > 0 ? Math.min((spentNum / limitNum) * 100, 100) : 0;
    const limitColor = spentPercent > 80 ? '#f56565' : spentPercent > 50 ? '#f6ad55' : '#48bb78';

    return (
        <div className="balance-card">
            <h3>💰 Your Balance</h3>

            {/* Security Status Badges */}
            <div className="security-badges">
                <span className={`badge ${kycVerified ? 'verified' : 'unverified'}`}>
                    {kycVerified ? '✓ KYC Verified' : '⚠️ KYC Unverified'}
                </span>
                {isPaused && <span className="badge paused">⏸️ Contract Paused</span>}
            </div>

            {/* Loading skeleton */}
            {loading ? (
                <div className="balance-skeleton">
                    <div className="skeleton-block wide"></div>
                    <div className="skeleton-block narrow"></div>
                </div>
            ) : (
                <>
                    <div className="balance-amount">
                        <span className="amount">{parseFloat(balance).toFixed(4)}</span>
                        <span className="currency">ETH</span>
                    </div>

                    {ethPrice && (
                        <PriceDisplay ethAmount={balance} ethPrice={ethPrice} priceChange={priceChange} />
                    )}
                </>
            )}

            {/* Daily Limit Progress Bar */}
            {limitNum > 0 && (
                <div className="daily-limit-info">
                    <div className="limit-header">
                        <h4>📊 Daily Limit</h4>
                        <span className="limit-values">
                            <span style={{ color: limitColor }}>{spentNum.toFixed(4)}</span>
                            {' / '}
                            {limitNum.toFixed(4)} ETH
                        </span>
                    </div>
                    <div className="limit-bar-bg">
                        <div
                            className="limit-bar-fill"
                            style={{ width: `${spentPercent}%`, background: limitColor }}
                        ></div>
                    </div>
                    <div className="limit-stats">
                        <span className="label">Remaining:</span>
                        <span className="value remaining">{parseFloat(dailyLimit.remaining).toFixed(4)} ETH</span>
                    </div>
                </div>
            )}

            <div className="balance-actions">
                <button className="refresh-button" onClick={fetchBalance} title="Refresh balance">
                    🔄
                </button>
                <button
                    className="limit-button"
                    onClick={() => setShowLimitSetter(!showLimitSetter)}
                >
                    {showLimitSetter ? '✕ Close' : '📊 Set Limit'}
                </button>
                {parseFloat(balance) > 0 && (
                    <button
                        className="withdraw-button"
                        onClick={() => setShowWithdraw(!showWithdraw)}
                    >
                        {showWithdraw ? '✕ Close' : '💸 Withdraw'}
                    </button>
                )}
            </div>

            {showLimitSetter && (
                <form onSubmit={handleSetDailyLimit} className="limit-form">
                    <div className="form-group">
                        <label>Daily Limit (ETH)</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder="0.0"
                            value={newLimit}
                            onChange={(e) => setNewLimit(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="submit-button">
                        Set Limit
                    </button>
                </form>
            )}

            {showWithdraw && (
                <form onSubmit={handleWithdraw} className="withdraw-form">
                    <div className="form-group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder="0.0"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            disabled={withdrawing}
                            max={balance}
                            required
                        />
                        <p className="max-balance">
                            Max: {parseFloat(balance).toFixed(4)} ETH
                            <button
                                type="button"
                                className="max-btn"
                                onClick={() => setWithdrawAmount(parseFloat(balance).toFixed(4))}
                            >
                                MAX
                            </button>
                        </p>
                    </div>
                    <button type="submit" className="submit-button" disabled={withdrawing}>
                        {withdrawing ? '⏳ Processing...' : '💸 Withdraw'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default Balance;
