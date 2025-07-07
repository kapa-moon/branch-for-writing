import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentVersions, mainDocuments } from '../../../../database/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { TiptapDocument } from '@/types/tiptap';

// GET /api/versions - Get all versions (both locked main documents and named versions)
export async function GET() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get locked main documents (saved versions)
    const lockedMainDocs = await db
      .select()
      .from(mainDocuments)
      .where(and(
        eq(mainDocuments.userId, session.user.id),
        eq(mainDocuments.isLocked, true)
      ))
      .orderBy(desc(mainDocuments.createdAt));

    // Get named document versions
    const namedVersions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.userId, session.user.id))
      .orderBy(desc(documentVersions.createdAt));

    // Combine and format all versions
    const allVersions = [
      // Locked main documents (saved versions) - these don't have merge status
      ...lockedMainDocs.map(doc => ({
        id: doc.id,
        name: `Saved Version: ${doc.title}`,
        timestamp: doc.createdAt.toLocaleDateString(),
        content: doc.content as TiptapDocument,
        type: 'saved_version' as const,
        createdAt: doc.createdAt.toISOString(),
        merged: false, // Saved versions don't have merge functionality
      })),
      // Named versions - include merge status and notes
      ...namedVersions.map(version => ({
        id: version.id,
        name: version.name,
        timestamp: version.createdAt.toLocaleDateString(),
        content: version.content as TiptapDocument,
        type: 'named_version' as const,
        createdAt: version.createdAt.toISOString(),
        merged: version.merged || false, // Include merge status from database
        discussionNotes: version.discussionNotes || '', // Include discussion notes
        prepNotes: version.prepNotes || '', // Include prep notes
      }))
    ];

    // Sort all versions by creation date (newest first)
    allVersions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allVersions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/versions - Create a named version (document_versions table)
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, content } = await request.json();

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    // Generate unique ID
    const versionId = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newVersion = await db
      .insert(documentVersions)
      .values({
        id: versionId,
        name,
        content,
        userId: session.user.id,
        merged: false, // New versions start as not merged
      })
      .returning();

    return NextResponse.json({
      id: newVersion[0].id,
      name: newVersion[0].name,
      timestamp: newVersion[0].createdAt.toLocaleDateString(),
      content: newVersion[0].content as TiptapDocument,
      type: 'named_version',
      createdAt: newVersion[0].createdAt.toISOString(),
      merged: newVersion[0].merged || false,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 