"use client";
import { useState } from 'react';

// Admin dashboard for queued background data synchronization
export default function AutoSyncDashboard() {
    const [syncType, setSyncType] = useState('matches');
    const [status, setStatus] = useState("Idle");
    const [remaining, setRemaining] = useState(null);
    const [stats, setStats] = useState({ processedSeasons: 0, teamsUpserted: 0, matchesUpserted: 0 });
    const [isSyncing, setIsSyncing] = useState(false);

    // Iteratively triggers batch sync endpoints with delay and rate-limit handling
    const startAutoSync = async () => {
        setIsSyncing(true);
        setStatus("Starting auto-sync queue loop...");
        let keepRunning = true;

        const endpoint = syncType === 'matches' ? '/api/sync-matches' : '/api/sync-global-players';

        while (keepRunning) {
            try {
                const res = await fetch(endpoint);
                const data = await res.json();

                if (data.success) {
                    if (data.stats) {
                        setStats(prev => ({
                            processedSeasons: prev.processedSeasons + (data.stats.processedSeasons || 0),
                            teamsUpserted: prev.teamsUpserted + (data.stats.teamsUpserted || 0),
                            matchesUpserted: prev.matchesUpserted + (data.stats.matchesUpserted || 0),
                        }));
                    }
                    setRemaining(data.stats ? data.stats.remainingInQueue : data.remainingInQueue);
                    
                    const left = data.stats ? data.stats.remainingInQueue : data.remainingInQueue;

                    if (left === 0) {
                        setStatus(`✅ 100% Complete! All ${syncType} fully synchronized in database.`);
                        keepRunning = false;
                    } else {
                        setStatus(`🔄 Batch successful! ${left} items left in queue. Waiting 5s before next batch...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        setStatus(`🔄 Fetching next batch...`);
                    }
                } else if (data.status === 'paused') {
                    // Back off if external API rate limit is encountered
                    setStatus("⏸️ API Rate limit reached. Waiting 60s for rate-limit cooldown...");
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    setStatus("🔄 Resuming batch sync...");
                } else {
                    setStatus(`❌ Error: ${data.error || data.message}`);
                    keepRunning = false;
                }
            } catch (err) {
                setStatus(`❌ Network/Server Error: ${err.message}`);
                keepRunning = false;
            }
        }
        setIsSyncing(false);
    };

    return (
        <div style={{ 
            padding: '40px', 
            fontFamily: 'system-ui, -apple-system, sans-serif', 
            maxWidth: '750px', 
            margin: '40px auto',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            border: '1px solid #1e293b'
        }}>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#38bdf8' }}>Scorekoto Admin Data Sync Engine</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '25px' }}>
                Automated queue processor for populating PostgreSQL database tables.
            </p>

            <div style={{ margin: '20px 0', display: 'flex', gap: '20px', backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px' }}>
                <label style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f8fafc', fontSize: '14px', display: 'flex', itemsCenter: 'center', gap: '8px' }}>
                    <input 
                        type="radio" 
                        name="syncType" 
                        value="matches" 
                        checked={syncType === 'matches'} 
                        onChange={() => setSyncType('matches')}
                        disabled={isSyncing}
                    /> Sync Matches & Teams (/api/sync-matches)
                </label>

                <label style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f8fafc', fontSize: '14px', display: 'flex', itemsCenter: 'center', gap: '8px' }}>
                    <input 
                        type="radio" 
                        name="syncType" 
                        value="players" 
                        checked={syncType === 'players'} 
                        onChange={() => setSyncType('players')}
                        disabled={isSyncing}
                    /> Sync Player Squads (/api/sync-global-players)
                </label>
            </div>
            
            <button 
                onClick={startAutoSync} 
                disabled={isSyncing}
                style={{ 
                    padding: '12px 28px', 
                    fontSize: '15px', 
                    fontWeight: 'bold',
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    backgroundColor: isSyncing ? '#475569' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.2s'
                }}
            >
                {isSyncing ? "Auto-Sync Loop Running..." : `Start ${syncType === 'matches' ? 'Matches' : 'Players'} Auto-Sync`}
            </button>

            <div style={{ marginTop: '25px', padding: '20px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#f8fafc' }}>
                    <strong style={{ color: '#38bdf8' }}>Status:</strong> {status}
                </p>
                {remaining !== null && (
                    <p style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#f8fafc' }}>
                        <strong style={{ color: '#38bdf8' }}>Items Remaining in Queue:</strong> {remaining}
                    </p>
                )}
                
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #334155' }}>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#cbd5e1' }}>Batch Metrics:</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.8' }}>
                        <li>Processed Seasons: <strong style={{ color: '#f8fafc' }}>{stats.processedSeasons}</strong></li>
                        <li>Teams Saved: <strong style={{ color: '#f8fafc' }}>{stats.teamsUpserted}</strong></li>
                        <li>Matches Saved: <strong style={{ color: '#f8fafc' }}>{stats.matchesUpserted}</strong></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}