import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ user: null });
  }
}
