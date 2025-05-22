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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:ital,wght@0,200..800;1,200..800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&family=Mulish:ital,wght@0,200..1000;1,200..1000&family=Reddit+Mono:wght@200..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Rock+Salt&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthUIProvider
          authClient={authClient}
          navigate={router.push}
          replace={router.replace}
          onSessionChange={() => router.refresh()}
          Link={Link} // Pass the Next.js Link component
          // You can add other props here to customize behavior e.g.
          // socialProviders={['github', 'google']} 
          // forgotPassword={true}
          // signUpFields={['name']} // If you want to include a name field in sign-up
        >
          <header style={{ padding: '0.2rem', borderBottom: '1px solid #eee', marginBottom: '0rem' }}>
            <AuthStatus />
          </header>
          <main>
            {children}
          </main>
        </AuthUIProvider>
      </body>
    </html>
  );
}