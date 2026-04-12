import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler,
    LineController,
    BarController,
} from 'chart.js';
import { Line, Bar, Doughnut, Chart } from 'react-chartjs-2';
import { format, subDays, startOfDay } from 'date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler,
    LineController,
    BarController
);

function Analytics({ contract, account, isUSD, ethPrice }) {
    const [timeframe, setTimeframe] = useState(7); // days
    const [stats, setStats] = useState({
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalPayments: 0,
        transactionCount: 0,
        avgTransactionAmount: 0,
    });
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (contract && account) {
            fetchAnalytics();
        }
    }, [contract, account, timeframe]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const transactions = await contract.getTransactions();

            let deposits = 0;
            let withdrawals = 0;
            let payments = 0;
            let totalAmount = 0;

            const last7Days = Array(7).fill(0);
            const labels = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = subDays(today, i);
                labels.push(format(date, 'MMM dd'));
            }

            transactions.forEach((tx) => {
                const amount = parseFloat(ethers.formatEther(tx.amount));
                totalAmount += amount;
                const txType = Number(tx.txType);

                // Count by type
                if (txType === 0) deposits += amount; // Deposit
                else if (txType === 1) payments += amount; // Payment
                else if (txType === 2) withdrawals += amount; // Withdrawal

                // Chart data - last 7 days
                const txDate = new Date(Number(tx.timestamp) * 1000);
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                const txMidnight = new Date(txDate);
                txMidnight.setHours(0, 0, 0, 0);

                const daysDiff = Math.floor((todayMidnight - txMidnight) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0 && daysDiff < 7) {
                    last7Days[6 - daysDiff] += amount;
                }
            });

            // Sort transactions by timestamp for the chart
            const sortedTxs = [...transactions]
                .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
                .filter(tx => {
                    if (timeframe === 0) return true; // ALL
                    const txDate = new Date(Number(tx.timestamp) * 1000);
                    const diff = (today - txDate) / (1000 * 60 * 60 * 24);
                    return diff < timeframe;
                });

            const volumeLabels = sortedTxs.length > 0
                ? sortedTxs.map(tx => format(new Date(Number(tx.timestamp) * 1000), 'MMM dd HH:mm'))
                : labels; // fallback to daily labels if no txs

            const volumeData = sortedTxs.length > 0
                ? sortedTxs.map(tx => parseFloat(ethers.formatEther(tx.amount)))
                : Array(7).fill(0);

            // Calculate Balance History for the "Trading" look
            let balance = 0;
            const balanceHistory = sortedTxs.map(tx => {
                const amount = parseFloat(ethers.formatEther(tx.amount));
                const txType = Number(tx.txType);
                // 0=Deposit, 1=Payment, 2=Withdrawal
                if (txType === 0) balance += amount;
                else balance -= amount; // Both payments and withdrawals reduce contract balance (or user balance in context)
                return balance;
            });

            setStats({
                totalDeposits: deposits,
                totalWithdrawals: withdrawals,
                totalPayments: payments,
                transactionCount: transactions.length,
                avgTransactionAmount: transactions.length > 0 ? totalAmount / transactions.length : 0,
            });

            setChartData({
                labels: volumeLabels,
                datasets: [
                    {
                        type: 'line',
                        label: `Balance Trend (${isUSD ? 'USD' : 'ETH'})`,
                        data: balanceHistory.map(b => isUSD ? b * ethPrice : b),
                        borderColor: 'rgb(52, 211, 153)', // Emerald Green
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgb(52, 211, 153)',
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y',
                    },
                    {
                        type: 'bar',
                        label: `Volume Spike (${isUSD ? 'USD' : 'ETH'})`,
                        data: volumeData.map(v => isUSD ? v * ethPrice : v),
                        backgroundColor: 'rgba(102, 126, 234, 0.5)',
                        borderColor: 'rgb(102, 126, 234)',
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y1',
                        barThickness: sortedTxs.length > 15 ? 'flex' : 15,
                    },
                ],
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setLoading(false);
        }
    };

    const typeDistributionData = {
        labels: ['Deposits', 'Payments', 'Withdrawals'],
        datasets: [
            {
                label: `Volume (${isUSD ? 'USD' : 'ETH'})`,
                data: [
                    isUSD ? stats.totalDeposits * ethPrice : stats.totalDeposits,
                    isUSD ? stats.totalPayments * ethPrice : stats.totalPayments,
                    isUSD ? stats.totalWithdrawals * ethPrice : stats.totalWithdrawals
                ],
                backgroundColor: [
                    'rgba(72, 187, 120, 0.6)',
                    'rgba(66, 153, 225, 0.6)',
                    'rgba(245, 101, 101, 0.6)',
                ],
                borderColor: [
                    'rgb(72, 187, 120)',
                    'rgb(66, 153, 225)',
                    'rgb(245, 101, 101)',
                ],
                borderWidth: 1,
                borderRadius: 5,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#a0aec0',
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: 'rgba(102, 126, 234, 0.5)',
                borderWidth: 1,
            },
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: false,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#a0aec0',
                    callback: (value) => isUSD ? `$${value.toFixed(0)}` : `${value.toFixed(2)} E`,
                },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                grid: {
                    drawOnChartArea: false, // only want the grid lines for one axis
                },
                ticks: {
                    color: 'rgba(102, 126, 234, 0.8)',
                    callback: (value) => isUSD ? `$${value.toFixed(0)}` : value.toFixed(3),
                },
            },
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#a0aec0',
                    font: { size: 10 },
                    maxRotation: 45,
                    minRotation: 45,
                },
            },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#a0aec0',
                    padding: 15,
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
            },
        },
    };

    const exportAnalyticsCSV = () => {
        const headers = "Metric,Value\n";
        const rows = [
            `Total Deposits,${stats.totalDeposits.toFixed(4)} ETH`,
            `Total Payments,${stats.totalPayments.toFixed(4)} ETH`,
            `Total Withdrawals,${stats.totalWithdrawals.toFixed(4)} ETH`,
            `Transaction Count,${stats.transactionCount}`,
            `Avg Transaction,${stats.avgTransactionAmount.toFixed(4)} ETH`,
        ].join("\n");
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `analytics_summary.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (loading) {
        return (
            <div className="analytics-card">
                <h3>📊 Analytics Dashboard</h3>
                <div className="skeleton-list">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="skeleton-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="skeleton-cell medium"></div>
                            <div className="skeleton-cell short"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-card wealth-intelligence">
            <div className="analytics-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h3>📈 Wealth Intelligence</h3>
                    <div className="sparkline-mock"></div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="export-btn" onClick={exportAnalyticsCSV} title="Export summary CSV">
                        📥 Export
                    </button>
                    <button className="refresh-button-small" onClick={fetchAnalytics}>
                        🔄
                    </button>
                </div>
            </div>


            <div className="stats-grid">
                <div className="stat-box">
                    <div className="stat-label">Total Deposits</div>
                    <div className="stat-value deposit">
                        {isUSD ? `$${(stats.totalDeposits * ethPrice).toFixed(2)}` : `${stats.totalDeposits.toFixed(4)} ETH`}
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">Total Payments</div>
                    <div className="stat-value payment">
                        {isUSD ? `$${(stats.totalPayments * ethPrice).toFixed(2)}` : `${stats.totalPayments.toFixed(4)} ETH`}
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">Total Withdrawals</div>
                    <div className="stat-value withdrawal">
                        {isUSD ? `$${(stats.totalWithdrawals * ethPrice).toFixed(2)}` : `${stats.totalWithdrawals.toFixed(4)} ETH`}
                    </div>
                </div>
                <div className="stat-box">
                    <div className="stat-label">Avg Transaction</div>
                    <div className="stat-value">
                        {isUSD ? `$${(stats.avgTransactionAmount * ethPrice).toFixed(2)}` : `${stats.avgTransactionAmount.toFixed(4)} ETH`}
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container trading-view">
                    <div className="chart-header-custom">
                        <h4>Market Activity & Balance Trend</h4>
                        <div className="timeframe-toggles">
                            {[1, 3, 7, 0].map(tf => (
                                <button
                                    key={tf}
                                    className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                                    onClick={() => setTimeframe(tf)}
                                >
                                    {tf === 0 ? 'ALL' : `${tf}D`}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="chart-wrapper">
                        {chartData && (
                            <Chart
                                type='bar'
                                data={chartData}
                                options={{
                                    ...chartOptions,
                                    plugins: {
                                        ...chartOptions.plugins,
                                        title: {
                                            display: true,
                                            text: 'Volume Spikes & Cumulative Balance',
                                            color: '#718096',
                                            font: { size: 12, weight: 'normal' }
                                        }
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="chart-container">
                    <h4>Transaction Distribution</h4>
                    <div className="chart-wrapper">
                        <Bar data={typeDistributionData} options={chartOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Analytics;
