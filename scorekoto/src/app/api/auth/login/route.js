import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { comparePassword, generateToken } from '../../../lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { identifier, password, role: requestedRole, asAdmin } = body;

    if (!identifier || !identifier.trim() || !password) {
      return NextResponse.json(
        { error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim();

    // Query user by username or email including role
    const query = `
      SELECT user_id, username, email, password_hash, role, created_at
      FROM users
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await pool.query(query, [cleanIdentifier]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const userRole = user.role || 'user';

    // Verify password
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    // If logging in through Admin Portal, enforce admin role check
    if ((requestedRole === 'admin' || asAdmin === true) && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Access Denied: This account does not have administrator privileges.' },
        { status: 403 }
      );
    }

    // Generate JWT token with role
    const token = generateToken({
      userId: user.user_id,
      username: user.username,
      email: user.email,
      role: userRole,
    });

    const userPayload = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: userRole,
      created_at: user.created_at,
    };

    const response = NextResponse.json({
      success: true,
      message: userRole === 'admin' ? 'Admin authenticated successfully' : 'Logged in successfully',
      user: userPayload,
    });

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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again later.' },
      { status: 500 }
    );
  }
}
