import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Card, Button, Badge } from './UI';

export default function AdminPanel({ contract, account }) {
    const [isOwner, setIsOwner] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [verifyAddress, setVerifyAddress] = useState('');
    const [kycStatusMsg, setKycStatusMsg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingOwner, setLoadingOwner] = useState(true);

    const [verifiedUsers, setVerifiedUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);

    const [newOwnerAddr, setNewOwnerAddr] = useState('');
    const [showTransfer, setShowTransfer] = useState(false);
    const [activityLog, setActivityLog] = useState([]);

    useEffect(() => {
        if (contract && account) {
            checkOwnership();
            checkPauseStatus();
        }
    }, [contract, account, isPaused]);

    useEffect(() => {
        if (isOwner && contract) {
            loadVerifiedUsers();
        }
    }, [isOwner, contract]);

    const checkOwnership = async () => {
        if (!contract || !account) return;
        setLoadingOwner(true);
        try {
            const owner = await contract.getOwner();
            setIsOwner(owner.toLowerCase() === account.toLowerCase());
        } catch (error) {
            console.error('Ownership check error:', error);
        } finally {
            setLoadingOwner(false);
        }
    };

    const checkPauseStatus = async () => {
        if (!contract) return;
        try {
            const paused = await contract.isPaused();
            setIsPaused(paused);
        } catch (error) {}
    };

    const loadVerifiedUsers = async () => {
        setUsersLoading(true);
        try {
            const verifiedFilter = contract.filters.UserVerified();
            const revokedFilter = contract.filters.VerificationRevoked();
            const [verifiedEvents, revokedEvents] = await Promise.all([
                contract.queryFilter(verifiedFilter),
                contract.queryFilter(revokedFilter)
            ]);

            const revokedSet = new Set(revokedEvents.map(e => e.args.user.toLowerCase()));
            const users = verifiedEvents
                .map(e => e.args.user)
                .filter(addr => !revokedSet.has(addr.toLowerCase()));

            const unique = [...new Set(users.map(a => a.toLowerCase()))];
            setVerifiedUsers(unique);
        } catch (err) {
            console.error('Verified users load error:', err);
            setVerifiedUsers([]);
        } finally {
            setUsersLoading(false);
        }
    };

    const addLog = (msg) => {
        setActivityLog(prev => [{ msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    };

    useEffect(() => {
        if (!contract || !verifyAddress || !ethers.isAddress(verifyAddress)) {
            setKycStatusMsg(null);
            return;
        }
        contract.isKYCVerified(verifyAddress).then(v => {
            setKycStatusMsg({ verified: v, addr: verifyAddress });
        }).catch(() => {});
    }, [verifyAddress, contract]);

    const handleVerifyUser = async () => {
        if (!verifyAddress || !ethers.isAddress(verifyAddress)) { toast.error('Invalid address'); return; }
        setLoading(true);
        try {
            const tx = await contract.verifyUser(verifyAddress);
            await tx.wait();
            toast.success('User verified!');
            addLog(`✓ Verified ${verifyAddress.slice(0, 6)}...`);
            setVerifyAddress('');
            loadVerifiedUsers();
        } catch (err) {
            toast.error(err.reason || 'Failed to verify');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeVerification = async () => {
        if (!verifyAddress || !ethers.isAddress(verifyAddress)) { toast.error('Invalid address'); return; }
        setLoading(true);
        try {
            const tx = await contract.revokeVerification(verifyAddress);
            await tx.wait();
            toast.success('Verification revoked!');
            addLog(`✗ Revoked ${verifyAddress.slice(0, 6)}...`);
            setVerifyAddress('');
            loadVerifiedUsers();
        } catch (err) {
            toast.error(err.reason || 'Failed to revoke');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePause = async () => {
        setLoading(true);
        try {
            const tx = isPaused ? await contract.unpause() : await contract.pause();
            await tx.wait();
            toast.success(isPaused ? 'Unpaused!' : 'Paused!');
            addLog(isPaused ? '▶️ Unpaused' : '⏸️ Paused');
            setIsPaused(!isPaused);
        } catch (err) {
            toast.error(err.reason || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    const handleTransferOwnership = async (e) => {
        e.preventDefault();
        if (!newOwnerAddr || !ethers.isAddress(newOwnerAddr)) { toast.error('Invalid address'); return; }
        setLoading(true);
        try {
            const tx = await contract.transferOwnership(newOwnerAddr);
            await tx.wait();
            toast.success('Ownership transferred!');
            setIsOwner(false);
        } catch (err) {
            toast.error(err.reason || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    if (loadingOwner) return <div className="text-secondary">Authenticating command access...</div>;

    if (!isOwner) {
        return (
            <Card title="Restricted Area">
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h3>Admin Privilege Required</h3>
                    <p className="text-secondary">Only the protocol owner can access the security command panel.</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="smart-grid">
            <div className="col-8">
                <Card title="🛡️ Protocol Security" action={
                    <Badge variant={isPaused ? "danger" : "success"}>
                        {isPaused ? "System Halted" : "System Live"}
                    </Badge>
                }>
                    <div className="smart-grid" style={{ marginBottom: '2rem' }}>
                        <div className="col-4">
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Verified Accounts</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{verifiedUsers.length}</div>
                        </div>
                        <div className="col-8" style={{ textAlign: 'right' }}>
                            <Button variant={isPaused ? "success" : "danger"} onClick={handleTogglePause} disabled={loading}>
                                {isPaused ? "▶️ Resume All Protocols" : "⏸️ Emergency Global Stop"}
                            </Button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className="text-secondary" style={{ fontSize: '0.8rem' }}>Identity Management (KYC)</label>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <input 
                                type="text" 
                                placeholder="Address 0x..." 
                                value={verifyAddress} 
                                onChange={e => setVerifyAddress(e.target.value)} 
                                style={{ flex: 1 }}
                            />
                            <Button variant="primary" onClick={handleVerifyUser} disabled={loading}>Grant</Button>
                            <Button variant="secondary" onClick={handleRevokeVerification} disabled={loading} style={{ color: 'var(--danger)' }}>Revoke</Button>
                        </div>
                        {kycStatusMsg && (
                            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: kycStatusMsg.verified ? 'var(--success)' : 'var(--text-secondary)' }}>
                                {kycStatusMsg.verified ? "✓ User currently authorized." : "○ User not currently authorized."}
                            </div>
                        )}
                    </div>

                    <div className="timeline-list">
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0 }}>Authorized User Registry</h4>
                            <Button onClick={loadVerifiedUsers} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>🔄 Refresh</Button>
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {verifiedUsers.map((addr, i) => (
                                <div key={addr} className="flex-between" style={{ background: 'var(--glass-bg)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span className="text-secondary" style={{ fontSize: '0.7rem' }}>#{i+1}</span>
                                        <code style={{ fontSize: '0.85rem' }}>{addr.slice(0, 18)}...{addr.slice(-4)}</code>
                                    </div>
                                    <Button onClick={() => setVerifyAddress(addr)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>Select</Button>
                                </div>
                            ))}
                            {verifiedUsers.length === 0 && <div className="text-secondary" style={{ textAlign: 'center', padding: '2rem' }}>No authorized users found.</div>}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="col-4">
                <Card title="🔑 Handover">
                    <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>Permanently transfer administrative control to a secondary cold wallet or community address.</p>
                    <Button variant="secondary" onClick={() => setShowTransfer(!showTransfer)} style={{ width: '100%', marginBottom: '1rem' }}>
                        {showTransfer ? 'Cancel Handover' : 'Initialize Transfer'}
                    </Button>
                    
                    {showTransfer && (
                        <form onSubmit={handleTransferOwnership}>
                            <input type="text" placeholder="New Controller Address" value={newOwnerAddr} onChange={e => setNewOwnerAddr(e.target.value)} required />
                            <p style={{ color: 'var(--danger)', fontSize: '0.7rem', margin: '0.75rem 0' }}>⚠️ Warning: This action is irreversible.</p>
                            <Button variant="primary" type="submit" disabled={loading} style={{ width: '100%', background: 'var(--danger)' }}>Confirm Ownership Shift</Button>
                        </form>
                    )}
                </Card>

                <Card title="📝 Activity Terminal" style={{ marginTop: '1.5rem' }}>
                    <div className="timeline-list">
                        {activityLog.map((log, idx) => (
                            <div key={idx} style={{ fontSize: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{log.msg}</span>
                                <span className="text-secondary">{log.time}</span>
                            </div>
                        ))}
                        {activityLog.length === 0 && <div className="text-secondary" style={{ fontSize: '0.75rem', textAlign: 'center' }}>No administrative events in this session.</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
}
