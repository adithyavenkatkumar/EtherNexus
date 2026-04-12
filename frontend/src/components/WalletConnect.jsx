import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function WalletConnect({ account, setAccount, setProvider, setSigner, setNetworkName, setWrongNetwork }) {
    const [error, setError] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [ensName, setEnsName] = useState(null);

    // Check if wallet is already connected on mount
    useEffect(() => {
        checkIfWalletIsConnected();
    }, []);

    const checkIfWalletIsConnected = async () => {
        try {
            if (!window.ethereum) {
                setError('MetaMask is not installed. Please install MetaMask to use this app.');
                return;
            }
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (err) {
            console.error('Error checking wallet connection:', err);
        }
    };

    const connectWallet = async () => {
        setIsConnecting(true);
        setError('');

        try {
            if (!window.ethereum) {
                setError('MetaMask is not installed. Please install MetaMask extension.');
                setIsConnecting(false);
                return;
            }

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();

            // Check if connected to Sepolia (chainId: 11155111)
            if (network.chainId !== 11155111n) {
                setError('Please switch to Sepolia testnet in MetaMask');
                if (setWrongNetwork) setWrongNetwork(true);
                setIsConnecting(false);
                return;
            }

            if (setWrongNetwork) setWrongNetwork(false);

            const address = accounts[0];
            setAccount(address);
            setProvider(provider);
            setSigner(signer);

            // Resolve ENS name separately
            try {
                const resolved = await provider.lookupAddress(address);
                setEnsName(resolved);
            } catch (e) {
                console.log("ENS lookup not available");
            }

            if (setNetworkName) {
                const name = network.name === 'unknown' ? 'Sepolia' :
                    network.name.charAt(0).toUpperCase() + network.name.slice(1);
                setNetworkName(name);
            }
            setIsConnecting(false);

        } catch (err) {
            console.error('Error connecting wallet:', err);
            setError('Failed to connect wallet. Please try again.');
            setIsConnecting(false);
        }
    };

    const disconnectWallet = () => {
        setAccount(null);
        setProvider(null);
        setSigner(null);
        setEnsName(null);
        setError('');
        if (setWrongNetwork) setWrongNetwork(false);
    };

    const switchToSepolia = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia hex
            });
        } catch (switchError) {
            // Chain not added yet
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0xaa36a7',
                            chainName: 'Sepolia Testnet',
                            rpcUrls: ['https://rpc.sepolia.org'],
                            nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
                            blockExplorerUrls: ['https://sepolia.etherscan.io'],
                        }],
                    });
                } catch (addError) {
                    setError('Failed to add Sepolia network.');
                }
            }
        }
    };

    // Listen for account changes
    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                } else {
                    disconnectWallet();
                }
            });

            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeAllListeners('accountsChanged');
                window.ethereum.removeAllListeners('chainChanged');
            }
        };
    }, []);

    return (
        <div className="wallet-connect">
            {!account ? (
                <div className="connect-section">
                    <button
                        className="connect-button"
                        onClick={connectWallet}
                        disabled={isConnecting}
                    >
                        {isConnecting ? '🔄 Connecting...' : '🦊 Connect MetaMask'}
                    </button>
                    {error && (
                        <div className="error-message">
                            <p>{error}</p>
                            {error.includes('Sepolia') && (
                                <button className="switch-network-btn" onClick={switchToSepolia}>
                                    🔀 Switch to Sepolia
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="connected-section">
                    <div className="account-info">
                        <span className="status-indicator">🟢</span>
                        <span className="account-address" title={account}>
                            {ensName || (account.substring(0, 6) + '...' + account.substring(38))}
                        </span>
                        <button
                            className="copy-address-btn"
                            onClick={() => navigator.clipboard.writeText(account)}
                            title="Copy full address"
                        >
                            📋
                        </button>
                        <button className="disconnect-button" onClick={disconnectWallet}>
                            Disconnect
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WalletConnect;
