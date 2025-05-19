'use client';

import React from 'react';
import { SignInForm, authLocalization } from '@daveyplate/better-auth-ui';
// import { useRouter } from 'next/navigation'; // May not be needed if AuthUIProvider handles redirects

export default function SignInPage() {
  // const router = useRouter(); // May not be needed

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)' }}>
      <SignInForm 
        localization={authLocalization}
        // onSuccess and onError might be handled by AuthUIProvider or internal component logic
        // Check @daveyplate/better-auth-ui docs for specific props for SignInForm if needed for finer control
        // socialProviders={[]} // Example: to show only email/password if you don't have social auth configured
      />
    </div>
  );
} 