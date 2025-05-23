'use client'; // If AuthStatus is used here, RootLayout becomes a client component

import React from 'react';
// No explicit AuthProvider import seems to be needed from better-auth/react here
// The authClient from '@/lib/auth-client' will be used by hooks/components directly
import AuthStatus from '@/components/AuthStatus'; // Assuming @ is mapped to src/
import { AuthUIProvider } from '@daveyplate/better-auth-ui';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <html lang="en" style={{ height: '100vh', width: '100vw', margin: 0, padding: 0, overflow: 'hidden' }}>
      <head>
        <title>Branch Writing</title>
        <link rel="icon" href="https://cdn.glitch.global/f730a545-770d-4d15-a531-67a7393d9ea2/favicon.png?v=1747970940799" />
        {/* Example: <link rel="icon" href="/my-custom-favicon.png" /> */}
        {/* Or for an .ico file: <link rel="icon" href="/favicon.ico" /> */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:ital,wght@0,200..800;1,200..800&family=Londrina+Sketch&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&family=Mulish:ital,wght@0,200..1000;1,200..1000&family=Reddit+Mono:wght@200..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Rock+Salt&display=swap" rel="stylesheet" />
        
      </head>
      <body style={{ height: '100%', width: '100%', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}> {/* Wrapper div for styling */}
          <AuthUIProvider
            authClient={authClient}
            navigate={router.push}
            replace={router.replace}
            onSessionChange={() => router.refresh()}
            Link={Link} // Pass the Next.js Link component
            // You can add other props here to customize behavior e.g.
            // socialProviders={['github', 'google']}
            forgotPassword={false}
            // signUpFields={['name']} // If you want to include a name field in sign-up
          >
            <header style={{ display: 'flex', alignItems: 'center', height: '5vh', padding: '0.2rem 20px', borderBottom: '1px solid #eee', flexShrink: 0, boxSizing: 'border-box' }}>
              <AuthStatus />
            </header>
            <main style={{ height: '95vh', overflowY: 'hidden', boxSizing: 'border-box' }}> {/* Main takes 95% height, content must fit or will be hidden */}
              {children}
            </main>
          </AuthUIProvider>
        </div>
      </body>
    </html>
  );
}