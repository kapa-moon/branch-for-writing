'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

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
    return <p>Loading session...</p>;
  }

  if (error) {
    return <p>Error loading session: {error.message}</p>;
  }

  if (user && session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <p>Signed in as {user.email || user.name || 'User'}</p>
        <button 
          onClick={handleSignOut}
          style={{
            padding: '8px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <p>You are not signed in.</p>
      <button 
        onClick={() => router.push('/signin')}
        style={{
          padding: '8px 12px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign In
      </button>
      <button 
        onClick={() => router.push('/signup')}
        style={{
          padding: '8px 12px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign Up
      </button>
    </div>
  );
} 