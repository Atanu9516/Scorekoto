import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
    try {
        // 1. Automatically create the tracking table if it doesn't exist yet
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Processed_Teams_Players (
                Team_ID INT PRIMARY KEY
            );
        `);

        // 2. Find up to 3 teams that haven't had their players synced yet
        const { rows: pendingTeams } = await pool.query(`
            SELECT Team_ID 
            FROM Team 
            WHERE Team_ID NOT IN (SELECT Team_ID FROM Processed_Teams_Players)
            LIMIT 3;
        `);

        // If no teams left, the sync is 100% finished!
        if (pendingTeams.length === 0) {
            return NextResponse.json({ success: true, message: "All players synced!", remainingInQueue: 0 });
        }

        // 3. Loop through the batch of teams
        for (const team of pendingTeams) {
            // Using season 2024 to get the active squad
            const apiUrl = `https://v3.football.api-sports.io/players?team=${team.team_id}&season=2024`;
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'x-apisports-key': process.env.API_SPORTS_KEY, // Ensure this matches your .env file
                }
            });

            if (!response.ok) {
                // If we hit a rate limit (429), stop the batch immediately
                if (response.status === 429) {
                    return NextResponse.json({ success: false, status: 'paused', message: "Rate limit reached." });
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            // 4. Insert each player into your schema
            if (data.response && data.response.length > 0) {
                for (const item of data.response) {
                    const p = item.player;
                    
                    // Parse weight (API returns "74 kg", schema expects DECIMAL)
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
                        null,                     // Market_Value_Euros (API doesn't provide this, so we default to null)
                        weightCm,
                        p.birth?.date || null,
                        p.nationality || null
                    ]);
                }
            }

            // 5. Mark this team as processed so we never fetch it again
            await pool.query(`INSERT INTO Processed_Teams_Players (Team_ID) VALUES ($1) ON CONFLICT DO NOTHING;`, [team.team_id]);
            
            // Add a 1-second delay between API calls to prevent tripping rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Count how many teams are still left in total
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