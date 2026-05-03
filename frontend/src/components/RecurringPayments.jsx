import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Card, Button, Badge } from './UI';

function RecurringPayments({ contract, account }) {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('');
    const [intervalSecs, setIntervalSecs] = useState('86400');

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
        if (!ethers.isAddress(receiver)) { toast.error('Invalid receiver'); return; }
        setLoading(true);
        try {
            const amountWei = ethers.parseEther(amount);
            const tx = await contract.scheduleRecurringPayment(receiver, amountWei, intervalSecs);
            await tx.wait();
            toast.success('Scheduled!');
            setReceiver('');
            setAmount('');
            setShowForm(false);
            fetchSchedules();
        } catch (err) {
            toast.error(err.reason || 'Failed to schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleExecutePayment = async (scheduleId) => {
        setLoading(true);
        try {
            const tx = await contract.executeRecurringPayment(scheduleId);
            await tx.wait();
            toast.success('Executed!');
            fetchSchedules();
        } catch (err) {
            toast.error(err.reason || 'Not due yet');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSchedule = async (scheduleId) => {
        setLoading(true);
        try {
            const tx = await contract.cancelRecurringPayment(scheduleId);
            await tx.wait();
            toast.success('Cancelled!');
            fetchSchedules();
        } catch (err) {
            toast.error(err.reason || 'Failed to cancel');
        } finally {
            setLoading(false);
        }
    };

    const isPaymentDue = (lastExecution, interval) => {
        const now = Math.floor(Date.now() / 1000);
        return now >= lastExecution + interval;
    };

    return (
        <Card title="🔄 Perpetual Streams" action={
            <Button variant="primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? '✕ Cancel' : '+ New Stream'}
            </Button>
        }>
            {showForm && (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)' }}>
                    <form onSubmit={handleSchedulePayment}>
                        <div className="smart-grid">
                            <div className="col-6">
                                <label className="text-secondary" style={{ fontSize: '0.8rem' }}>Target Address</label>
                                <input type="text" placeholder="0x..." value={receiver} onChange={e => setReceiver(e.target.value)} required style={{ marginTop: '0.5rem' }} />
                            </div>
                            <div className="col-3">
                                <label className="text-secondary" style={{ fontSize: '0.8rem' }}>Amount (ETH)</label>
                                <input type="number" step="0.0001" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} required style={{ marginTop: '0.5rem' }} />
                            </div>
                            <div className="col-3">
                                <label className="text-secondary" style={{ fontSize: '0.8rem' }}>Frequency</label>
                                <select value={intervalSecs} onChange={e => setIntervalSecs(e.target.value)} style={{ marginTop: '0.5rem' }}>
                                    <option value="86400">Daily</option>
                                    <option value="604800">Weekly</option>
                                    <option value="2592000">Monthly</option>
                                </select>
                            </div>
                        </div>
                        <Button variant="primary" type="submit" style={{ width: '100%', marginTop: '1.5rem' }} disabled={loading}>
                            Authorize Stream
                        </Button>
                    </form>
                </div>
            )}

            <div className="timeline-list">
                {schedules.map((schedule) => {
                    const due = isPaymentDue(schedule.lastExecution, schedule.interval);
                    const nextDate = (schedule.lastExecution + schedule.interval) * 1000;
                    const timeLeft = Math.max(0, nextDate - Date.now());
                    const totalDuration = schedule.interval * 1000;
                    const elapsed = totalDuration - timeLeft;
                    const progress = (elapsed / totalDuration) * 100;

                    return (
                        <div key={schedule.id} className="timeline-item">
                            <div className="timeline-itemIcon" style={{ background: due ? 'var(--success)1A' : 'var(--primary)1A' }}>
                                {due ? '🔥' : '🕒'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="flex-between">
                                    <div style={{ fontWeight: 700 }}>Stream #{schedule.id} to {schedule.receiver.slice(0, 8)}...</div>
                                    <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{schedule.amount} ETH</div>
                                </div>
                                <div className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                    Last paid: {formatDistanceToNow(new Date(schedule.lastExecution * 1000))} ago
                                </div>
                                
                                <div style={{ marginTop: '1rem' }}>
                                    <div className="flex-between" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        <span>Next Payment: {due ? 'AVAILABLE NOW' : formatDistanceToNow(new Date(nextDate), { addSuffix: true })}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${progress}%`, height: '100%', background: due ? 'var(--success)' : 'var(--primary)', boxShadow: due ? '0 0 10px var(--success)' : 'none' }}></div>
                                    </div>
                                </div>

                                <div className="flex-between gap-1" style={{ marginTop: '1.5rem' }}>
                                    <Button 
                                        variant={due ? "primary" : "secondary"} 
                                        onClick={() => handleExecutePayment(schedule.id)} 
                                        disabled={loading || !due}
                                        style={{ flex: 1 }}
                                    >
                                        🚀 {due ? 'Process Now' : 'Charging...'}
                                    </Button>
                                    <Button variant="secondary" onClick={() => handleCancelSchedule(schedule.id)} disabled={loading} style={{ flex: 0.5, color: 'var(--danger)' }}>
                                        ✕ Stop
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {schedules.length === 0 && <div style={{ textAlign: 'center', padding: '4rem 1rem' }} className="text-secondary">No automated streams active.</div>}
            </div>
        </Card>
    );
}

export default RecurringPayments;
