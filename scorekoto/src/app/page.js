'use client';
import { useState, useEffect } from 'react';

// Global database sync dashboard component
export default function AutoSyncPage() {
  const [status, setStatus] = useState('Idle');
  const [stats, setStats] = useState({ teamsUpserted: 0, matchesUpserted: 0, remainingInQueue: null });
  const [isRunning, setIsRunning] = useState(false);

  // Polls the global sync endpoint at 2-second intervals while active
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
            
            // Stop polling when no items remain in the queue
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
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      maxWidth: '650px', 
      margin: '40px auto',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
      border: '1px solid #1e293b'
    }}>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '26px', color: '#38bdf8' }}>Global Database Auto-Sync Dashboard</h1>
      <p style={{ fontSize: '15px', color: '#f8fafc', margin: '0 0 20px 0' }}>
        <strong style={{ color: '#38bdf8' }}>Status:</strong> {status}
      </p>
      
      <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid #334155' }}>
        <p style={{ margin: '0 0 8px 0', color: '#f8fafc' }}><strong style={{ color: '#cbd5e1' }}>Teams Upserted:</strong> {stats.teamsUpserted}</p>
        <p style={{ margin: '0 0 8px 0', color: '#f8fafc' }}><strong style={{ color: '#cbd5e1' }}>Matches Upserted:</strong> {stats.matchesUpserted}</p>
        <p style={{ margin: 0, color: '#f8fafc' }}><strong style={{ color: '#cbd5e1' }}>Remaining in Queue:</strong> {stats.remainingInQueue !== null ? stats.remainingInQueue : 'Unknown'}</p>
      </div>

      {!isRunning ? (
        <button 
          onClick={() => setIsRunning(true)}
          style={{ padding: '12px 24px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' }}
        >
          Start Auto-Sync
        </button>
      ) : (
        <button 
          onClick={() => setIsRunning(false)}
          style={{ padding: '12px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' }}
        >
          Pause Auto-Sync
        </button>
      )}
    </div>
  );
}