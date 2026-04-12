import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

function RecurringPayments({ contract, account }) {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('');
    const [interval, setInterval] = useState('86400'); // Default 1 day in seconds

    useEffect(() => {
        if (contract && account) {
            fetchSchedules();
        }
    }, [contract, account]);

    const fetchSchedules = async () => {
        try {
            const scheduleIds = await contract.getUserRecurringPayments(account);
            const schedulesData = await Promise.all(
                scheduleIds.map(async (id) => {
                    const schedule = await contract.getRecurringPayment(id);
                    return {
                        id: Number(id),
                        sender: schedule.sender,
                        receiver: schedule.receiver,
                        amount: ethers.formatEther(schedule.amount),
                        interval: Number(schedule.interval),
                        lastExecution: Number(schedule.lastExecution),
                        active: schedule.active,
                    };
                })
            );
            setSchedules(schedulesData.filter(s => s.active));
        } catch (error) {
            console.error('Error fetching schedules:', error);
        }
    };

    const handleSchedulePayment = async (e) => {
        e.preventDefault();

        if (!ethers.isAddress(receiver)) {
            toast.error('Invalid receiver address');
            return;
        }

        setLoading(true);
        try {
            const amountWei = ethers.parseEther(amount);
            const tx = await contract.scheduleRecurringPayment(receiver, amountWei, interval);
            toast.loading('Scheduling payment...');
            await tx.wait();
            toast.success('Recurring payment scheduled!');
            setReceiver('');
            setAmount('');
            setInterval('86400');
            setShowForm(false);
            fetchSchedules();
        } catch (error) {
            console.error('Error scheduling payment:', error);
            toast.error(error.reason || 'Failed to schedule payment');
        } finally {
            setLoading(false);
        }
    };

    const handleExecutePayment = async (scheduleId) => {
        setLoading(true);
        try {
            const tx = await contract.executeRecurringPayment(scheduleId);
            toast.loading('Executing payment...');
            await tx.wait();
            toast.success('Payment executed successfully!');
            fetchSchedules();
        } catch (error) {
            console.error('Error executing payment:', error);
            toast.error(error.reason || 'Payment not due yet or insufficient balance');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSchedule = async (scheduleId) => {
        setLoading(true);
        try {
            const tx = await contract.cancelRecurringPayment(scheduleId);
            toast.loading('Cancelling schedule...');
            await tx.wait();
            toast.success('Schedule cancelled!');
            fetchSchedules();
        } catch (error) {
            console.error('Error cancelling schedule:', error);
            toast.error(error.reason || 'Failed to cancel schedule');
        } finally {
            setLoading(false);
        }
    };

    const getIntervalText = (seconds) => {
        const days = seconds / 86400;
        if (days >= 30) return `${Math.floor(days / 30)} month(s)`;
        if (days >= 7) return `${Math.floor(days / 7)} week(s)`;
        return `${days} day(s)`;
    };

    const isPaymentDue = (lastExecution, interval) => {
        const now = Math.floor(Date.now() / 1000);
        return now >= lastExecution + interval;
    };

    return (
        <div className="recurring-card">
            <div className="recurring-header">
                <h3>🔄 Recurring Payments</h3>
                <button
                    className="add-schedule-button"
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? '✕ Cancel' : '➕ New Schedule'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSchedulePayment} className="schedule-form">
                    <div className="form-group">
                        <label>Receiver Address</label>
                        <input
                            type="text"
                            placeholder="0x..."
                            value={receiver}
                            onChange={(e) => setReceiver(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Interval</label>
                        <select
                            value={interval}
                            onChange={(e) => setInterval(e.target.value)}
                            disabled={loading}
                        >
                            <option value="86400">Daily (1 day)</option>
                            <option value="604800">Weekly (7 days)</option>
                            <option value="2592000">Monthly (30 days)</option>
                        </select>
                    </div>
                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? '⏳ Processing...' : '✓ Schedule Payment'}
                    </button>
                </form>
            )}

            {schedules.length === 0 ? (
                <div className="empty-state">
                    <p>No recurring payments scheduled</p>
                    <p className="empty-subtitle">Create a schedule to automate regular payments</p>
                </div>
            ) : (
                <div className="schedules-list recurring-timeline">
                    {schedules.map((schedule) => (
                        <div key={schedule.id} className="schedule-item recurring-payment-node">
                            <div className="schedule-info">
                                <div className="schedule-row">
                                    <span className="label">To:</span>
                                    <code>{schedule.receiver.substring(0, 10)}...{schedule.receiver.substring(32)}</code>
                                </div>
                                <div className="schedule-row">
                                    <span className="label">Amount:</span>
                                    <span className="amount">{parseFloat(schedule.amount).toFixed(4)} ETH</span>
                                </div>
                                <div className="schedule-row">
                                    <span className="label">Interval:</span>
                                    <span>{getIntervalText(schedule.interval)}</span>
                                </div>
                                <div className="schedule-row">
                                    <span className="label">Last Execution:</span>
                                    <span className="timestamp">
                                        {formatDistanceToNow(new Date(schedule.lastExecution * 1000), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                            <div className="schedule-actions">
                                <button
                                    className={`execute-button ${isPaymentDue(schedule.lastExecution, schedule.interval) ? 'due' : ''}`}
                                    onClick={() => handleExecutePayment(schedule.id)}
                                    disabled={loading || !isPaymentDue(schedule.lastExecution, schedule.interval)}
                                >
                                    {isPaymentDue(schedule.lastExecution, schedule.interval) ? '✓ Execute Now' : '⏳ Not Due'}
                                </button>
                                <button
                                    className="cancel-button"
                                    onClick={() => handleCancelSchedule(schedule.id)}
                                    disabled={loading}
                                >
                                    ✕ Cancel
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RecurringPayments;
