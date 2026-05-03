import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { format } from 'date-fns';
import { Card, Button, Badge } from './UI';

const PAGE_SIZE = 8;
const TYPE_MAP = { deposit: 0, payment: 1, withdrawal: 2 };
const TYPE_LABEL = ['Deposit', 'Payment', 'Withdrawal'];
const TYPE_BADGE = ['success', 'primary', 'danger'];
const TYPE_SIGN  = ['+', '−', '−'];
const TYPE_COLOR = ['var(--green)', 'var(--blue)', 'var(--red)'];

function Transactions({ contract, refreshTrigger, addressBook, isUSD, ethPrice, account }) {
    const [transactions, setTransactions]   = useState([]);
    const [filteredTxs, setFilteredTxs]     = useState([]);
    const [loading, setLoading]             = useState(true);
    const [currentPage, setCurrentPage]     = useState(1);
    const [filterType, setFilterType]       = useState('all');
    const [filterScope, setFilterScope]     = useState('mine');
    const [searchAddress, setSearchAddress] = useState('');
    const [sortBy, setSortBy]               = useState('newest');

    useEffect(() => { if (contract) fetchTransactions(); }, [contract, refreshTrigger, filterScope]);
    useEffect(() => { applyFilters(); setCurrentPage(1); }, [transactions, filterType, searchAddress, sortBy]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            let txs;
            try { txs = filterScope === 'mine' ? await contract.getMyTransactions() : await contract.getTransactions(); }
            catch { txs = await contract.getTransactions(); }
            setTransactions(txs.map((tx, i) => ({
                id: i,
                sender: tx.sender, receiver: tx.receiver,
                amount: ethers.formatEther(tx.amount),
                timestamp: Number(tx.timestamp), txType: Number(tx.txType),
            })));
        } catch { setTransactions([]); }
        finally { setLoading(false); }
    };

    const applyFilters = () => {
        let f = [...transactions];
        if (filterType !== 'all') f = f.filter(tx => tx.txType === TYPE_MAP[filterType]);
        if (searchAddress) {
            const s = searchAddress.toLowerCase();
            f = f.filter(tx => tx.sender.toLowerCase().includes(s) || tx.receiver.toLowerCase().includes(s));
        }
        if (sortBy === 'newest')  f.sort((a,b) => b.timestamp - a.timestamp);
        else if (sortBy === 'oldest')  f.sort((a,b) => a.timestamp - b.timestamp);
        else if (sortBy === 'highest') f.sort((a,b) => parseFloat(b.amount) - parseFloat(a.amount));
        else if (sortBy === 'lowest')  f.sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount));
        setFilteredTxs(f);
    };

    const fmtAddr = (addr) => {
        const key = addr.toLowerCase();
        if (addressBook[key]) return addressBook[key];
        return `${addr.slice(0,6)}…${addr.slice(-4)}`;
    };

    const fmtAmount = (tx) => {
        const n = parseFloat(tx.amount);
        const sign = TYPE_SIGN[tx.txType] || '';
        if (isUSD) return `${sign}$${(n * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        return `${sign}${n.toFixed(4)} ETH`;
    };

    const exportCSV = () => {
        const rows = filteredTxs.map(tx =>
            `${TYPE_LABEL[tx.txType]},${tx.sender},${tx.receiver},${tx.amount},${format(new Date(tx.timestamp*1000),'yyyy-MM-dd HH:mm')}`
        );
        const blob = new Blob(['Type,From,To,Amount (ETH),Date\n' + rows.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `transactions_${format(new Date(),'yyyyMMdd')}.csv`; a.click();
    };

    const totalPages   = Math.ceil(filteredTxs.length / PAGE_SIZE);
    const paginatedTxs = filteredTxs.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);

    return (
        <Card
            title="Recent Transactions"
            action={
                <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV}>↓ CSV</button>
                    <button className="btn btn-secondary btn-sm" onClick={fetchTransactions}>⟳</button>
                </div>
            }
        >
            {/* Filters */}
            <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
                <div className="seg-control">
                    <button className={`seg-btn${filterScope==='mine'?' active':''}`} onClick={()=>setFilterScope('mine')}>Mine</button>
                    <button className={`seg-btn${filterScope==='all'?' active':''}`}  onClick={()=>setFilterScope('all')}>Global</button>
                </div>

                <select
                    value={filterType} onChange={e=>setFilterType(e.target.value)}
                    style={{ width:'auto', padding:'6px 12px', fontSize:12.5, height:34 }}
                >
                    <option value="all">All Types</option>
                    <option value="deposit">Deposits</option>
                    <option value="payment">Payments</option>
                    <option value="withdrawal">Withdrawals</option>
                </select>

                <select
                    value={sortBy} onChange={e=>setSortBy(e.target.value)}
                    style={{ width:'auto', padding:'6px 12px', fontSize:12.5, height:34 }}
                >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="highest">Highest</option>
                    <option value="lowest">Lowest</option>
                </select>

                <input
                    type="text" placeholder="Search address…"
                    value={searchAddress} onChange={e=>setSearchAddress(e.target.value)}
                    style={{ width:160, height:34, padding:'6px 12px', fontSize:12.5 }}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {[...Array(5)].map((_,i) => (
                        <div key={i} className="skeleton" style={{ height:44, borderRadius:8 }} />
                    ))}
                </div>
            ) : filteredTxs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>No transactions yet</h3>
                    <p>Your transaction history will appear here.</p>
                </div>
            ) : (
                <>
                    <table className="tx-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTxs.map(tx => (
                                <tr key={tx.id}>
                                    <td>
                                        <Badge variant={TYPE_BADGE[tx.txType]}>
                                            {TYPE_LABEL[tx.txType]}
                                        </Badge>
                                    </td>
                                    <td><span className="tx-addr">{fmtAddr(tx.sender)}</span></td>
                                    <td><span className="tx-addr">{fmtAddr(tx.receiver)}</span></td>
                                    <td>
                                        <span style={{ fontWeight:600, color: TYPE_COLOR[tx.txType], fontSize:13.5 }}>
                                            {fmtAmount(tx)}
                                        </span>
                                    </td>
                                    <td><Badge variant="success">Confirmed</Badge></td>
                                    <td style={{ color:'var(--text-muted)', fontSize:12.5 }}>
                                        {format(new Date(tx.timestamp*1000), 'MMM dd, HH:mm')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {totalPages > 1 && (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                            <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                                Page {currentPage} of {totalPages} · {filteredTxs.length} records
                            </span>
                            <div style={{ display:'flex', gap:8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}>← Prev</button>
                                <button className="btn btn-secondary btn-sm" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>Next →</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}

export default Transactions;
