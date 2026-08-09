"use client";
import { useState } from 'react';

export default function AutoSyncDashboard() {
    const [status, setStatus] = useState("Idle");
    const [remaining, setRemaining] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const startAutoSync = async () => {
        setIsSyncing(true);
        setStatus("Starting auto-sync loop...");
        let keepRunning = true;

        while (keepRunning) {
            try {
                const res = await fetch('/api/sync-global-players');
                const data = await res.json();

                if (data.success) {
                    setRemaining(data.remainingInQueue);
                    
                    if (data.remainingInQueue === 0) {
                        setStatus("✅ 100% Complete. All players synced!");
                        keepRunning = false;
                    } else {
                        setStatus(`🔄 Batch successful. ${data.remainingInQueue} teams left. Cooling down for 20s to bypass per-minute speed limits...`);
                        
                        // ⏳ THE FIX: Wait 20 seconds before fetching the next batch
                        await new Promise(resolve => setTimeout(resolve, 20000));
                        
                        setStatus(`🔄 Fetching next batch...`);
                    }
                } else if (data.status === 'paused') {
                    // It could be the daily limit OR the per-minute limit
                    setStatus("⏸️ API Rate limit reached. If daily usage is low, wait 60 seconds and try again.");
                    keepRunning = false;
                } else {
                    setStatus(`❌ Error: ${data.error}`);
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
        <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
            <h1>Scorekoto Data Sync</h1>
            
            <button 
                onClick={startAutoSync} 
                disabled={isSyncing}
                style={{ 
                    padding: '10px 20px', 
                    fontSize: '16px', 
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    backgroundColor: isSyncing ? '#ccc' : '#0070f3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px'
                }}
            >
                {isSyncing ? "Auto-Sync Running..." : "Start Auto-Sync"}
            </button>

            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f4f4f4', borderRadius: '5px' }}>
                <p><strong>Status:</strong> {status}</p>
                {remaining !== null && <p><strong>Teams Remaining:</strong> {remaining}</p>}
            </div>
        </div>
    );
}