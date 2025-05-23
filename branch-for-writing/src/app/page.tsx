"use client";

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import React from 'react';
import Link from 'next/link'; // Import Link for navigation
import './homepage.css';

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
      <main className="homepage-container">
        <p>Loading session...</p>
      </main>
    );
  }
  
  if (error) {
    return (
      <main className="homepage-container">
        <p>Error loading session: {error.message}</p>
        <button onClick={handleSignIn} className="homepage-button" style={{ marginTop: '20px' }}>
          Go to Sign In
        </button>
      </main>
    );
  }

  if (user) {
    // User is signed in - show a welcome message and dashboard/links
    return (
      <main className="homepage-container">
        <h1>Welcome, {user.name || user.email || 'User'}!</h1>
        <p>You have successfully signed in.</p>
        <p style={{ marginTop: '20px' }}>[Placeholder for instructions]</p>
        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <Link href="/writing-canvas" className="link-button-homepage">
            <span className="link-text-go-to">Go to </span>
            <span className="link-text-writing-canvas">Writing Canvas</span>
          </Link>
          {/* <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
            <Link href="/profile" style={{ textDecoration: 'underline', color: 'blue' }}>View Profile</Link>
            <Link href="/settings" style={{ textDecoration: 'underline', color: 'blue' }}>Account Settings</Link>
          </div> */}
        </div>
        {/* The AuthStatus component in the header will provide the sign-out option */}
      </main>
    );
  }

  // User is not signed in - show a generic landing page or prompt to sign in/up
  return (
    <main className="homepage-container">
      <h1>Welcome to Our Application!</h1>
      <p>Please sign in or sign up to continue.</p>
      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button 
          onClick={handleSignIn} 
          className="homepage-button"
        >
          Sign In
        </button>
        <button 
          onClick={() => router.push('/signup')} 
          className="homepage-button signup-button-homepage"
        >
          Sign Up
        </button>
      </div>
    </main>
  );
}