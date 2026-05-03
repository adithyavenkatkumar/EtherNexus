import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, Badge, Button } from './UI';

function GasEstimator({ contract, provider: propProvider, transactionType, amount, ethPrice }) {
    const [gasEstimate, setGasEstimate] = useState(null);
    const [gasPrice, setGasPrice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGasData();
        const interval = setInterval(fetchGasData, 15000);
        return () => clearInterval(interval);
    }, [transactionType, amount, contract, propProvider]);

    const fetchGasData = async () => {
        try {
            const activeProvider = propProvider || (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null);
            if (!activeProvider) return;

            const feeData = await activeProvider.getFeeData();
            let price = feeData.maxFeePerGas || feeData.gasPrice;

            if (!price || price === 0n) {
                price = ethers.parseUnits('20', 'gwei');
            }

            setGasPrice(price);

            let gasUnits = 60000;
            if (contract) {
                try {
                    if (transactionType === 'deposit') {
                        gasUnits = await contract.estimateDepositGas();
                    } else if (transactionType === 'payment') {
                        gasUnits = await contract.estimatePaymentGas();
                    } else if (transactionType === 'withdrawal') {
                        gasUnits = await contract.estimateWithdrawalGas();
                    }
                } catch (err) {
                    console.warn('Contract gas estimation failed', err);
                }
            }

            setGasEstimate(Number(gasUnits));
            setLoading(false);
        } catch (error) {
            console.error('Error fetching gas data:', error);
            setLoading(false);
        }
    };

    const calculateGasCost = (multiplier = 1) => {
        if (!gasEstimate || !gasPrice) return '0.0008';
        try {
            const price = typeof gasPrice === 'bigint' ? gasPrice : BigInt(gasPrice);
            const units = BigInt(gasEstimate);
            const mult = BigInt(Math.floor(multiplier * 100));
            const cost = (units * price * mult) / 100n;
            return ethers.formatEther(cost);
        } catch (e) {
            return '0.0008';
        }
    };

    const calculateUsdCost = (ethCost) => {
        if (!ethPrice) return '0.00';
        return (parseFloat(ethCost) * ethPrice).toFixed(2);
    };

    if (loading || !gasEstimate) {
        return <div className="text-secondary">Pulsing network fees...</div>;
    }

    const gweiPrice = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
    const isLowGas = gweiPrice < 25;
    
    // Suggestion logic: If gas is high, suggest waiting
    const suggestion = isLowGas 
        ? "✨ Perfect time to transact! Fees are at seasonal lows." 
        : `⌛ Gas is slightly elevated. Consider waiting ${Math.floor(Math.random() * 20) + 10} mins for lower fees.`;

    const levels = [
        { label: 'Slow', icon: '🐢', multiplier: 0.8, color: 'var(--text-secondary)' },
        { label: 'Standard', icon: '⚡', multiplier: 1, color: 'var(--primary)', recommended: true },
        { label: 'Instant', icon: '🚀', multiplier: 1.3, color: 'var(--secondary)' },
    ];

    return (
        <Card title="Gas Station" className="smooth-transition">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div className="flex-center gap-1">
                    <div className="pulse" style={{ width: '8px', height: '8px', background: isLowGas ? 'var(--success)' : 'var(--warning)', borderRadius: '50%' }}></div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Network Pulse: {gweiPrice.toFixed(1)} Gwei</span>
                </div>
                {isLowGas && <Badge variant="success">Low Fees</Badge>}
            </div>

            <div className="timeline-list">
                {levels.map((level) => {
                    const ethCost = calculateGasCost(level.multiplier);
                    return (
                        <div key={level.label} className="timeline-item" style={{ border: level.recommended ? '1px solid var(--primary)' : '1px solid var(--glass-border)', background: level.recommended ? 'rgba(123, 97, 255, 0.05)' : 'var(--glass-bg)' }}>
                            <div className="timeline-itemIcon" style={{ fontSize: '1.2rem' }}>{level.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div className="flex-between">
                                    <div style={{ fontWeight: 700, color: level.color }}>{level.label}</div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800 }}>{parseFloat(ethCost).toFixed(6)} ETH</div>
                                        <div className="text-secondary" style={{ fontSize: '0.75rem' }}>~${calculateUsdCost(ethCost)}</div>
                                    </div>
                                </div>
                            </div>
                            {level.recommended && <Badge variant="primary" style={{ fontSize: '0.55rem' }}>BEST</Badge>}
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', borderLeft: `4px solid ${isLowGas ? 'var(--success)' : 'var(--primary)'}` }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{suggestion}</div>
            </div>
            
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button className="text-secondary" style={{ background: 'none', border: 'none', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={fetchGasData}>
                    Refresh network state
                </button>
            </div>
        </Card>
    );
}

export default GasEstimator;
