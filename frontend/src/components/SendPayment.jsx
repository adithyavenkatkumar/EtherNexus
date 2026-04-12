import { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import GasEstimator from './GasEstimator';

function SendPayment({ contract, account, provider, onTransactionComplete, setProcessingTx, addressBook, ethPrice }) {
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('deposit');
    const [addressError, setAddressError] = useState('');

    // Live address validation
    const validateRecipient = (value) => {
        setRecipient(value);
        if (!value) { setAddressError(''); return; }

        // Check if it's a saved contact name
        const aliasEntry = Object.entries(addressBook).find(
            ([, name]) => name.toLowerCase() === value.toLowerCase()
        );
        if (aliasEntry) { setAddressError(''); return; }

        if (!ethers.isAddress(value)) {
            setAddressError('⚠️ Invalid Ethereum address');
        } else {
            setAddressError('');
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();

        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setLoading(true);
        try {
            const amountWei = ethers.parseEther(amount);
            const tx = await contract.deposit({ value: amountWei });

            setProcessingTx({ hash: tx.hash, status: 'Confirming...' });
            await tx.wait();

            toast.success(`Successfully deposited ${amount} ETH!`);
            setAmount('');
            onTransactionComplete(tx.hash);
        } catch (err) {
            console.error('Deposit error:', err);
            toast.error(err.reason || 'Deposit failed. Please try again.');
            setProcessingTx(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSendPayment = async (e) => {
        e.preventDefault();

        // Resolve alias
        let targetAddr = recipient;
        const aliasEntry = Object.entries(addressBook).find(
            ([, name]) => name.toLowerCase() === recipient.toLowerCase()
        );
        if (aliasEntry) {
            targetAddr = aliasEntry[0];
        }

        if (!targetAddr || !ethers.isAddress(targetAddr)) {
            toast.error('Please enter a valid Ethereum address or saved contact name');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (targetAddr.toLowerCase() === account.toLowerCase()) {
            toast.error('Cannot send payment to yourself');
            return;
        }

        setLoading(true);
        try {
            const amountWei = ethers.parseEther(amount);
            const tx = await contract.sendPayment(targetAddr, { value: amountWei });

            setProcessingTx({ hash: tx.hash, status: 'Confirming...' });
            await tx.wait();

            toast.success(`Successfully sent ${amount} ETH to ${recipient}!`);
            setRecipient('');
            setAmount('');
            setAddressError('');
            onTransactionComplete(tx.hash);
        } catch (err) {
            console.error('Payment error:', err);
            toast.error(err.reason || 'Payment failed. Please try again.');
            setProcessingTx(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="payment-card">
            <div className="tab-buttons">
                <button
                    className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('deposit')}
                >
                    💳 Deposit
                </button>
                <button
                    className={`tab-button ${activeTab === 'send' ? 'active' : ''}`}
                    onClick={() => setActiveTab('send')}
                >
                    📤 Send Payment
                </button>
            </div>

            {activeTab === 'deposit' ? (
                <form onSubmit={handleDeposit} className="payment-form">
                    <h3>Deposit ETH</h3>
                    <div className="form-group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={loading}
                            required
                        />
                        {amount && parseFloat(amount) > 0 && (
                            <span className="usd-hint">
                                ≈ ${(parseFloat(amount) * ethPrice).toFixed(2)} USD
                            </span>
                        )}
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                        <GasEstimator contract={contract} provider={provider} transactionType="deposit" amount={amount} ethPrice={ethPrice} />
                    )}

                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? '⏳ Processing...' : '💰 Deposit ETH'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSendPayment} className="payment-form">
                    <h3>Send Payment</h3>
                    <div className="form-group">
                        <label>Recipient Address or Name</label>
                        <input
                            type="text"
                            placeholder="0x... or saved contact name"
                            value={recipient}
                            onChange={(e) => validateRecipient(e.target.value)}
                            disabled={loading}
                            required
                            className={addressError ? 'input-error' : ''}
                        />
                        {addressError && (
                            <span className="field-error">{addressError}</span>
                        )}
                        {Object.keys(addressBook).length > 0 && (
                            <div className="contact-suggestions">
                                {Object.entries(addressBook)
                                    .filter(([, name]) => name.toLowerCase().includes(recipient.toLowerCase()) && recipient)
                                    .slice(0, 3)
                                    .map(([addr, name]) => (
                                        <button
                                            key={addr}
                                            type="button"
                                            className="contact-suggestion-btn"
                                            onClick={() => { setRecipient(name); setAddressError(''); }}
                                        >
                                            {name} — {addr.slice(0, 6)}...{addr.slice(-4)}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={loading}
                            required
                        />
                        {amount && parseFloat(amount) > 0 && (
                            <span className="usd-hint">
                                ≈ ${(parseFloat(amount) * ethPrice).toFixed(2)} USD
                            </span>
                        )}
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                        <GasEstimator contract={contract} provider={provider} transactionType="payment" amount={amount} ethPrice={ethPrice} />
                    )}

                    <button type="submit" className="submit-button" disabled={loading || !!addressError}>
                        {loading ? '⏳ Processing...' : '📤 Send Payment'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default SendPayment;
