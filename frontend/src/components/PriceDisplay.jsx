function PriceDisplay({ ethAmount, ethPrice, priceChange }) {
    const getUsdValue = () => {
        if (!ethPrice || !ethAmount) return '0.00';
        return (parseFloat(ethAmount) * ethPrice).toFixed(2);
    };

    if (!ethPrice) {
        return null;
    }

    return (
        <div className="price-display">
            <div className="usd-value">
                ≈ ${getUsdValue()} USD
            </div>
            <div className="eth-price-info">
                <span className="current-price">1 ETH = ${ethPrice.toLocaleString()}</span>
                <span className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                    {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
                </span>
            </div>
        </div>
    );
}

export default PriceDisplay;
