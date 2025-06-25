import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentVersions } from '../../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// PATCH /api/versions/[id] - Toggle merge status of a specific version
export async function PATCH(
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
    const { merged } = await request.json();

    // Update the merge status (only if it belongs to the current user)
    const result = await db
      .update(documentVersions)
      .set({ 
        merged: merged,
        updatedAt: new Date()
      })
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

    return NextResponse.json({ 
      message: `Version ${merged ? 'merged' : 'reopened'} successfully`,
      version: {
        id: result[0].id,
        name: result[0].name,
        merged: result[0].merged,
        updatedAt: result[0].updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating version merge status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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