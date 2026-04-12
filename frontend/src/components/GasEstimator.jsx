import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function GasEstimator({ contract, provider: propProvider, transactionType, amount, ethPrice }) {
    const [gasEstimate, setGasEstimate] = useState(null);
    const [gasPrice, setGasPrice] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGasData();

        // Polling for gas price updates every 15 seconds
        const interval = setInterval(fetchGasData, 15000);
        return () => clearInterval(interval);
    }, [transactionType, amount, contract, propProvider]);

    const fetchGasData = async () => {
        try {
            // Use the passed provider or fallback to window.ethereum
            const activeProvider = propProvider || (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null);
            if (!activeProvider) return;

            // Get current gas price/fee data
            const feeData = await activeProvider.getFeeData();

            // For EIP-1559 networks, we prefer maxFeePerGas. Fallback to gasPrice or 20 gwei.
            let price = feeData.maxFeePerGas || feeData.gasPrice;

            // If we still don't have a price or it's 0, use fallback
            if (!price || price === 0n) {
                price = ethers.parseUnits('20', 'gwei');
            }

            setGasPrice(price);

            // Get gas units estimate from contract
            let gasUnits = 60000; // conservative default
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
                    console.warn('Contract gas estimation failed, using fallback', err);
                }
            }

            setGasEstimate(Number(gasUnits));
            setLoading(false);
        } catch (error) {
            console.error('Error fetching gas data:', error);
            // Ensure we have some values even on error to avoid 0.00
            if (!gasPrice) setGasPrice(ethers.parseUnits('25', 'gwei'));
            if (!gasEstimate) setGasEstimate(60000);
            setLoading(false);
        }
    };

    const calculateGasCost = (multiplier = 1) => {
        if (!gasEstimate || !gasPrice) return '0.0008'; // Default small fallback

        try {
            const price = typeof gasPrice === 'bigint' ? gasPrice : BigInt(gasPrice);
            const units = BigInt(gasEstimate);
            const mult = BigInt(Math.floor(multiplier * 100));

            // (units * price * multiplier) / 100
            const cost = (units * price * mult) / 100n;
            return ethers.formatEther(cost);
        } catch (e) {
            console.error('Error calculating gas cost:', e);
            return '0.0008';
        }
    };

    const calculateUsdCost = (ethCost) => {
        if (!ethPrice) return '0.00';
        return (parseFloat(ethCost) * ethPrice).toFixed(2);
    };

    if (loading || !gasEstimate) {
        return (
            <div className="gas-estimator">
                <div className="gas-label">⛽ Estimating gas...</div>
            </div>
        );
    }

    const slowCost = calculateGasCost(0.8);
    const mediumCost = calculateGasCost(1);
    const fastCost = calculateGasCost(1.2);

    return (
        <div className="gas-estimator">
            <div className="gas-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="pulse-dot"></div>
                    <span className="gas-label">Network Pulse</span>
                </div>
                {gasPrice && parseFloat(ethers.formatUnits(gasPrice, 'gwei')) < 30 && (
                    <span className="badge verified" style={{ fontSize: '0.7rem' }}>✨ Low Fees!</span>
                )}
                <button className="refresh-gas" onClick={fetchGasData}>🔄</button>
            </div>

            <div className="gas-options">
                <div className="gas-option">
                    <div className="gas-speed">🐢 Slow</div>
                    <div className="gas-cost">
                        <span className="eth-cost">{parseFloat(slowCost).toFixed(6)} ETH</span>
                        <span className="usd-cost">${calculateUsdCost(slowCost)}</span>
                    </div>
                </div>

                <div className="gas-option recommended">
                    <div className="gas-speed">⚡ Medium</div>
                    <div className="gas-cost">
                        <span className="eth-cost">{parseFloat(mediumCost).toFixed(6)} ETH</span>
                        <span className="usd-cost">${calculateUsdCost(mediumCost)}</span>
                    </div>
                    <span className="recommended-badge">Recommended</span>
                </div>

                <div className="gas-option">
                    <div className="gas-speed">🚀 Fast</div>
                    <div className="gas-cost">
                        <span className="eth-cost">{parseFloat(fastCost).toFixed(6)} ETH</span>
                        <span className="usd-cost">${calculateUsdCost(fastCost)}</span>
                    </div>
                </div>
            </div>

            <div className="gas-info">
                <small>Gas Limit: {gasEstimate.toLocaleString()} units</small>
            </div>
        </div>
    );
}

export default GasEstimator;
