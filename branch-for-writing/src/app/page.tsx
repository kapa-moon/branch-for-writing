"use client";

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation'; // For redirecting to sign-in page
import React from 'react';

export default function Home() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();

  // sessionData contains { user, session } or null
  const user = sessionData?.user;
  const session = sessionData?.session;

  const handleSignIn = () => {
    router.push('/signin'); // Redirect to your custom sign-in page
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh(); // Refresh to update session state on the page
  };

  if (isPending) {
    return <main className="flex flex-col items-center gap-4 p-10"><p>Loading session...</p></main>;
  }
  
  if (error) {
    return <main className="flex flex-col items-center gap-4 p-10"><p>Error loading session: {error.message}</p></main>;
  }

  return (
    <main className="flex flex-col items-center gap-4 p-10">
      {user && session ? (
        <>
          <p>Hi {user.email || user.name || 'User'}</p>
          <button onClick={handleSignOut}>Sign out</button>
        </>
      ) : (
        <button onClick={handleSignIn}>Sign in</button>
      )}
    </main>
  );
}