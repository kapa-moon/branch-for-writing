import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFeedback, user } from '../../../../database/schema';

/**
 * API endpoint for receiving user feedback from Chrome extension popup
 */

// Build permissive CORS headers
function buildCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowOrigin = origin && origin !== 'null' ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  } as Record<string, string>;
}

// Handle OPTIONS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: buildCorsHeaders(request)
  });
}

// Handle POST requests with user feedback
export async function POST(request: NextRequest) {
  try {
    const headers = buildCorsHeaders(request);
    
    // Parse the request body
    const body = await request.json();
    const { user_id, content } = body;
    
    // Validate the request
    if (!user_id || !content) {
      return NextResponse.json(
        { error: 'Invalid request: user_id and content are required' },
        { status: 400, headers }
      );
    }
    
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: content must be a non-empty string' },
        { status: 400, headers }
      );
    }
    
    // Auto-create user if they don't exist
    try {
      await db.insert(user).values({
        id: user_id,
        email: `${user_id}@test.com`,
        name: `Extension User ${user_id}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
    } catch (userError) {
      // User might already exist, that's fine
      console.log('User creation skipped (might already exist):', user_id);
    }
    
    // Generate unique ID for feedback
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert feedback into database
    try {
      await db.insert(userFeedback).values({
        id: feedbackId,
        userId: user_id,
        content: content.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Successfully inserted user feedback from user: ${user_id}`);
      
      return NextResponse.json(
        { 
          success: true, 
          message: 'Feedback submitted successfully',
          id: feedbackId
        },
        { status: 200, headers }
      );
      
    } catch (dbError: any) {
      console.error('Database error inserting user feedback:', dbError);
      
      return NextResponse.json(
        { 
          error: 'Database error while saving feedback',
          details: dbError?.message || dbError?.toString() || 'Unknown error',
          code: dbError?.code || 'UNKNOWN'
        },
        { status: 500, headers }
      );
    }
    
  } catch (error) {
    console.error('Error processing user feedback:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}
