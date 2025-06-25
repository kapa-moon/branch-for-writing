import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiComparisonResults } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function DELETE(request: NextRequest) {
  try {
    const { mainDocId, refDocId } = await request.json();
    
    // Get user session for authentication
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      console.error('🚫 Unauthorized cache clear request - no user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mainDocId || !refDocId) {
      console.error('❌ Invalid cache clear request - missing document IDs:', { mainDocId, refDocId });
      return NextResponse.json({ error: 'mainDocId and refDocId are required' }, { status: 400 });
    }

    console.log('🗑️ Clearing AI comparison cache for user:', session.user.id, { mainDocId, refDocId });

    // Delete the specific cached comparison
    const deletedRows = await db
      .delete(aiComparisonResults)
      .where(and(
        eq(aiComparisonResults.mainDocId, mainDocId),
        eq(aiComparisonResults.refDocId, refDocId),
        eq(aiComparisonResults.userId, session.user.id)
      ));

    console.log('✅ AI comparison cache cleared successfully for:', { mainDocId, refDocId });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      mainDocId,
      refDocId
    });
  } catch (error) {
    console.error('❌ Error clearing comparison cache:', error);
    
    let errorMessage = 'Failed to clear cache';
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format';
      statusCode = 400;
    } else if (error?.message?.includes('database') || error?.message?.includes('db')) {
      errorMessage = 'Database connection error';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: statusCode });
  }
} 