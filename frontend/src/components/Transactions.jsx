import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { format } from 'date-fns';

const PAGE_SIZE = 10;

function Transactions({ contract, refreshTrigger, addressBook, isUSD, ethPrice, account }) {
    const [transactions, setTransactions] = useState([]);
    const [filteredTxs, setFilteredTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter states
    const [filterType, setFilterType] = useState('all');
    const [filterScope, setFilterScope] = useState('mine'); // 'mine' or 'all'
    const [searchAddress, setSearchAddress] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    useEffect(() => {
        if (contract) {
            fetchTransactions();
        }
    }, [contract, refreshTrigger, filterScope]);

    useEffect(() => {
        applyFilters();
        setCurrentPage(1); // reset to page 1 on filter change
    }, [transactions, filterType, searchAddress, sortBy]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            // Use getMyTransactions for privacy when 'mine' scope
            let txs;
            try {
                txs = filterScope === 'mine'
                    ? await contract.getMyTransactions()
                    : await contract.getTransactions();
            } catch {
                // fallback if getMyTransactions not available on deployed contract
                txs = await contract.getTransactions();
            }

            const formattedTxs = txs.map((tx, index) => ({
                id: index,
                sender: tx.sender,
                receiver: tx.receiver,
                amount: ethers.formatEther(tx.amount),
                timestamp: Number(tx.timestamp),
                txType: Number(tx.txType),
            }));

            setTransactions(formattedTxs);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        if (filterType !== 'all') {
            const typeMap = { deposit: 0, payment: 1, withdrawal: 2 };
            filtered = filtered.filter(tx => tx.txType === typeMap[filterType]);
        }

        if (searchAddress) {
            const search = searchAddress.toLowerCase();
            filtered = filtered.filter(tx =>
                tx.sender.toLowerCase().includes(search) ||
                tx.receiver.toLowerCase().includes(search)
            );
        }

        if (sortBy === 'newest') filtered.sort((a, b) => b.timestamp - a.timestamp);
        else if (sortBy === 'oldest') filtered.sort((a, b) => a.timestamp - b.timestamp);
        else if (sortBy === 'highest') filtered.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
        else if (sortBy === 'lowest') filtered.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));

        setFilteredTxs(filtered);
    };

    const clearFilters = () => {
        setFilterType('all');
        setSearchAddress('');
        setSortBy('newest');
    };

    const formatAddress = (address) => {
        const addrMin = address.toLowerCase();
        if (addressBook[addrMin]) return addressBook[addrMin];
        return `${address.substring(0, 6)}...${address.substring(38)}`;
    };

    const exportToCSV = () => {
        const headers = ["Type,From,To,Amount (ETH),Date\n"];
        const rows = filteredTxs.map(tx => {
            const typeInfo = getTypeLabel(tx.txType);
            return `${typeInfo.label},${tx.sender},${tx.receiver},${tx.amount},${format(new Date(tx.timestamp * 1000), 'yyyy-MM-dd HH:mm')}`;
        });
        const blob = new Blob([headers + rows.join("\n")], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `transactions_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const getTypeLabel = (txType) => {
        if (txType === 0) return { label: '💳 Deposit', class: 'deposit' };
        if (txType === 1) return { label: '📤 Payment', class: 'payment' };
        if (txType === 2) return { label: '💸 Withdrawal', class: 'withdrawal' };
        return { label: 'Unknown', class: '' };
    };

    // Pagination
    const totalPages = Math.ceil(filteredTxs.length / PAGE_SIZE);
    const paginatedTxs = filteredTxs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="transactions-card">
            <div className="transactions-header">
                <h3>📜 Transaction History</h3>
                <div className="header-actions">
                    <button className="export-btn" onClick={exportToCSV} title="Export to CSV">
                        📥 Export CSV
                    </button>
                    <button className="refresh-button-small" onClick={fetchTransactions} title="Refresh">
                        🔄
                    </button>
                </div>
            </div>

            {/* Scope toggle - Segmented Pill */}
            <div className="ledger-scope-toggle">
                <button
                    className={`scope-btn ${filterScope === 'mine' ? 'active' : ''}`}
                    onClick={() => setFilterScope('mine')}
                >
                    👤 Personal
                </button>
                <button
                    className={`scope-btn ${filterScope === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterScope('all')}
                >
                    🌐 Global
                </button>
            </div>

            {/* Unified Filter Mesh */}
            <div className="unified-filter-mesh">
                <div className="filter-item">
                    <select
                        className="mesh-select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="all">🔍 All Types</option>
                        <option value="deposit">💳 Deposits</option>
                        <option value="payment">📤 Payments</option>
                        <option value="withdrawal">💸 Withdrawals</option>
                    </select>
                </div>

                <div className="filter-item" style={{ flex: 2 }}>
                    <input
                        type="text"
                        className="mesh-input"
                        placeholder="Search by address..."
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                    />
                </div>

                <div className="filter-item">
                    <select
                        className="mesh-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="newest">🕒 Newest</option>
                        <option value="oldest">⏳ Oldest</option>
                        <option value="highest">💰 Highest</option>
                        <option value="lowest">📉 Lowest</option>
                    </select>
                </div>

                {(filterType !== 'all' || searchAddress || sortBy !== 'newest') && (
                    <button className="clear-filters" onClick={clearFilters} style={{ padding: '0.5rem 1rem' }}>
                        ✕ Clear
                    </button>
                )}
            </div>

            {/* Loading skeleton */}
            {loading ? (
                <div className="skeleton-list">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="skeleton-row">
                            <div className="skeleton-cell short"></div>
                            <div className="skeleton-cell medium"></div>
                            <div className="skeleton-cell medium"></div>
                            <div className="skeleton-cell short"></div>
                            <div className="skeleton-cell long"></div>
                        </div>
                    ))}
                </div>
            ) : filteredTxs.length === 0 ? (
                <div className="empty-state">
                    <p>No transactions found</p>
                    <p className="empty-subtitle">
                        {transactions.length === 0
                            ? 'Make your first deposit or payment to get started'
                            : 'Try adjusting your filters'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="transaction-count">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTxs.length)} of {filteredTxs.length} transactions
                    </div>
                    <div className="transactions-table-container">
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTxs.map((tx) => {
                                    const typeInfo = getTypeLabel(tx.txType);
                                    const isDeposit = tx.txType === 0;
                                    const isPayment = tx.txType === 1;
                                    const isWithdrawal = tx.txType === 2;

                                    // Map colors to types: Green (Deposit), Orange (Payment), Red (Withdrawal)
                                    const amountColor = isDeposit ? 'var(--success)' : (isPayment ? '#ff9f0a' : 'var(--error)');
                                    const directionIcon = isDeposit ? 'received' : (isPayment ? 'payment' : 'sent');
                                    const amountPrefix = isDeposit ? '+' : '-';

                                    return (
                                        <tr key={tx.id} className="ledger-row">
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div className={`tx-direction-icon ${directionIcon}`}>
                                                        {isDeposit ? '↙' : '↗'}
                                                    </div>
                                                    <div>
                                                        <div className={`tx-type ${typeInfo.class}`} style={{ background: 'transparent', padding: 0 }}>
                                                            {typeInfo.label}
                                                        </div>
                                                        <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
                                                            <span className="ledger-status confirmed"></span> Confirmed
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="address">
                                                <span className="address-badge" onClick={() => navigator.clipboard.writeText(tx.sender)}>
                                                    {formatAddress(tx.sender)}
                                                </span>
                                            </td>
                                            <td className="address">
                                                <span className="address-badge" onClick={() => navigator.clipboard.writeText(tx.receiver)}>
                                                    {formatAddress(tx.receiver)}
                                                </span>
                                            </td>
                                            <td className="amount">
                                                <span style={{ color: amountColor, fontWeight: '800' }}>
                                                    {amountPrefix}
                                                    {isUSD
                                                        ? ` $ ${(parseFloat(tx.amount) * ethPrice).toLocaleString()}`
                                                        : ` ${parseFloat(tx.amount).toFixed(4)} ETH`
                                                    }
                                                </span>
                                            </td>
                                            <td className="timestamp">
                                                {format(new Date(tx.timestamp * 1000), 'MMM dd, HH:mm')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                ← Prev
                            </button>
                            <span className="page-info">Page {currentPage} of {totalPages}</span>
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default Transactions;
