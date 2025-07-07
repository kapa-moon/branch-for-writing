import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiChatRecords } from '../../../../../database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { 
      mainDocId,
      refDocId,
      aiCommentIds
    } = await request.json();

    // Get user session for authentication
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      console.error('🚫 Unauthorized request - no user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📋 Loading chat history for AI comments:', aiCommentIds);

    try {
      // Fetch all chat records for the specified AI comments
      const chatRecords = await db
        .select()
        .from(aiChatRecords)
        .where(and(
          eq(aiChatRecords.mainDocId, mainDocId),
          eq(aiChatRecords.refDocId, refDocId),
          eq(aiChatRecords.userId, session.user.id),
          inArray(aiChatRecords.aiCommentId, aiCommentIds)
        ))
        .orderBy(aiChatRecords.createdAt);

      // Group chat records by AI comment ID
      const chatThreads: { [aiCommentId: string]: any[] } = {};
      
      chatRecords.forEach(record => {
        if (record.aiCommentId) {
          if (!chatThreads[record.aiCommentId]) {
            chatThreads[record.aiCommentId] = [];
          }
          chatThreads[record.aiCommentId].push(record);
        }
      });

      console.log(`✅ Loaded chat history for ${Object.keys(chatThreads).length} AI comments`);

      return NextResponse.json({
        chatThreads: chatThreads
      });

    } catch (dbError) {
      console.error('❌ Database error while loading chat history:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Chat history loading error:', error);
    
    let errorMessage = 'Failed to load chat history';
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format';
      statusCode = 400;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: statusCode });
  }
} 