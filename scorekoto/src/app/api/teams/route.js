import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET() {
  try {
    // Fetch all rows from the team table
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