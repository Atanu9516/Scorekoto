import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'scorekoto_super_secret_jwt_key_2026';
const TOKEN_EXPIRY = '7d';

// Hash plain text password
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare plain text password with hashed password
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Extract authenticated user from Next.js Request (via cookie or Authorization header)
export async function getUserFromRequest(request) {
  try {
    let token = null;

    // Check cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...v] = c.trim().split('=');
        return [key, decodeURIComponent(v.join('='))];
      })
    );

    if (cookies.scorekoto_token) {
      token = cookies.scorekoto_token;
    }

    // Check Authorization header fallback
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return null;
    }

    // Query user from database to ensure user still exists and get latest data
    const query = `
      SELECT user_id, username, email, role, created_at
      FROM users
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [decoded.userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      ...user,
      role: user.role || 'user',
    };
  } catch (error) {
    console.error('Error authenticating user from request:', error);
    return null;
  }
}

// Extract authenticated admin user from Next.js Request
export async function getAdminFromRequest(request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') {
    return null;
  }
  return user;
}
