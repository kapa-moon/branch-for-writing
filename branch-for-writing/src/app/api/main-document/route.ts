import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mainDocuments } from '../../../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { TiptapDocument } from '@/types/tiptap';

// GET /api/main-document - Get the current working document (unlocked)
export async function GET() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current working document (unlocked)
    const currentWorkingDoc = await db
      .select()
      .from(mainDocuments)
      .where(and(
        eq(mainDocuments.userId, session.user.id),
        eq(mainDocuments.isLocked, false)
      ))
      .orderBy(desc(mainDocuments.createdAt))
      .limit(1);

    if (currentWorkingDoc.length === 0) {
      return NextResponse.json({ content: null, title: null });
    }

    return NextResponse.json({
      id: currentWorkingDoc[0].id,
      title: currentWorkingDoc[0].title,
      content: currentWorkingDoc[0].content as TiptapDocument,
      isLocked: currentWorkingDoc[0].isLocked,
      createdAt: currentWorkingDoc[0].createdAt.toISOString(),
      updatedAt: currentWorkingDoc[0].updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching main document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/main-document - Lock current version and create new working document
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, title } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Step 1: Lock the current working document (if exists)
    const currentWorkingDoc = await db
      .select()
      .from(mainDocuments)
      .where(and(
        eq(mainDocuments.userId, session.user.id),
        eq(mainDocuments.isLocked, false)
      ))
      .limit(1);

    if (currentWorkingDoc.length > 0) {
      await db
        .update(mainDocuments)
        .set({
          isLocked: true,
          updatedAt: new Date(),
        })
        .where(eq(mainDocuments.id, currentWorkingDoc[0].id));
    }

    // Step 2: Create new working document
    const docId = `main_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newWorkingDoc = await db
      .insert(mainDocuments)
      .values({
        id: docId,
        title: title || 'Untitled Article',
        content,
        isLocked: false, // New working document
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json({
      id: newWorkingDoc[0].id,
      title: newWorkingDoc[0].title,
      content: newWorkingDoc[0].content as TiptapDocument,
      isLocked: newWorkingDoc[0].isLocked,
      createdAt: newWorkingDoc[0].createdAt.toISOString(),
      updatedAt: newWorkingDoc[0].updatedAt.toISOString(),
      message: 'Version locked and new working document created'
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving main document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/main-document - Auto-save current working document (update content only)
export async function PUT(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, title } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Get the current working document (unlocked)
    const currentWorkingDoc = await db
      .select()
      .from(mainDocuments)
      .where(and(
        eq(mainDocuments.userId, session.user.id),
        eq(mainDocuments.isLocked, false)
      ))
      .limit(1);

    if (currentWorkingDoc.length === 0) {
      // No working document exists, create one
      const docId = `main_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newWorkingDoc = await db
        .insert(mainDocuments)
        .values({
          id: docId,
          title: title || 'Untitled Article',
          content,
          isLocked: false,
          userId: session.user.id,
        })
        .returning();

      return NextResponse.json({
        id: newWorkingDoc[0].id,
        title: newWorkingDoc[0].title,
        content: newWorkingDoc[0].content as TiptapDocument,
        isLocked: newWorkingDoc[0].isLocked,
        createdAt: newWorkingDoc[0].createdAt.toISOString(),
        updatedAt: newWorkingDoc[0].updatedAt.toISOString(),
        message: 'New working document created'
      }, { status: 201 });
    }

    // Update existing working document
    const updatedDoc = await db
      .update(mainDocuments)
      .set({
        content,
        title: title || currentWorkingDoc[0].title, // Only update title if provided
        updatedAt: new Date(),
      })
      .where(eq(mainDocuments.id, currentWorkingDoc[0].id))
      .returning();

    return NextResponse.json({
      id: updatedDoc[0].id,
      title: updatedDoc[0].title,
      content: updatedDoc[0].content as TiptapDocument,
      isLocked: updatedDoc[0].isLocked,
      createdAt: updatedDoc[0].createdAt.toISOString(),
      updatedAt: updatedDoc[0].updatedAt.toISOString(),
      message: 'Working document auto-saved'
    });
  } catch (error) {
    console.error('Error auto-saving main document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/main-document - Update only the title of the current working document
export async function PATCH(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get the current working document (unlocked)
    const currentWorkingDoc = await db
      .select()
      .from(mainDocuments)
      .where(and(
        eq(mainDocuments.userId, session.user.id),
        eq(mainDocuments.isLocked, false)
      ))
      .limit(1);

    if (currentWorkingDoc.length === 0) {
      return NextResponse.json({ error: 'No working document found to update' }, { status: 404 });
    }

    // Update the title of the working document
    const updatedDoc = await db
      .update(mainDocuments)
      .set({
        title: title,
        updatedAt: new Date(),
      })
      .where(eq(mainDocuments.id, currentWorkingDoc[0].id))
      .returning();

    return NextResponse.json({
      id: updatedDoc[0].id,
      title: updatedDoc[0].title,
      content: updatedDoc[0].content as TiptapDocument,
      isLocked: updatedDoc[0].isLocked,
      createdAt: updatedDoc[0].createdAt.toISOString(),
      updatedAt: updatedDoc[0].updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating main document title:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 