import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPlatformMessages, user } from '../../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

// Build permissive CORS headers, reflecting the Origin when present (incl. chrome-extension://<id>)
function buildCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  // Allow all by default if no origin, otherwise reflect specific origin
  const allowOrigin = origin && origin !== 'null' ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Extension-Version',
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

export async function POST(request: NextRequest) {
  // Add CORS headers to response
  const headers = buildCorsHeaders(request);
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const { 
      id, 
      platform, 
      conversationId, 
      messageId, 
      sender, 
      content, 
      timestamp, 
      metadata, 
      userId 
    } = body;
    
    if (!id || !platform || !conversationId || !messageId || !sender || !content || !timestamp || !userId) {
          return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400, headers }
    );
    }
    
    // Validate sender
    if (!['user', 'ai'].includes(sender)) {
          return NextResponse.json(
      { error: 'Invalid sender. Must be "user" or "ai"' },
      { status: 400, headers }
    );
    }
    
    // Auto-create test user if they don't exist (for testing only)
    try {
      await db.insert(user).values({
        id: userId,
        email: `${userId}@test.com`,
        name: `Test User ${userId}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
    } catch (userError) {
      console.log('User creation skipped (might already exist):', userId);
    }
    
    // Insert the message into the database
    try {
      const result = await db.insert(aiPlatformMessages).values({
        id,
        platform,
        conversationId,
        messageId,
        sender,
        content,
        timestamp: new Date(timestamp),
        metadata: metadata || null,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
      
      console.log('AI Platform Message logged successfully:', {
        id,
        platform,
        conversationId,
        messageId,
        sender,
        contentLength: content.length,
        userId
      });
      
      return NextResponse.json({ 
        success: true, 
        messageId: id 
      }, { headers });
    } catch (dbError: any) {
      console.error('Database error inserting AI platform message:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error while saving message', 
          details: dbError?.message || dbError?.toString() || 'Unknown error',
          code: dbError?.code || 'UNKNOWN'
        },
        { status: 500, headers }
      );
    }
    
  } catch (error) {
    console.error('Error processing AI platform message request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

export async function GET(request: NextRequest) {
  // Add CORS headers to response
  const headers = buildCorsHeaders(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const platform = searchParams.get('platform');
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    if (!userId) {
          return NextResponse.json(
      { error: 'userId is required' },
      { status: 400, headers }
    );
    }
    
    // Build query conditions
    let conditions = [];
    if (userId) conditions.push(eq(aiPlatformMessages.userId, userId));
    if (platform) conditions.push(eq(aiPlatformMessages.platform, platform));
    if (conversationId) conditions.push(eq(aiPlatformMessages.conversationId, conversationId));
    
    // Query messages
    const messages = await db
      .select()
      .from(aiPlatformMessages)
      .where(and(...conditions))
      .orderBy(desc(aiPlatformMessages.timestamp))
      .limit(limit);
    
    return NextResponse.json({ 
      success: true, 
      messages,
      count: messages.length
    }, { headers });
    
  } catch (error) {
    console.error('Error fetching AI platform messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
