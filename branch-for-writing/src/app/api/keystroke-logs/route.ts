import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { keystrokeLogs, user } from '../../../../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * API endpoint for receiving keystroke logs from Chrome extension
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

// Handle POST requests with keystroke log data
export async function POST(request: NextRequest) {
  try {
    // Add CORS headers to response
    const headers = buildCorsHeaders(request);
    
    // Parse the request body
    const body = await request.json();
    const { logs } = body;
    
    // Validate the request
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Invalid request: logs array is required' },
        { status: 400, headers }
      );
    }
    
    if (logs.length === 0) {
      return NextResponse.json(
        { success: true, message: 'No logs to process' },
        { status: 200, headers }
      );
    }
    
    // Validate and transform each log entry
    const validatedLogs = [];
    for (const log of logs) {
      try {
        // Required fields validation
        if (!log.id || !log.doc_id || !log.user_id || !log.session_id) {
          console.error('Missing required fields in log entry:', log);
          continue;
        }
        
        // Transform log entry to match database schema
        const dbLog = {
          id: log.id,
          docId: log.doc_id,
          userId: log.user_id, // Note: This should map to an actual user in your system
          sessionId: log.session_id,
          timestamp: new Date(log.timestamp),
          beforeText: log.before_text || '',
          afterText: log.after_text || '',
          diffData: log.diff_data || [],
          actionType: log.action_type || 'unknown',
          cursorPosition: log.cursor_position || null,
          textLengthBefore: log.text_length_before || 0,
          textLengthAfter: log.text_length_after || 0,
          keystrokeCount: log.keystroke_count || 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        validatedLogs.push(dbLog);
      } catch (error) {
        console.error('Error validating log entry:', error, log);
      }
    }
    
    if (validatedLogs.length === 0) {
      return NextResponse.json(
        { error: 'No valid log entries found' },
        { status: 400, headers }
      );
    }
    
    // Auto-create test users if they don't exist (for testing only)
    const uniqueUserIds = [...new Set(validatedLogs.map(log => log.userId))];
    for (const userId of uniqueUserIds) {
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
        // User might already exist, that's fine
        console.log('User creation skipped (might already exist):', userId);
      }
    }

    // Insert logs into database
    try {
      await db.insert(keystrokeLogs).values(validatedLogs).onConflictDoNothing();
      
      console.log(`Successfully inserted ${validatedLogs.length} keystroke logs`);
      
      return NextResponse.json(
        { 
          success: true, 
          message: `Inserted ${validatedLogs.length} keystroke logs`,
          processed: validatedLogs.length,
          total_received: logs.length
        },
        { status: 200, headers }
      );
      
    } catch (dbError: any) {
      console.error('Database error inserting keystroke logs:', dbError);
      
      return NextResponse.json(
        { 
          error: 'Database error while saving logs',
          details: dbError?.message || dbError?.toString() || 'Unknown error',
          code: dbError?.code || 'UNKNOWN'
        },
        { status: 500, headers }
      );
    }
    
  } catch (error) {
    console.error('Error processing keystroke logs:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}

// Handle GET requests for testing/debugging
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('doc_id');
    const userId = searchParams.get('user_id');
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build where conditions
    const conditions = [];
    if (docId) conditions.push(eq(keystrokeLogs.docId, docId));
    if (userId) conditions.push(eq(keystrokeLogs.userId, userId));
    if (sessionId) conditions.push(eq(keystrokeLogs.sessionId, sessionId));
    
    // Query the database
    const logs = await db
      .select()
      .from(keystrokeLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(keystrokeLogs.timestamp)
      .limit(limit);
    
    return NextResponse.json(
      {
        success: true,
        logs,
        count: logs.length,
        filters: { docId, userId, sessionId, limit }
      },
      { status: 200, headers: buildCorsHeaders(request) }
    );
    
  } catch (error) {
    console.error('Error fetching keystroke logs:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(request) }
    );
  }
}