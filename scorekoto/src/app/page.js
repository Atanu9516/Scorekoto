'use client';
import { useState, useEffect } from 'react';

export default function AutoSyncPage() {
  const [status, setStatus] = useState('Idle');
  const [stats, setStats] = useState({ teamsUpserted: 0, matchesUpserted: 0, remainingInQueue: null });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/sync-global-all');
          const data = await res.json();
          
          if (data.success) {
            setStats(data.stats);
            setStatus(`Batch completed. Processing next batch...`);
            
            // Stop automatically if queue is empty
            if (data.stats.remainingInQueue <= 0) {
              setIsRunning(false);
              setStatus('Global Sync Complete! All league-seasons processed.');
            }
          } else {
            setStatus('Error encountered during batch sync.');
            setIsRunning(false);
          }
        } catch (err) {
          console.error(err);
          setStatus('Network or Server Error');
          setIsRunning(false);
        }
      }, 2000); // Waits 2 seconds between each batch request to keep server healthy
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h1>Global Database Auto-Sync Dashboard</h1>
      <p><strong>Status:</strong> {status}</p>
      
      <div style={{ background: '#f4f4f4', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
        <p><strong>Teams Upserted:</strong> {stats.teamsUpserted}</p>
        <p><strong>Matches Upserted:</strong> {stats.matchesUpserted}</p>
        <p><strong>Remaining in Queue:</strong> {stats.remainingInQueue !== null ? stats.remainingInQueue : 'Unknown'}</p>
      </div>

      {!isRunning ? (
        <button 
          onClick={() => setIsRunning(true)}
          style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
        >
          Start Auto-Sync
        </button>
      ) : (
        <button 
          onClick={() => setIsRunning(false)}
          style={{ padding: '10px 20px', background: '#e00', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
        >
          Pause Auto-Sync
        </button>
      )}
    </div>
  );
}