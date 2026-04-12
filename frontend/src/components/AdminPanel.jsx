import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

/**
 * AdminPanel Component - Restricted to the contract owner.
 * Allows managing KYC verification statuses, pausing the contract in emergencies,
 * and tracking system activity.
 * 
 * @param {Object} props
 * @param {ethers.Contract} props.contract - The smart contract instance
 * @param {string} props.account - The connected admin account address
 */
export default function AdminPanel({ contract, account }) {
    const [isOwner, setIsOwner] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [verifyAddress, setVerifyAddress] = useState('');
    const [kycStatusMsg, setKycStatusMsg] = useState(null); // { verified: bool, addr: string }
    const [loading, setLoading] = useState(false);
    const [loadingOwner, setLoadingOwner] = useState(true);

    // KYC users list - tracked from events
    const [verifiedUsers, setVerifiedUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // Ownership transfer
    const [newOwnerAddr, setNewOwnerAddr] = useState('');
    const [showTransfer, setShowTransfer] = useState(false);

    // Activity log
    const [activityLog, setActivityLog] = useState([]);

    useEffect(() => {
        if (contract && account) {
            checkOwnership();
            checkPauseStatus();
        }
    }, [contract, account]);

    // Once we know they're owner, load additional data
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
            console.error('Error checking ownership:', error);
        } finally {
            setLoadingOwner(false);
        }
    };

    const checkPauseStatus = async () => {
        if (!contract) return;
        try {
            const paused = await contract.isPaused();
            setIsPaused(paused);
        } catch (error) {
            console.error('Error checking pause status:', error);
        }
    };

    // Load KYC-verified users from event logs
    const loadVerifiedUsers = async () => {
        setUsersLoading(true);
        try {
            // Query UserVerified events
            const verifiedFilter = contract.filters.UserVerified();
            const revokedFilter = contract.filters.VerificationRevoked();

            const verifiedEvents = await contract.queryFilter(verifiedFilter);
            const revokedEvents = await contract.queryFilter(revokedFilter);

            // Build set of verified addresses minus revoked
            const revokedSet = new Set(revokedEvents.map(e => e.args.user.toLowerCase()));
            const users = verifiedEvents
                .map(e => e.args.user)
                .filter(addr => !revokedSet.has(addr.toLowerCase()));

            // Deduplicate
            const unique = [...new Set(users.map(a => a.toLowerCase()))].map(
                a => verifiedEvents.find(e => e.args.user.toLowerCase() === a)?.args.user
            );

            setVerifiedUsers(unique.filter(Boolean));
        } catch (err) {
            console.error('Error loading verified users:', err);
            setVerifiedUsers([]);
        } finally {
            setUsersLoading(false);
        }
    };

    const addLog = (msg) => {
        setActivityLog(prev => [{ msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    };

    // Live KYC status check as user types a valid address
    useEffect(() => {
        if (!contract || !verifyAddress || !ethers.isAddress(verifyAddress)) {
            setKycStatusMsg(null);
            return;
        }
        let cancelled = false;
        contract.isKYCVerified(verifyAddress).then(v => {
            if (!cancelled) setKycStatusMsg({ verified: v, addr: verifyAddress });
        }).catch(() => { });
        return () => { cancelled = true; };
    }, [verifyAddress, contract]);

    const handleVerifyUser = async () => {
        if (!verifyAddress || !ethers.isAddress(verifyAddress)) {
            toast.error('Please enter a valid Ethereum address');
            return;
        }
        setLoading(true);
        try {
            const tx = await contract.verifyUser(verifyAddress);
            toast.loading('Verifying user...', { id: 'verify' });
            await tx.wait();
            toast.success(`✓ ${verifyAddress.slice(0, 6)}...${verifyAddress.slice(-4)} verified!`, { id: 'verify' });
            addLog(`✓ Verified ${verifyAddress.slice(0, 6)}...${verifyAddress.slice(-4)}`);
            setVerifyAddress('');
            setKycStatusMsg(null);
            loadVerifiedUsers();
        } catch (error) {
            toast.error(error.reason || 'Failed to verify user', { id: 'verify' });
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeVerification = async () => {
        if (!verifyAddress || !ethers.isAddress(verifyAddress)) {
            toast.error('Please enter a valid Ethereum address');
            return;
        }
        setLoading(true);
        try {
            const tx = await contract.revokeVerification(verifyAddress);
            toast.loading('Revoking verification...', { id: 'revoke' });
            await tx.wait();
            toast.success(`✗ Verification revoked for ${verifyAddress.slice(0, 6)}...${verifyAddress.slice(-4)}`, { id: 'revoke' });
            addLog(`✗ Revoked ${verifyAddress.slice(0, 6)}...${verifyAddress.slice(-4)}`);
            setVerifyAddress('');
            setKycStatusMsg(null);
            loadVerifiedUsers();
        } catch (error) {
            toast.error(error.reason || 'Failed to revoke verification', { id: 'revoke' });
        } finally {
            setLoading(false);
        }
    };

    const handlePause = async () => {
        setLoading(true);
        try {
            const tx = await contract.pause();
            toast.loading('Pausing contract...', { id: 'pause' });
            await tx.wait();
            toast.success('Contract paused!', { id: 'pause' });
            addLog('⏸️ Contract paused');
            setIsPaused(true);
        } catch (error) {
            toast.error(error.reason || 'Failed to pause contract', { id: 'pause' });
        } finally {
            setLoading(false);
        }
    };

    const handleUnpause = async () => {
        setLoading(true);
        try {
            const tx = await contract.unpause();
            toast.loading('Unpausing contract...', { id: 'unpause' });
            await tx.wait();
            toast.success('Contract unpaused!', { id: 'unpause' });
            addLog('▶️ Contract unpaused');
            setIsPaused(false);
        } catch (error) {
            toast.error(error.reason || 'Failed to unpause contract', { id: 'unpause' });
        } finally {
            setLoading(false);
        }
    };

    const handleTransferOwnership = async (e) => {
        e.preventDefault();
        if (!newOwnerAddr || !ethers.isAddress(newOwnerAddr)) {
            toast.error('Please enter a valid Ethereum address');
            return;
        }
        if (newOwnerAddr.toLowerCase() === account.toLowerCase()) {
            toast.error('New owner must be a different address');
            return;
        }
        setLoading(true);
        try {
            const tx = await contract.transferOwnership(newOwnerAddr);
            toast.loading('Transferring ownership...', { id: 'transfer' });
            await tx.wait();
            toast.success(`Ownership transferred to ${newOwnerAddr.slice(0, 6)}...${newOwnerAddr.slice(-4)}!`, { id: 'transfer' });
            addLog(`🔑 Ownership → ${newOwnerAddr.slice(0, 6)}...${newOwnerAddr.slice(-4)}`);
            setNewOwnerAddr('');
            setShowTransfer(false);
            setIsOwner(false); // loses owner access after transfer
        } catch (error) {
            toast.error(error.reason || 'Failed to transfer ownership', { id: 'transfer' });
        } finally {
            setLoading(false);
        }
    };

    if (loadingOwner) {
        return (
            <div className="admin-card">
                <div className="skeleton-list">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton-row" style={{ gridTemplateColumns: '1fr 2fr' }}>
                            <div className="skeleton-cell short"></div>
                            <div className="skeleton-cell medium"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="admin-card">
                <div className="access-denied">
                    <div className="access-denied-icon">🔒</div>
                    <h2>Admin Access Required</h2>
                    <p>Only the contract owner can access this panel.</p>
                    <p className="owner-hint">
                        Connected: <code>{account?.slice(0, 6)}...{account?.slice(-4)}</code>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-card security-card">
            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="shield-icon" style={{ fontSize: '2rem', animation: 'float 3s infinite ease-in-out' }}>🛡️</div>
                    <h2>Admin Security Command</h2>
                </div>
                <span className={`status-badge ${isPaused ? 'paused' : 'active'}`}>
                    {isPaused ? '⏸️ PAUSED' : '✅ ACTIVE'}
                </span>
            </div>

            {/* Stats Bar */}
            <div className="admin-stats-bar">
                <div className="admin-stat">
                    <span className="admin-stat-value">{verifiedUsers.length}</span>
                    <span className="admin-stat-label">KYC Verified Users</span>
                </div>
                <div className="admin-stat">
                    <span className="admin-stat-value" style={{ color: isPaused ? 'var(--error)' : 'var(--success)' }}>
                        {isPaused ? 'Frozen' : 'Live'}
                    </span>
                    <span className="admin-stat-label">Contract State</span>
                </div>
                <div className="admin-stat">
                    <span className="admin-stat-value">{activityLog.length}</span>
                    <span className="admin-stat-label">Actions Today</span>
                </div>
            </div>

            {/* Emergency Controls */}
            <div className="admin-section emergency-controls">
                <h3>🚨 Emergency Controls</h3>
                <div className="button-group">
                    <button onClick={handlePause} disabled={loading || isPaused} className="btn-danger">
                        ⏸️ Pause Contract
                    </button>
                    <button onClick={handleUnpause} disabled={loading || !isPaused} className="btn-success">
                        ▶️ Unpause Contract
                    </button>
                </div>
                <p className="warning-text">⚠️ Pausing will freeze all deposits, payments, and withdrawals.</p>
            </div>

            {/* KYC Management */}
            <div className="admin-section kyc-management">
                <h3>👤 KYC Management</h3>
                <div className="form-group">
                    <label>User Address</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={verifyAddress}
                        onChange={(e) => setVerifyAddress(e.target.value.trim())}
                        className={verifyAddress && !ethers.isAddress(verifyAddress) ? 'input-error' : ''}
                    />
                    {/* Live KYC status indicator */}
                    {kycStatusMsg && (
                        <div className={`kyc-live-status ${kycStatusMsg.verified ? 'kyc-ok' : 'kyc-no'}`}>
                            {kycStatusMsg.verified
                                ? '✓ This address is currently KYC verified'
                                : '✗ This address is NOT yet KYC verified'}
                        </div>
                    )}
                </div>
                <div className="button-group">
                    <button onClick={handleVerifyUser} disabled={loading || !verifyAddress} className="btn-primary">
                        ✓ Verify User
                    </button>
                    <button onClick={handleRevokeVerification} disabled={loading || !verifyAddress} className="btn-warning">
                        ✗ Revoke KYC
                    </button>
                </div>
            </div>

            {/* Verified Users List */}
            <div className="admin-section">
                <div className="verified-header">
                    <h3>📋 KYC Verified Users ({verifiedUsers.length})</h3>
                    <button className="refresh-button-small" onClick={loadVerifiedUsers} title="Refresh list">
                        🔄
                    </button>
                </div>
                {usersLoading ? (
                    <div className="skeleton-list">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="skeleton-row" style={{ gridTemplateColumns: '3fr 1fr' }}>
                                <div className="skeleton-cell long"></div>
                                <div className="skeleton-cell short"></div>
                            </div>
                        ))}
                    </div>
                ) : verifiedUsers.length === 0 ? (
                    <p className="empty-state">No verified users yet. Verify a user above to get started.</p>
                ) : (
                    <div className="verified-users-list">
                        {verifiedUsers.map((addr, i) => (
                            <div key={addr} className="verified-user-item">
                                <div className="verified-user-info">
                                    <span className="verified-index">#{i + 1}</span>
                                    <code className="verified-addr">{addr.slice(0, 10)}...{addr.slice(-6)}</code>
                                    <span className="verified-badge">✓ KYC</span>
                                </div>
                                <div className="verified-user-actions">
                                    <button
                                        className="copy-btn"
                                        onClick={() => navigator.clipboard.writeText(addr)}
                                        title="Copy address"
                                    >📋</button>
                                    <button
                                        className="delete-contact-btn"
                                        onClick={() => { setVerifyAddress(addr); }}
                                        title="Select for revoke"
                                    >→</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Ownership Transfer */}
            <div className="admin-section">
                <div className="verified-header">
                    <h3>🔑 Ownership Transfer</h3>
                    <button
                        className={`scope-btn ${showTransfer ? 'active' : ''}`}
                        style={{ flex: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        onClick={() => setShowTransfer(v => !v)}
                    >
                        {showTransfer ? '✕ Cancel' : '⚠️ Transfer'}
                    </button>
                </div>
                {showTransfer && (
                    <form onSubmit={handleTransferOwnership} className="transfer-form">
                        <div className="warning-text" style={{ marginBottom: '1rem' }}>
                            ⚠️ <strong>This is irreversible!</strong> You will lose admin access immediately.
                        </div>
                        <div className="form-group">
                            <label>New Owner Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={newOwnerAddr}
                                onChange={(e) => setNewOwnerAddr(e.target.value.trim())}
                                required
                                className={newOwnerAddr && !ethers.isAddress(newOwnerAddr) ? 'input-error' : ''}
                            />
                            {newOwnerAddr && !ethers.isAddress(newOwnerAddr) && (
                                <span className="field-error">Invalid Ethereum address</span>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="btn-danger"
                            disabled={loading || !newOwnerAddr || !ethers.isAddress(newOwnerAddr)}
                            style={{ width: '100%' }}
                        >
                            {loading ? '⏳ Processing...' : '🔑 Transfer Ownership'}
                        </button>
                    </form>
                )}
            </div>

            {/* Activity Log */}
            {activityLog.length > 0 && (
                <div className="admin-section">
                    <h3>📝 Session Activity Log</h3>
                    <div className="activity-log">
                        {activityLog.map((entry, i) => (
                            <div key={i} className="log-entry">
                                <span className="log-time">{entry.time}</span>
                                <span className="log-msg">{entry.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
