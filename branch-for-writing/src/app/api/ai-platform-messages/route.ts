import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPlatformMessages, user } from '../../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * API endpoint for receiving AI platform messages from Chrome extension
 */

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

// Handle POST requests with AI platform message data
export async function POST(request: NextRequest) {
  try {
    // Add CORS headers to response
    const headers = buildCorsHeaders(request);
    
    // Parse the request body
    const body = await request.json();
    
    // Validate the request
    if (!body.id || !body.platform || !body.conversationId || !body.messageId) {
      return NextResponse.json(
        { error: 'Invalid request: required fields missing (id, platform, conversationId, messageId)' },
        { status: 400, headers }
      );
    }
    
    // Transform message entry to match database schema
    const dbMessage = {
      id: body.id,
      platform: body.platform,
      conversationId: body.conversationId,
      messageId: body.messageId,
      sender: body.sender || 'unknown',
      content: body.content || '',
      timestamp: new Date(body.timestamp),
      metadata: body.metadata || null,
      userId: body.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Auto-create test user if they don't exist (for testing only)
    try {
      await db.insert(user).values({
        id: body.userId,
        email: `${body.userId}@test.com`,
        name: `Test User ${body.userId}`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
    } catch (userError) {
      // User might already exist, that's fine
      console.log('User creation skipped (might already exist):', body.userId);
    }

    // Insert message into database
    try {
      await db.insert(aiPlatformMessages).values(dbMessage).onConflictDoNothing();
      
      console.log(`Successfully inserted AI platform message from ${body.platform}`);
      
      return NextResponse.json(
        { 
          success: true, 
          message: 'Message logged successfully',
          platform: body.platform
        },
        { status: 200, headers }
      );
      
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
    console.error('Error processing AI platform message:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}

// Handle GET requests for fetching AI conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const platform = searchParams.get('platform');
    const conversationId = searchParams.get('conversation_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Build where conditions
    const conditions = [];
    if (userId) conditions.push(eq(aiPlatformMessages.userId, userId));
    if (platform) conditions.push(eq(aiPlatformMessages.platform, platform));
    if (conversationId) conditions.push(eq(aiPlatformMessages.conversationId, conversationId));
    
    // Query the database
    const messages = await db
      .select()
      .from(aiPlatformMessages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiPlatformMessages.timestamp))
      .limit(limit);
    
    // Group messages by conversation
    const conversations: Record<string, any> = {};
    messages.forEach(msg => {
      if (!conversations[msg.conversationId]) {
        conversations[msg.conversationId] = {
          conversationId: msg.conversationId,
          platform: msg.platform,
          messages: [],
          lastMessageTime: msg.timestamp,
          messageCount: 0
        };
      }
      conversations[msg.conversationId].messages.push(msg);
      conversations[msg.conversationId].messageCount++;
      
      // Update last message time if this message is more recent
      if (new Date(msg.timestamp) > new Date(conversations[msg.conversationId].lastMessageTime)) {
        conversations[msg.conversationId].lastMessageTime = msg.timestamp;
      }
    });
    
    return NextResponse.json(
      {
        success: true,
        conversations: Object.values(conversations),
        totalMessages: messages.length,
        filters: { userId, platform, conversationId, limit }
      },
      { status: 200, headers: buildCorsHeaders(request) }
    );
    
  } catch (error) {
    console.error('Error fetching AI platform messages:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}
