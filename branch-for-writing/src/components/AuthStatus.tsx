'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import './auth-status.css'; // Import the CSS file

export default function AuthStatus() {
  const { data: sessionData, isPending, error } = authClient.useSession();
  const router = useRouter();

  const user = sessionData?.user;
  const session = sessionData?.session;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  if (isPending) {
    return <div className="loading-text"><p>Loading session...</p></div>;
  }

  if (error) {
    return <div className="error-text"><p>Error loading session: {error.message}</p></div>;
  }

  if (user && session) {
    return (
      <div className="auth-status-container">
        <p className="auth-status-text">Signed in as {user.name || 'User'}</p>
        <button 
          onClick={handleSignOut}
          className="sign-out-button"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-status-container">
      <p className="auth-status-text">You are not signed in.</p>
      <button 
        onClick={() => router.push('/signin')}
        className="sign-in-button"
      >
        Sign In
      </button>
      <button 
        onClick={() => router.push('/signup')}
        className="sign-up-button"
      >
        Sign Up
      </button>
    </div>
  );
} 