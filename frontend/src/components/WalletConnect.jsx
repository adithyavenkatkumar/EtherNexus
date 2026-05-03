import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Button, Badge } from './UI';

function WalletConnect({ account, setAccount, setProvider, setSigner, setNetworkName, setWrongNetwork }) {
    const [error, setError] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [ensName, setEnsName] = useState(null);

    useEffect(() => {
        checkIfWalletIsConnected();
    }, []);

    const checkIfWalletIsConnected = async () => {
        try {
            if (!window.ethereum) return;
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
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();

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

            try {
                const resolved = await provider.lookupAddress(address);
                setEnsName(resolved);
            } catch (e) {}

            if (setNetworkName) {
                setNetworkName('Sepolia');
            }
            setIsConnecting(false);
        } catch (err) {
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
                params: [{ chainId: '0xaa36a7' }],
            });
        } catch (switchError) {
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

    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = (accounts) => {
                if (accounts.length > 0) setAccount(accounts[0]);
                else disconnectWallet();
            };
            const handleChainChanged = () => window.location.reload();

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {!account ? (
                <>
                    <Button variant="primary" onClick={connectWallet} disabled={isConnecting} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                        {isConnecting ? '🔄 Connecting...' : '🦊 Connect MetaMask'}
                    </Button>
                    {error && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>
                            <p>{error}</p>
                            {error.includes('Sepolia') && (
                                <Button onClick={switchToSepolia} style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                    🔀 Switch to Sepolia
                                </Button>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--glass-bg)', padding: '0.5rem 1.5rem', borderRadius: '100px', border: '1px solid var(--glass-border)' }}>
                    <Badge variant="success">🟢 Connected</Badge>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {ensName || (account.substring(0, 6) + '...' + account.substring(38))}
                    </span>
                    <button onClick={disconnectWallet} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                        DISCONNECT
                    </button>
                </div>
            )}
        </div>
    );
}

export default WalletConnect;
