import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthState,
  type User,
} from '../services/authService';
import { ensureUserProfile } from '../services/userService';
import type { ProfileInput } from '../types/user';

interface AuthContextValue {
  user: User | null;
  /** true hasta que Firebase restaura (o descarta) la sesión guardada. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: ProfileInput) => Promise<void>;
  /** Devuelve false si el usuario cancela. Crea la cuenta si es la primera vez. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  // Datos del formulario de registro, para que la única escritura del perfil los incluya.
  const pendingProfile = useRef<ProfileInput | null>(null);

  useEffect(
    () =>
      subscribeToAuthState((nextUser) => {
        setUser(nextUser);
        setInitializing(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user) return;
    const input = pendingProfile.current ?? undefined;
    pendingProfile.current = null;
    ensureUserProfile(user, input).catch((error) => {
      console.warn('No se pudo crear el perfil del usuario', error);
    });
    // Depende solo del uid: debe ejecutarse al cambiar de usuario, no cuando Auth actualiza sus campos.
  }, [user?.uid]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: signInWithEmail,
      signUp: async (email, password, profile) => {
        pendingProfile.current = profile;
        try {
          await signUpWithEmail(email, password, profile.displayName);
        } catch (error) {
          pendingProfile.current = null;
          throw error;
        }
      },
      signInWithGoogle,
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
