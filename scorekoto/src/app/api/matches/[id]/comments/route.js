import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import { getUserFromRequest } from '@/app/lib/auth';

// GET all comments for a match ordered by time
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!matchId || isNaN(matchId)) {
      return NextResponse.json(
        { error: 'Invalid match ID' },
        { status: 400 }
      );
    }

    const query = `
      SELECT 
        comment_id, 
        match_id, 
        user_id, 
        username, 
        comment_text, 
        reaction, 
        created_at
      FROM match_comment
      WHERE match_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query, [matchId]);

    return NextResponse.json({
      success: true,
      comments: result.rows,
    });
  } catch (err) {
    console.error('Error fetching match comments:', err);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST a new comment / reaction for a match
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const matchId = Number(id);

    if (!matchId || isNaN(matchId)) {
      return NextResponse.json(
        { error: 'Invalid match ID' },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(request);
    const body = await request.json();
    const { comment_text, reaction, guest_name } = body;

    if (!comment_text || !comment_text.trim()) {
      return NextResponse.json(
        { error: 'Comment text cannot be empty' },
        { status: 400 }
      );
    }

    // Determine author username
    const username = user ? user.username : (guest_name?.trim() || 'Football Fan');
    const userId = user ? user.user_id : null;
    const selectedReaction = reaction || '⚽';

    const insertQuery = `
      INSERT INTO match_comment (match_id, user_id, username, comment_text, reaction, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING comment_id, match_id, user_id, username, comment_text, reaction, created_at;
    `;

    const result = await pool.query(insertQuery, [
      matchId,
      userId,
      username,
      comment_text.trim(),
      selectedReaction,
    ]);

    return NextResponse.json({
      success: true,
      message: 'Comment added successfully',
      comment: result.rows[0],
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    return NextResponse.json(
      { error: 'Failed to post comment' },
      { status: 500 }
    );
  }
}

// DELETE a comment (author or admin)
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get('comment_id'), 10);

    if (!commentId || isNaN(commentId)) {
      return NextResponse.json(
        { error: 'Valid comment_id is required' },
        { status: 400 }
      );
    }

    // Check if user is owner or admin
    if (user.role === 'admin') {
      await pool.query('DELETE FROM match_comment WHERE comment_id = $1', [commentId]);
    } else {
      const res = await pool.query(
        'DELETE FROM match_comment WHERE comment_id = $1 AND user_id = $2',
        [commentId, user.user_id]
      );
      if (res.rowCount === 0) {
        return NextResponse.json(
          { error: 'Permission denied or comment not found' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting comment:', err);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
