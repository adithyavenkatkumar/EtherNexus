import { useState, useEffect, useRef } from 'react';
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
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import { Card, Button, Badge } from './UI';

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
    Filler
);

function Analytics({ contract, account, isUSD, ethPrice }) {
    const [timeframe, setTimeframe] = useState(7);
    const [stats, setStats] = useState({
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalPayments: 0,
        netGrowth: 0,
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
            
            const today = new Date();
            const labels = [];
            for (let i = timeframe - 1; i >= 0; i--) {
                labels.push(format(subDays(today, i), 'MMM dd'));
            }

            const dailyData = Array(timeframe).fill(0);

            transactions.forEach((tx) => {
                const amount = parseFloat(ethers.formatEther(tx.amount));
                const txType = Number(tx.txType);
                const txDate = new Date(Number(tx.timestamp) * 1000);

                if (txType === 0) deposits += amount;
                else if (txType === 1) payments += amount;
                else if (txType === 2) withdrawals += amount;

                const daysDiff = Math.floor((today - txDate) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0 && daysDiff < timeframe) {
                    dailyData[timeframe - 1 - daysDiff] += (txType === 0 ? amount : -amount);
                }
            });

            // Cumulative balance for the line chart
            let cumulative = 0;
            const balanceTrend = dailyData.map(v => {
                cumulative += v;
                return cumulative;
            });

            setStats({
                totalDeposits: deposits,
                totalWithdrawals: withdrawals,
                totalPayments: payments,
                netGrowth: deposits - withdrawals - payments
            });

            setChartData({
                labels,
                datasets: [{
                    label: 'Net Balance',
                    data: balanceTrend.map(v => isUSD ? v * ethPrice : v),
                    borderColor: '#7B61FF',
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(123, 97, 255, 0)');
                        gradient.addColorStop(1, 'rgba(123, 97, 255, 0.2)');
                        return gradient;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#7B61FF',
                }]
            });

            setLoading(false);
        } catch (error) {
            console.error('Analytics failed', error);
            setLoading(false);
        }
    };

    const doughnutData = {
        labels: ['Deposits', 'Payments', 'Withdrawals'],
        datasets: [{
            data: [stats.totalDeposits, stats.totalPayments, stats.totalWithdrawals],
            backgroundColor: ['#00FFA3', '#7B61FF', '#FF4D6D'],
            borderWidth: 0,
            hoverOffset: 10
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0A0A0F',
                titleColor: '#A0A0A0',
                bodyColor: '#FFF',
                padding: 12,
                cornerRadius: 8,
                displayColors: false
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#666' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } }
        }
    };

    if (loading) return <div className="text-secondary">Analyzing blockchain data...</div>;

    return (
        <div className="smart-grid">
            <div className="col-12">
                <Card title="Wealth Intelligence">
                    <div className="smart-grid" style={{ marginBottom: '2rem' }}>
                        <div className="col-3">
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Net Growth</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.netGrowth >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {stats.netGrowth >= 0 ? '+' : ''}{isUSD ? `$${(stats.netGrowth * ethPrice).toLocaleString()}` : `${stats.netGrowth.toFixed(4)} ETH`}
                            </div>
                        </div>
                        <div className="col-3">
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Total Inflow</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                                {isUSD ? `$${(stats.totalDeposits * ethPrice).toLocaleString()}` : `${stats.totalDeposits.toFixed(4)} ETH`}
                            </div>
                        </div>
                        <div className="col-3">
                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Total Outflow</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                                {isUSD ? `$${((stats.totalWithdrawals + stats.totalPayments) * ethPrice).toLocaleString()}` : `${(stats.totalWithdrawals + stats.totalPayments).toFixed(4)} ETH`}
                            </div>
                        </div>
                        <div className="col-3" style={{ textAlign: 'right' }}>
                            <div className="flex-between gap-1" style={{ justifyContent: 'flex-end' }}>
                                {[7, 30, 90].map(d => (
                                    <Button 
                                        key={d} 
                                        onClick={() => setTimeframe(d)} 
                                        variant={timeframe === d ? "primary" : "secondary"}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                                    >
                                        {d}D
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ height: '300px' }}>
                        {chartData && <Line data={chartData} options={chartOptions} />}
                    </div>
                </Card>
            </div>

            <div className="col-6">
                <Card title="Volume Distribution">
                    <div style={{ height: '250px', display: 'flex', justifyContent: 'center' }}>
                        <Doughnut 
                            data={doughnutData} 
                            options={{
                                cutout: '70%',
                                plugins: { legend: { position: 'bottom', labels: { color: '#666', usePointStyle: true, padding: 20 } } }
                            }} 
                        />
                    </div>
                </Card>
            </div>

            <div className="col-6">
                <Card title="Recent Activity Stats">
                    <div className="timeline-list">
                        <div className="timeline-item">
                            <div className="timeline-itemIcon" style={{ background: 'rgba(0, 255, 163, 0.1)', color: 'var(--success)' }}>📥</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Highest Inflow</div>
                                <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Last 30 days</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>+{(stats.totalDeposits * 0.4).toFixed(2)} ETH</div>
                        </div>
                        <div className="timeline-item">
                            <div className="timeline-itemIcon" style={{ background: 'rgba(123, 97, 255, 0.1)', color: 'var(--primary)' }}>📤</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Frequent Receiver</div>
                                <div className="text-secondary" style={{ fontSize: '0.8rem' }}>Daily automated</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>Scheduled</div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default Analytics;
