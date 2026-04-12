import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function MultiSig({ contract, account, provider }) {
    const [coSigners, setCoSigners] = useState([]);
    const [threshold, setThreshold] = useState(0);
    const [newCoSigner, setNewCoSigner] = useState('');
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);

    // Proposal form
    const [showProposal, setShowProposal] = useState(false);
    const [proposalReceiver, setProposalReceiver] = useState('');
    const [proposalAmount, setProposalAmount] = useState('');
    const [showThresholdSetter, setShowThresholdSetter] = useState(false);
    const [newThreshold, setNewThreshold] = useState('');

    useEffect(() => {
        if (contract && account) {
            fetchMultiSigData();
            fetchProposals();
        }
    }, [contract, account]);

    const fetchMultiSigData = async () => {
        try {
            const [signers, thresh, verified] = await Promise.all([
                contract.getCoSigners(account),
                contract.getApprovalThreshold(account),
                contract.isKYCVerified(account)
            ]);
            setCoSigners(signers);
            setThreshold(Number(thresh));
            setKycVerified(verified);
        } catch (error) {
            console.error('Error fetching multi-sig data:', error);
        }
    };

    const fetchProposals = async () => {
        try {
            // Fetch MultiSigTxProposed events
            const filter = contract.filters.MultiSigTxProposed();
            const events = await contract.queryFilter(filter);

            // Map event data to proposal details
            const proposalsData = await Promise.all(events.map(async (event) => {
                const txId = event.args.txId;
                const details = await contract.getMultiSigTransaction(txId);

                // Only show proposals where current user is initiator or co-signer
                const initiator = details[0];
                const isInitiator = initiator.toLowerCase() === account.toLowerCase();

                let isCoSigner = false;
                if (!isInitiator) {
                    const initiatorCoSigners = await contract.getCoSigners(initiator);
                    isCoSigner = initiatorCoSigners.some(s => s.toLowerCase() === account.toLowerCase());
                }

                if (isInitiator || isCoSigner) {
                    return {
                        id: Number(txId),
                        initiator: details[0],
                        receiver: details[1],
                        amount: ethers.formatEther(details[2]),
                        approvalCount: Number(details[3]),
                        executed: details[4],
                        expiresAt: Number(details[5]),
                        isInitiator,
                        isCoSigner
                    };
                }
                return null;
            }));

            // Filter nulls and sort by newest
            setProposals(proposalsData.filter(Boolean).sort((a, b) => b.id - a.id));
        } catch (error) {
            console.error('Error fetching proposals:', error);
        }
    };

    const handleAddCoSigner = async (e) => {
        e.preventDefault();
        if (!kycVerified) {
            toast.error('You must be KYC verified to manage co-signers');
            return;
        }
        if (!ethers.isAddress(newCoSigner)) {
            toast.error('Invalid Ethereum address');
            return;
        }

        setLoading(true);
        try {
            const tx = await contract.addCoSigner(newCoSigner);
            toast.loading('Adding co-signer...');
            await tx.wait();
            toast.success('Co-signer added successfully!');
            setNewCoSigner('');
            fetchMultiSigData();
        } catch (error) {
            console.error('Error adding co-signer:', error);
            toast.error(error.reason || 'Failed to add co-signer');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveCoSigner = async (signer) => {
        setLoading(true);
        try {
            const tx = await contract.removeCoSigner(signer);
            toast.loading('Removing co-signer...');
            await tx.wait();
            toast.success('Co-signer removed!');
            fetchMultiSigData();
        } catch (error) {
            console.error('Error removing co-signer:', error);
            toast.error(error.reason || 'Failed to remove co-signer');
        } finally {
            setLoading(false);
        }
    };

    const handleProposeProposal = async (e) => {
        e.preventDefault();

        if (!ethers.isAddress(proposalReceiver)) {
            toast.error('Invalid receiver address');
            return;
        }

        setLoading(true);
        try {
            const amountWei = ethers.parseEther(proposalAmount);
            const tx = await contract.proposeMultiSigTransaction(proposalReceiver, amountWei);
            toast.loading('Creating proposal...');
            await tx.wait();
            toast.success('Transaction proposed! Waiting for approvals.');
            setProposalReceiver('');
            setProposalAmount('');
            setShowProposal(false);
            fetchProposals();
        } catch (error) {
            console.error('Error proposing transaction:', error);
            toast.error(error.reason || 'Failed to propose transaction');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateThreshold = async (e) => {
        e.preventDefault();
        const threshNum = parseInt(newThreshold);
        if (isNaN(threshNum) || threshNum <= 0 || threshNum > coSigners.length + 1) {
            toast.error(`Threshold must be between 1 and ${coSigners.length + 1}`);
            return;
        }

        setLoading(true);
        try {
            const tx = await contract.setApprovalThreshold(threshNum);
            toast.loading('Updating threshold...');
            await tx.wait();
            toast.success('Approval threshold updated!');
            setNewThreshold('');
            setShowThresholdSetter(false);
            fetchMultiSigData();
        } catch (error) {
            toast.error(error.reason || 'Failed to update threshold');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (txId) => {
        setLoading(true);
        try {
            const tx = await contract.approveMultiSigTransaction(txId);
            toast.loading('Approving transaction...');
            await tx.wait();
            toast.success('Transaction approved!');
            fetchProposals();
        } catch (error) {
            toast.error(error.reason || 'Failed to approve');
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async (txId) => {
        setLoading(true);
        try {
            const tx = await contract.executeMultiSigTransaction(txId);
            toast.loading('Executing transaction...');
            await tx.wait();
            toast.success('Transaction executed successfully!');
            fetchProposals();
        } catch (error) {
            toast.error(error.reason || 'Failed to execute');
        } finally {
            setLoading(false);
        }
    };

    const isExpired = (expiry) => {
        return Date.now() / 1000 > expiry;
    };

    return (
        <div className="multisig-card">
            <div className="analytics-header">
                <h3>🔐 Multi-Signature Wallet</h3>
                <button className="refresh-button-small" onClick={() => { fetchMultiSigData(); fetchProposals(); }}>
                    🔄
                </button>
            </div>

            {!kycVerified && (
                <div className="warning-banner" style={{ marginBottom: '1.5rem', background: 'rgba(246, 173, 85, 0.1)', border: '1px solid var(--warning)', color: 'var(--warning)', padding: '1rem', borderRadius: '10px' }}>
                    ⚠️ Your account is not KYC verified. You can only approve/execute transactions if you are a co-signer, but you cannot add co-signers or propose new transactions.
                </div>
            )}

            <div className="multisig-grid">
                <div className="multisig-section config-panel">
                    <h4>⚙️ Configuration</h4>
                    <div className="threshold-info">
                        <div className="current-threshold">
                            <span>Approval Goal: <strong>{threshold > 0 ? `${threshold} of ${coSigners.length + 1}` : 'Not Configured'}</strong></span>
                            <span>Total Signers: <strong>{coSigners.length + 1}</strong></span>
                        </div>
                        <button
                            className="text-btn"
                            onClick={() => setShowThresholdSetter(!showThresholdSetter)}
                            disabled={!kycVerified || coSigners.length === 0}
                        >
                            {showThresholdSetter ? '✕ Close' : '✏️ Set Threshold'}
                        </button>
                    </div>

                    {showThresholdSetter && (
                        <form onSubmit={handleUpdateThreshold} className="mini-form">
                            <input
                                type="number"
                                placeholder={`1 to ${coSigners.length + 1}`}
                                value={newThreshold}
                                onChange={(e) => setNewThreshold(e.target.value)}
                                required
                            />
                            <button type="submit">Update</button>
                        </form>
                    )}

                    <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <label>Add New Co-Signer</label>
                        <form onSubmit={handleAddCoSigner} className="input-group">
                            <input
                                type="text"
                                placeholder="0x... Co-signer address"
                                value={newCoSigner}
                                onChange={(e) => setNewCoSigner(e.target.value)}
                                disabled={loading || !kycVerified}
                            />
                            <button type="submit" className="submit-button-mini" disabled={loading || !kycVerified}>
                                {loading ? '⏳' : '➕ Add'}
                            </button>
                        </form>
                    </div>

                    <div className="cosigners-list">
                        <h5>Shared with ({coSigners.length})</h5>
                        {coSigners.length === 0 ? (
                            <p className="empty-text">No co-signers added yet.</p>
                        ) : (
                            coSigners.map((signer, index) => (
                                <div key={index} className="cosigner-item">
                                    <code>{signer.slice(0, 10)}...{signer.slice(-6)}</code>
                                    <button
                                        className="btn-icon-delete"
                                        onClick={() => handleRemoveCoSigner(signer)}
                                        disabled={loading || !kycVerified}
                                    >🗑️</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="multisig-section proposals-panel">
                    <div className="section-header">
                        <h4>📝 Active Proposals</h4>
                        <button
                            className="btn-primary-small"
                            onClick={() => setShowProposal(!showProposal)}
                            disabled={!kycVerified || coSigners.length === 0}
                        >
                            {showProposal ? '✕ Cancel' : '➕ New Proposal'}
                        </button>
                    </div>

                    {showProposal && (
                        <form onSubmit={handleProposeProposal} className="proposal-form-box">
                            <div className="form-group">
                                <label>Recipient</label>
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    value={proposalReceiver}
                                    onChange={(e) => setProposalReceiver(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Amount (ETH)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={proposalAmount}
                                    onChange={(e) => setProposalAmount(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="submit-button">Submit Proposal</button>
                        </form>
                    )}

                    <div className="proposals-list">
                        {proposals.length === 0 ? (
                            <div className="empty-state-proposals">
                                <p>No multi-sig proposals found.</p>
                            </div>
                        ) : (
                            proposals.map(p => {
                                const expired = isExpired(p.expiresAt);
                                const canExecute = p.approvalCount >= threshold && !p.executed && !expired;

                                return (
                                    <div key={p.id} className={`proposal-item ${p.executed ? 'executed' : ''} ${expired ? 'expired' : ''}`}>
                                        <div className="proposal-header">
                                            <span className="tx-id">TX #{p.id}</span>
                                            <span className={`status-pill ${p.executed ? 'executed' : expired ? 'expired' : 'active'}`}>
                                                {p.executed ? 'Executed' : expired ? 'Expired' : 'Pending'}
                                            </span>
                                        </div>
                                        <div className="proposal-body">
                                            <div className="prop-row">
                                                <span className="prop-label">To:</span>
                                                <code>{p.receiver}</code>
                                            </div>
                                            <div className="prop-row">
                                                <span className="prop-label">Value:</span>
                                                <span className="prop-value">{p.amount} ETH</span>
                                            </div>
                                            <div className="prop-row">
                                                <span className="prop-label">Signatures:</span>
                                                <span className="prop-value">{p.approvalCount} / {threshold}</span>
                                            </div>
                                        </div>
                                        <div className="proposal-footer">
                                            {!p.executed && !expired && (
                                                <div className="action-btns">
                                                    <button
                                                        className="approve-btn"
                                                        onClick={() => handleApprove(p.id)}
                                                        disabled={loading}
                                                    >👍 Approve</button>
                                                    {canExecute && (
                                                        <button
                                                            className="execute-btn"
                                                            onClick={() => handleExecute(p.id)}
                                                            disabled={loading}
                                                        >🚀 Execute</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MultiSig;
