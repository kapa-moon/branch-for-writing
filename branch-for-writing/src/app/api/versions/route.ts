import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentVersions } from '../../../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { TiptapDocument } from '@/types/tiptap';

// GET /api/versions - Get all versions for current user
export async function GET() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const versions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.userId, session.user.id))
      .orderBy(desc(documentVersions.createdAt));

    // Transform to match the expected interface
    const formattedVersions = versions.map(version => ({
      id: version.id,
      name: version.name,
      timestamp: version.createdAt.toISOString().replace('T', ' ').substring(0, 16),
      content: version.content as TiptapDocument,
    }));

    return NextResponse.json(formattedVersions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/versions - Create a new version
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
    const versionId = `v${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newVersion = await db
      .insert(documentVersions)
      .values({
        id: versionId,
        name,
        content,
        userId: session.user.id,
      })
      .returning();

    // Format for response
    const formattedVersion = {
      id: newVersion[0].id,
      name: newVersion[0].name,
      timestamp: newVersion[0].createdAt.toISOString().replace('T', ' ').substring(0, 16),
      content: newVersion[0].content as TiptapDocument,
    };

    return NextResponse.json(formattedVersion, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 