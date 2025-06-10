import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentVersions } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// DELETE /api/versions/[id] - Delete a specific version
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete the version (only if it belongs to the current user)
    const result = await db
      .delete(documentVersions)
      .where(
        and(
          eq(documentVersions.id, id),
          eq(documentVersions.userId, session.user.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Version not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Version deleted successfully' });
  } catch (error) {
    console.error('Error deleting version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 