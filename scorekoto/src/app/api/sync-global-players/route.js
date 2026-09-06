import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Synchronizes active player squads (season 2024) for teams in batches of 3
export async function GET() {
    try {
        // Track teams that have completed player synchronization
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Processed_Teams_Players (
                Team_ID INT PRIMARY KEY
            );
        `);

        // Retrieve next batch of pending teams
        const { rows: pendingTeams } = await pool.query(`
            SELECT Team_ID 
            FROM Team 
            WHERE Team_ID NOT IN (SELECT Team_ID FROM Processed_Teams_Players)
            LIMIT 3;
        `);

        if (pendingTeams.length === 0) {
            return NextResponse.json({ success: true, message: "All players synced!", remainingInQueue: 0 });
        }

        for (const team of pendingTeams) {
            const apiUrl = `https://v3.football.api-sports.io/players?team=${team.team_id}&season=2024`;
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'x-apisports-key': process.env.API_SPORTS_KEY,
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    return NextResponse.json({ success: false, status: 'paused', message: "Rate limit reached." });
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            // Insert player details into database
            if (data.response && data.response.length > 0) {
                for (const item of data.response) {
                    const p = item.player;
                    
                    // Parse numeric weight from API response (e.g., '74 kg')
                    const weightCm = p.weight ? parseFloat(p.weight.replace(/[^0-9.]/g, '')) : null;

                    await pool.query(`
                        INSERT INTO Player 
                            (Player_ID, Team_ID, First_Name, Last_Name, Primary_Position, Market_Value_Euros, Weight_cm, Date_of_Birth, Nationality)
                        VALUES 
                            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (Player_ID) DO NOTHING;
                    `, [
                        p.id,                     
                        team.team_id,
                        p.firstname || 'Unknown', 
                        p.lastname || 'Unknown',
                        item.statistics[0]?.games?.position || null,
                        null,
                        weightCm,
                        p.birth?.date || null,
                        p.nationality || null
                    ]);
                }
            }

            // Mark team as completed
            await pool.query(`INSERT INTO Processed_Teams_Players (Team_ID) VALUES ($1) ON CONFLICT DO NOTHING;`, [team.team_id]);
            
            // Rate limit delay between team requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const { rows: queueCheck } = await pool.query(`
            SELECT COUNT(*) AS remaining 
            FROM Team 
            WHERE Team_ID NOT IN (SELECT Team_ID FROM Processed_Teams_Players);
        `);

        return NextResponse.json({ 
            success: true, 
            message: "Batch completed successfully", 
            remainingInQueue: parseInt(queueCheck[0].remaining) 
        });

    } catch (error) {
        console.error("Player Sync Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}