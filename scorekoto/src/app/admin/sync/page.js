"use client";
import { useState } from 'react';
import Icon from '@/components/Icon';

// Admin dashboard for queued background data synchronization
export default function AutoSyncDashboard() {
    const [syncType, setSyncType] = useState('matches');
    const [status, setStatus] = useState("Idle");
    const [remaining, setRemaining] = useState(null);
    const [stats, setStats] = useState({ processedSeasons: 0, teamsUpserted: 0, matchesUpserted: 0, teamsSynced: 0, playersSynced: 0 });
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
                    } else if (syncType === 'players') {
                        setStats(prev => ({
                            ...prev,
                            teamsSynced: prev.teamsSynced + (data.teamsSynced || 0),
                            playersSynced: prev.playersSynced + (data.playersSynced || 0),
                        }));
                    }
                    setRemaining(data.stats ? data.stats.remainingInQueue : data.remainingInQueue);
                    
                    const left = data.stats ? data.stats.remainingInQueue : data.remainingInQueue;

                    if (left === 0) {
                        setStatus(`100% Complete! All ${syncType} fully synchronized in database.`);
                        keepRunning = false;
                    } else {
                        setStatus(`Batch successful! ${left} items left in queue. Waiting 5s before next batch...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        setStatus("Fetching next batch...");
                    }
                } else if (data.status === 'quota_exhausted') {
                    setStatus(`Provider daily quota exhausted: ${data.message || 'try again after the quota resets.'}`);
                    keepRunning = false;
                } else if (data.status === 'paused') {
                    // Back off if external API rate limit is encountered
                    setStatus("API rate limit reached. Waiting 60s for cooldown...");
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    setStatus("Resuming batch sync...");
                } else {
                    setStatus(`Error: ${data.error || data.message}`);
                    keepRunning = false;
                }
            } catch (err) {
                setStatus(`Network/Server Error: ${err.message}`);
                keepRunning = false;
            }
        }
        setIsSyncing(false);
    };

    return (
        <main className="sync-dashboard">
            <h1>Scoreকত? Admin Data Sync Engine</h1>
            <p className="sync-dashboard-intro">
                Automated queue processor for populating PostgreSQL database tables.
            </p>

            <div className="sync-type-selector">
                <label>
                    <input 
                        type="radio" 
                        name="syncType" 
                        value="matches" 
                        checked={syncType === 'matches'} 
                        onChange={() => setSyncType('matches')}
                        disabled={isSyncing}
                    /> Sync Matches & Teams (/api/sync-matches)
                </label>

                <label>
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
                className="sync-start-btn"
            >
                {isSyncing ? "Auto-Sync Loop Running..." : `Start ${syncType === 'matches' ? 'Matches' : 'Players'} Auto-Sync`}
            </button>

            <div className="sync-status-panel">
                <p>
                    <strong>Status:</strong>{" "}
                    <Icon name={status.includes("Error") ? "alert" : status.includes("Complete") ? "check" : isSyncing ? "loader" : "database"} className={isSyncing ? "icon-spin" : ""} /> {status}
                </p>
                {remaining !== null && (
                    <p>
                        <strong>Items Remaining in Queue:</strong> {remaining}
                    </p>
                )}
                
                <div className="sync-metrics">
                    <p>Batch Metrics:</p>
                    <ul>
                        <li>Processed Seasons: <strong>{stats.processedSeasons}</strong></li>
                        <li>Teams Saved: <strong>{stats.teamsUpserted}</strong></li>
                        <li>Matches Saved: <strong>{stats.matchesUpserted}</strong></li>
                        <li>Squads Synced: <strong>{stats.teamsSynced}</strong></li>
                        <li>Squad Players Saved: <strong>{stats.playersSynced}</strong></li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
