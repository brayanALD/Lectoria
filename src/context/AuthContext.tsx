import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthState,
  type User,
} from '../services/authService';
import { ensureUserProfile } from '../services/userService';

interface AuthContextValue {
  user: User | null;
  /** true hasta que Firebase restaura (o descarta) la sesión guardada. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(
    () =>
      subscribeToAuthState((nextUser) => {
        setUser(nextUser);
        setInitializing(false);
      }),
    [],
  );

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    ensureUserProfile(uid).catch((error) => {
      console.warn('No se pudo crear el perfil del usuario', error);
    });
  }, [uid]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: signInWithEmail,
      signUp: signUpWithEmail,
      signOut: signOutUser,
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
