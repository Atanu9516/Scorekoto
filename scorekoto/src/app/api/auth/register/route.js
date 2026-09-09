import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { hashPassword, generateToken } from '../../../lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Validation
    if (!username || !username.trim()) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username or email is already taken
    const existingUserQuery = `
      SELECT user_id, username, email 
      FROM users 
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
      LIMIT 1;
    `;
    const existingResult = await pool.query(existingUserQuery, [cleanUsername, cleanEmail]);

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 409 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Insert new user into database
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, role, created_at)
      VALUES ($1, $2, $3, 'user', CURRENT_TIMESTAMP)
      RETURNING user_id, username, email, role, created_at;
    `;
    const insertResult = await pool.query(insertQuery, [cleanUsername, cleanEmail, passwordHash]);
    const newUser = insertResult.rows[0];

    // Generate JWT token
    const token = generateToken({
      userId: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role || 'user',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role || 'user',
        created_at: newUser.created_at,
      },
    }, { status: 201 });

    // Set secure HTTP-only cookie
    response.cookies.set('scorekoto_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again later.' },
      { status: 500 }
    );
  }
}
