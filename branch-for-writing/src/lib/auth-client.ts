import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// You can also export specific methods if you prefer for tree-shaking or convenience:
// export const { signIn, signUp, signOut, useSession, Provider } = authClient; 