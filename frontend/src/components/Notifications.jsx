import { useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ethers } from 'ethers';

function Notifications({ contract, account }) {
    useEffect(() => {
        if (!contract || !account || !ethers.isAddress(account)) return;

        console.log("🔔 Starting real-time event listeners...");

        let paymentFilter, proposalFilter, limitFilter, kycFilter;

        try {
            // 1. Listen for Payments where user is the receiver
            paymentFilter = contract.filters.Payment(null, account);
            const onPayment = (sender, receiver, amount, timestamp, event) => {
                if (sender.toLowerCase() !== account.toLowerCase()) {
                    toast.success(`💰 Received ${ethers.formatEther(amount)} ETH from ${sender.slice(0, 6)}...`, {
                        id: `payment-${event.transactionHash}`,
                    });
                }
            };

            // 2. Listen for MultiSig Proposals
            proposalFilter = contract.filters.MultiSigTxProposed();
            const onProposed = (txId, initiator, receiver, amount) => {
                if (initiator.toLowerCase() !== account.toLowerCase()) {
                    toast(`🔐 New MultiSig Proposal #${txId} for ${ethers.formatEther(amount)} ETH`, {
                        icon: '📝',
                        duration: 8000
                    });
                }
            };

            // 3. Listen for Daily Limit alert
            limitFilter = contract.filters.DailyLimitExceeded(account);
            const onLimitExceeded = (user, amount, remaining) => {
                toast.error(`⚠️ Daily limit alert: ${ethers.formatEther(amount)} ETH rejected.`, {
                    duration: 10000
                });
            };

            // 4. Listen for KYC verification
            kycFilter = contract.filters.UserVerified(account);
            const onKycVerified = (user) => {
                toast.success("✅ Your KYC has been verified!", {
                    icon: '🛡️',
                    duration: 10000
                });
            };

            // Subscribe
            contract.on(paymentFilter, onPayment);
            contract.on(proposalFilter, onProposed);
            contract.on(limitFilter, onLimitExceeded);
            contract.on(kycFilter, onKycVerified);

            // Cleanup
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
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(12px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                },
            }}
        />
    );
}

export default Notifications;
