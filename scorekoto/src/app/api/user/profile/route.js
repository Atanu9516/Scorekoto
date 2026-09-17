import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getUserFromRequest } from '@/app/lib/auth';

// GET: Fetch current user profile, favorite counts, and recent reactions
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get favorite counts
    const teamCountRes = await pool.query(
      'SELECT COUNT(*) FROM user_favorite_team WHERE user_id = $1',
      [user.user_id]
    );
    const playerCountRes = await pool.query(
      'SELECT COUNT(*) FROM user_favorite_player WHERE user_id = $1',
      [user.user_id]
    );
    const leagueCountRes = await pool.query(
      'SELECT COUNT(*) FROM user_favorite_league WHERE user_id = $1',
      [user.user_id]
    );

    // Get user's match comments / reactions
    const commentsRes = await pool.query(
      `SELECT 
         c.comment_id,
         c.match_id,
         c.comment_text,
         c.reaction,
         c.created_at,
         ht.name as home_team,
         at.name as away_team
       FROM match_comment c
       LEFT JOIN match m ON c.match_id = m.match_id
       LEFT JOIN team ht ON m.home_team_id = ht.team_id
       LEFT JOIN team at ON m.away_team_id = at.team_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [user.user_id]
    );

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
      stats: {
        favoriteTeams: parseInt(teamCountRes.rows[0].count, 10),
        favoritePlayers: parseInt(playerCountRes.rows[0].count, 10),
        favoriteLeagues: parseInt(leagueCountRes.rows[0].count, 10),
        totalReactions: commentsRes.rows.length,
      },
      recentReactions: commentsRes.rows,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

// PUT: Update display name/username and email
export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, email } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : user.email;

    // Check if new username or email is already taken by another user
    const checkRes = await pool.query(
      `SELECT user_id, username, email FROM users 
       WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)) 
         AND user_id != $3 
       LIMIT 1`,
      [cleanUsername, cleanEmail, user.user_id]
    );

    if (checkRes.rows.length > 0) {
      const conflict = checkRes.rows[0];
      if (conflict.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
    }

    // Update user record
    const updateRes = await pool.query(
      `UPDATE users 
       SET username = $1, email = $2 
       WHERE user_id = $3 
       RETURNING user_id, username, email, role, created_at`,
      [cleanUsername, cleanEmail, user.user_id]
    );

    // Also sync username in recent match comments
    await pool.query(
      `UPDATE match_comment SET username = $1 WHERE user_id = $2`,
      [cleanUsername, user.user_id]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

