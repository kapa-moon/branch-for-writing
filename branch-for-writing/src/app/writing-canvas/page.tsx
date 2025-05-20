'use client';

import React, { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import TiptapEditor from '@/components/TiptapEditor';

export default function WritingCanvasPage() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !sessionData?.user) {
      // If not loading and no user, redirect to sign-in
      router.replace('/signin?message=auth_required');
    }
  }, [isPending, sessionData, router]);

  if (isPending) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Loading Writing Canvas...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Error loading session: {error.message}. Please try signing in again.</p>
        <button onClick={() => router.push('/signin')} style={{ marginTop: '20px', padding: '10px 15px' }}>
          Go to Sign In
        </button>
      </main>
    );
  }
  
  if (!sessionData?.user) {
    // This state should ideally be brief due to the useEffect redirect
    // but it's good to have a fallback UI.
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Access denied. Redirecting to sign-in...</p>
      </main>
    );
  }

  // User is authenticated, show the page content
  return (
    <main style={{ padding: '20px' }}>
      <h1>Writing Canvas</h1>
      <p>Welcome, {sessionData.user.name || sessionData.user.email}! This is your dedicated space to write.</p>
      {/* Add your writing canvas components and logic here */}
      <div style={{ marginTop: '20px', border: '1px dashed #ccc', minHeight: '400px', padding: '10px' }}>
        <TiptapEditor />
      </div>
    </main>
  );
} 