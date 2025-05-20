"use client";

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import React from 'react';
import Link from 'next/link'; // Import Link for navigation

export default function HomePage() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();

  const user = sessionData?.user;

  const handleSignIn = () => {
    router.push('/signin');
  };

  // The Sign Out button is now part of the AuthStatus component in the layout
  // So, we don't strictly need a separate sign-out button here unless desired.

  if (isPending) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Loading session...</p>
      </main>
    );
  }
  
  if (error) {
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <p>Error loading session: {error.message}</p>
        <button onClick={handleSignIn} style={{ marginTop: '20px', padding: '10px 15px' }}>
          Go to Sign In
        </button>
      </main>
    );
  }

  if (user) {
    // User is signed in - show a welcome message and dashboard/links
    return (
      <main style={{ textAlign: 'center', padding: '50px' }}>
        <h1>Welcome, {user.name || user.email || 'User'}!</h1>
        <p>You have successfully signed in.</p>
        <p style={{ marginTop: '20px' }}>This is your dashboard or home page content.</p>
        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <Link href="/writing-canvas" style={{ fontSize: '1.1em', padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            Go to Writing Canvas
          </Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
            <Link href="/profile" style={{ textDecoration: 'underline', color: 'blue' }}>View Profile</Link>
            <Link href="/settings" style={{ textDecoration: 'underline', color: 'blue' }}>Account Settings</Link>
          </div>
        </div>
        {/* The AuthStatus component in the header will provide the sign-out option */}
      </main>
    );
  }

  // User is not signed in - show a generic landing page or prompt to sign in/up
  return (
    <main style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Welcome to Our Application!</h1>
      <p>Please sign in or sign up to continue.</p>
      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button 
          onClick={handleSignIn} 
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          Sign In
        </button>
        <button 
          onClick={() => router.push('/signup')} 
          style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Sign Up
        </button>
      </div>
    </main>
  );
}