import { createAuthClient } from "better-auth/react";

// Ensure NEXT_PUBLIC_BETTER_AUTH_URL is set in your .env.local file (e.g., http://localhost:3000)
const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

export const authClient = createAuthClient({
  baseURL: baseURL, // Use the baseURL
});

// You can also export specific methods if you prefer for tree-shaking or convenience:
// export const { signIn, signUp, signOut, useSession, Provider } = authClient; 