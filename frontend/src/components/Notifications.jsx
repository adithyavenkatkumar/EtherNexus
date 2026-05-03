import { useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ethers } from 'ethers';

function Notifications({ contract, account }) {
    useEffect(() => {
        if (!contract || !account || !ethers.isAddress(account)) return;

        let paymentFilter, proposalFilter, limitFilter, kycFilter;

        try {
            paymentFilter = contract.filters.Payment(null, account);
            const onPayment = (sender, receiver, amount, timestamp, event) => {
                if (sender.toLowerCase() !== account.toLowerCase()) {
                    toast.success(`💰 Received ${ethers.formatEther(amount)} ETH from ${sender.slice(0, 6)}...`, {
                        id: `payment-${event.transactionHash}`,
                    });
                }
            };

            proposalFilter = contract.filters.MultiSigTxProposed();
            const onProposed = (txId, initiator, receiver, amount) => {
                if (initiator.toLowerCase() !== account.toLowerCase()) {
                    toast(`🔐 New MultiSig Proposal #${txId} for ${ethers.formatEther(amount)} ETH`, {
                        icon: '📝',
                        duration: 8000
                    });
                }
            };

            limitFilter = contract.filters.DailyLimitExceeded(account);
            const onLimitExceeded = (user, amount, remaining) => {
                toast.error(`⚠️ Daily limit alert: ${ethers.formatEther(amount)} ETH rejected.`, {
                    duration: 10000
                });
            };

            kycFilter = contract.filters.UserVerified(account);
            const onKycVerified = (user) => {
                toast.success("✅ Your KYC has been verified!", {
                    icon: '🛡️',
                    duration: 10000
                });
            };

            contract.on(paymentFilter, onPayment);
            contract.on(proposalFilter, onProposed);
            contract.on(limitFilter, onLimitExceeded);
            contract.on(kycFilter, onKycVerified);

            return () => {
                contract.off(paymentFilter, onPayment);
                contract.off(proposalFilter, onProposed);
                contract.off(limitFilter, onLimitExceeded);
                contract.off(kycFilter, onKycVerified);
            };
        } catch (err) {
            console.error("Failed to setup event listeners:", err);
        }
    }, [contract, account]);

    return (
        <Toaster
            position="top-right"
            reverseOrder={false}
            toastOptions={{
                duration: 5000,
                style: {
                    background: 'rgba(10, 10, 15, 0.85)',
                    backdropFilter: 'blur(16px)',
                    color: '#fff',
                    border: '1px solid rgba(123, 97, 255, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                    fontSize: '0.85rem',
                    fontWeight: 500
                },
                success: {
                    iconTheme: {
                        primary: '#00FFA3',
                        secondary: '#fff',
                    },
                    style: {
                        border: '1px solid rgba(0, 255, 163, 0.3)',
                    }
                },
                error: {
                    iconTheme: {
                        primary: '#FF4D6D',
                        secondary: '#fff',
                    },
                    style: {
                        border: '1px solid rgba(255, 77, 109, 0.3)',
                    }
                }
            }}
        />
    );
}

export default Notifications;
