'use client';

import React from 'react';
import { SignUpForm, authLocalization } from '@daveyplate/better-auth-ui';
// import { useRouter } from 'next/navigation'; // May not be needed if AuthUIProvider handles redirects

export default function SignUpPage() {
  // const router = useRouter(); // May not be needed

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 200px)' }}>
      <SignUpForm 
        localization={authLocalization} // Pass the default localization
        // Check @daveyplate/better-auth-ui docs for specific props for SignUpForm 
        // e.g., for fields like 'name' if your AuthUIProvider's signUpFields prop is configured
        // socialProviders={[]} // Example: to show only email/password if you don't have social auth configured
      />
    </div>
  );
} 