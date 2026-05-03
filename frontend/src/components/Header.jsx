import React, { useState } from 'react';
import toast from 'react-hot-toast';

const Header = ({
  account,
  networkName,
  ethPrice,
  priceChange,
  isUSD,
  toggleCurrency,
  setShowAddressBook,
  wrongNetwork,
}) => {
  const shortAddr = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  const copyAddress = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    toast.success('Address copied!');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {wrongNetwork ? (
          <span className="badge badge-danger">⚠ Wrong Network</span>
        ) : (
          <div className="network-badge">
            <span className="network-dot" />
            {networkName || 'Sepolia Testnet'}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>ETH</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            ${ethPrice?.toLocaleString()}
          </span>
          <span style={{
            fontWeight: 600,
            fontSize: 11.5,
            color: priceChange >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="header-right">
        <button className="btn btn-ghost btn-sm" onClick={toggleCurrency} title="Toggle currency">
          {isUSD ? '$ USD' : '◈ ETH'}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAddressBook(true)}
          title="Address book"
        >
          📔
        </button>

        {shortAddr && (
          <div className="wallet-chip" onClick={copyAddress} title="Click to copy">
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>◉</span>
            <code>{shortAddr}</code>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⧉</span>
          </div>
        )}

        {!account && (
          <button className="btn btn-primary btn-sm">Connect Wallet</button>
        )}
      </div>
    </header>
  );
};

export default Header;
