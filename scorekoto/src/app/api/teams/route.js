import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Retrieves all teams from the database
export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM team;');
    
    return NextResponse.json({
      success: true,
      total_teams_found: result.rowCount,
      teams_data: result.rows
    });

  } catch (err) {
    console.error("Database read failed:", err);
    return NextResponse.json({ error: "Failed to read database" }, { status: 500 });
  }
}