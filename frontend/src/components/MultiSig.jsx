import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Card, Button, Badge } from './UI';

function MultiSig({ contract, account, provider }) {
    const [coSigners, setCoSigners] = useState([]);
    const [threshold, setThreshold] = useState(0);
    const [newCoSigner, setNewCoSigner] = useState('');
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [kycVerified, setKycVerified] = useState(false);

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
            const filter = contract.filters.MultiSigTxProposed();
            const events = await contract.queryFilter(filter);

            const proposalsData = await Promise.all(events.map(async (event) => {
                const txId = event.args.txId;
                const details = await contract.getMultiSigTransaction(txId);
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
                        initiator,
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
            setProposals(proposalsData.filter(Boolean).sort((a, b) => b.id - a.id));
        } catch (error) {
            console.error('Error fetching proposals:', error);
        }
    };

    const handleAddCoSigner = async (e) => {
        e.preventDefault();
        if (!kycVerified) { toast.error('KYC required'); return; }
        if (!ethers.isAddress(newCoSigner)) { toast.error('Invalid address'); return; }
        setLoading(true);
        try {
            const tx = await contract.addCoSigner(newCoSigner);
            await tx.wait();
            toast.success('Co-signer added!');
            setNewCoSigner('');
            fetchMultiSigData();
        } catch (err) {
            toast.error(err.reason || 'Failed to add co-signer');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveCoSigner = async (signer) => {
        setLoading(true);
        try {
            const tx = await contract.removeCoSigner(signer);
            await tx.wait();
            toast.success('Co-signer removed!');
            fetchMultiSigData();
        } catch (err) {
            toast.error(err.reason || 'Failed to remove');
        } finally {
            setLoading(false);
        }
    };

    const handleProposeProposal = async (e) => {
        e.preventDefault();
        if (!ethers.isAddress(proposalReceiver)) { toast.error('Invalid receiver'); return; }
        setLoading(true);
        try {
            const amountWei = ethers.parseEther(proposalAmount);
            const tx = await contract.proposeMultiSigTransaction(proposalReceiver, amountWei);
            await tx.wait();
            toast.success('Transaction proposed!');
            setProposalReceiver('');
            setProposalAmount('');
            setShowProposal(false);
            fetchProposals();
        } catch (err) {
            toast.error(err.reason || 'Failed to propose');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateThreshold = async (e) => {
        e.preventDefault();
        const threshNum = parseInt(newThreshold);
        if (isNaN(threshNum) || threshNum <= 0 || threshNum > coSigners.length + 1) {
            toast.error(`Invalid threshold`);
            return;
        }
        setLoading(true);
        try {
            const tx = await contract.setApprovalThreshold(threshNum);
            await tx.wait();
            toast.success('Threshold updated!');
            setNewThreshold('');
            setShowThresholdSetter(false);
            fetchMultiSigData();
        } catch (err) {
            toast.error(err.reason || 'Failed to update');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (txId) => {
        setLoading(true);
        try {
            const tx = await contract.approveMultiSigTransaction(txId);
            await tx.wait();
            toast.success('Approved!');
            fetchProposals();
        } catch (err) {
            toast.error(err.reason || 'Failed to approve');
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async (txId) => {
        setLoading(true);
        try {
            const tx = await contract.executeMultiSigTransaction(txId);
            await tx.wait();
            toast.success('Executed!');
            fetchProposals();
        } catch (err) {
            toast.error(err.reason || 'Failed to execute');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="smart-grid">
            <div className="col-4">
                <Card title="🔐 Vault Config">
                    {!kycVerified && (
                        <div style={{ background: 'rgba(255, 77, 109, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
                            ⚠️ KYC Restricted: Verification required to manage vault.
                        </div>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                        <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Approval Threshold</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>
                            {threshold} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>of {coSigners.length + 1} Signers</span>
                        </div>
                        <Button 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} 
                            onClick={() => setShowThresholdSetter(!showThresholdSetter)}
                            disabled={!kycVerified || coSigners.length === 0}
                        >
                            Change Mask
                        </Button>
                    </div>

                    {showThresholdSetter && (
                        <form onSubmit={handleUpdateThreshold} style={{ marginBottom: '1.5rem' }}>
                            <input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} placeholder="Threshold" style={{ marginBottom: '0.5rem' }} />
                            <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={loading}>Update</Button>
                        </form>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                        <div className="text-secondary" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>Co-Signers</div>
                        <div className="timeline-list">
                            {coSigners.map((signer, idx) => (
                                <div key={idx} className="flex-between" style={{ background: 'var(--glass-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{signer.slice(0, 6)}...{signer.slice(-4)}</span>
                                    <button onClick={() => handleRemoveCoSigner(signer)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                                </div>
                            ))}
                            {coSigners.length === 0 && <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Only your address signed.</div>}
                        </div>
                    </div>

                    <form onSubmit={handleAddCoSigner}>
                        <label className="text-secondary" style={{ fontSize: '0.8rem' }}>Invite Co-Signer</label>
                        <input 
                            type="text" 
                            placeholder="0x..." 
                            value={newCoSigner} 
                            onChange={e => setNewCoSigner(e.target.value)} 
                            disabled={!kycVerified}
                            style={{ margin: '0.5rem 0' }}
                        />
                        <Button variant="secondary" type="submit" disabled={!kycVerified || loading} style={{ width: '100%' }}>Add Partner</Button>
                    </form>
                </Card>
            </div>

            <div className="col-8">
                <Card title="📝 Voting Proposals" action={
                    <Button variant="primary" onClick={() => setShowProposal(!showProposal)} disabled={!kycVerified || coSigners.length === 0}>
                        {showProposal ? '✕ Cancel' : '+ Propose'}
                    </Button>
                }>
                    {showProposal && (
                        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)' }}>
                            <form onSubmit={handleProposeProposal} className="smart-grid">
                                <div className="col-8">
                                    <input type="text" placeholder="Recipient 0x..." value={proposalReceiver} onChange={e => setProposalReceiver(e.target.value)} required />
                                </div>
                                <div className="col-4">
                                    <input type="number" step="0.0001" placeholder="ETH" value={proposalAmount} onChange={e => setProposalAmount(e.target.value)} required />
                                </div>
                                <div className="col-12" style={{ marginTop: '1rem' }}>
                                    <Button variant="primary" type="submit" style={{ width: '100%' }}>Launch Proposal</Button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="timeline-list">
                        {proposals.map(p => {
                            const expired = Date.now() / 1000 > p.expiresAt;
                            const progress = (p.approvalCount / threshold) * 100;
                            return (
                                <div key={p.id} className="timeline-item" style={{ opacity: p.executed || expired ? 0.6 : 1 }}>
                                    <div className="timeline-itemIcon" style={{ background: p.executed ? 'var(--success)1A' : 'var(--primary)1A' }}>
                                        {p.executed ? '✅' : '📦'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="flex-between">
                                            <div style={{ fontWeight: 700 }}>Withdrawal Proposal #{p.id}</div>
                                            <Badge variant={p.executed ? "success" : (expired ? "danger" : "primary")}>
                                                {p.executed ? "Executed" : (expired ? "Expired" : "Pending")}
                                            </Badge>
                                        </div>
                                        <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Target: {p.receiver.slice(0, 10)}...</div>
                                            <div style={{ fontWeight: 800 }}>{p.amount} ETH</div>
                                        </div>
                                        
                                        <div style={{ marginTop: '1rem' }}>
                                            <div className="flex-between" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                                <span>Approvals: {p.approvalCount}/{threshold}</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>
                                            </div>
                                        </div>

                                        {!p.executed && !expired && (
                                            <div className="flex-between gap-1" style={{ marginTop: '1.5rem' }}>
                                                <Button variant="secondary" onClick={() => handleApprove(p.id)} disabled={loading} style={{ flex: 1 }}>👍 Approve</Button>
                                                {p.approvalCount >= threshold && (
                                                    <Button variant="primary" onClick={() => handleExecute(p.id)} disabled={loading} style={{ flex: 1 }}>🚀 Execute</Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {proposals.length === 0 && <div style={{ textAlign: 'center', padding: '4rem 1rem' }} className="text-secondary">No active proposals found in history.</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default MultiSig;
