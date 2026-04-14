import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getUserId,
  signUp as signUpService,
  logIn as logInService,
  logOut as logOutService,
} from '@/services/user';
import { getUser } from '@/services/api';

interface UserContextValue {
  userId: string | null;
  loading: boolean;
  signUp: (username: string) => Promise<string>;
  logIn: (username: string) => Promise<string>;
  logOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getUserId();
        if (!stored) {
          setUserId(null);
          return;
        }
        // Verify the stored user still exists on the backend.
        // If the DB was wiped, clear AsyncStorage and force re-signup.
        try {
          await getUser(stored);
          setUserId(stored);
        } catch (err: any) {
          const notFound =
            err?.message?.includes('not found') || err?.message?.includes('404');
          if (notFound) {
            await logOutService();
            setUserId(null);
          } else {
            // Network error etc — keep the stored ID so the user isn't
            // logged out just because the server is unreachable.
            setUserId(stored);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signUp = useCallback(async (username: string) => {
    const id = await signUpService(username);
    setUserId(id);
    return id;
  }, []);

  const logIn = useCallback(async (username: string) => {
    const id = await logInService(username);
    setUserId(id);
    return id;
  }, []);

  const logOut = useCallback(async () => {
    await logOutService();
    setUserId(null);
  }, []);

  return React.createElement(
    UserContext.Provider,
    { value: { userId, loading, signUp, logIn, logOut } },
    children
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
