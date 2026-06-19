/**
 * Better Auth Client Configuration
 * 
 * Initializes the Better Auth client SDK for the frontend.
 * This client handles:
 * - Session management (cookies are automatically sent)
 * - Sign up / Sign in / Sign out API calls
 * - Organization management
 * 
 * The client communicates directly with the Better Auth endpoints
 * on the backend. No Auth.js needed — Better Auth handles everything.
 */

import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? '/_/backend' 
      : 'http://localhost:3001'),

  /** Organization plugin for multi-tenancy support on the client */
  plugins: [organizationClient()],
});

/**
 * Convenience exports for commonly used auth methods.
 * These are React hooks that can be used in client components.
 */
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
