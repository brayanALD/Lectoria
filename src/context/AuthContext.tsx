import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { deleteAccountData } from '../services/accountService';
import {
  deleteCurrentUser,
  getLinkedProviders,
  GOOGLE_PROVIDER,
  linkGoogleToCurrentUser,
  linkPasswordToCurrentUser,
  PASSWORD_PROVIDER,
  reauthenticateCurrentUser,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthState,
  type User,
} from '../services/authService';
import { clearTimer } from '../services/timerStorage';
import { ensureUserProfile } from '../services/userService';
import { withTimeout } from '../utils/withTimeout';
import type { ProfileInput } from '../types/user';

interface AuthContextValue {
  user: User | null;
  /** true hasta que Firebase restaura (o descarta) la sesión guardada. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: ProfileInput) => Promise<void>;
  /** Devuelve false si el usuario cancela. Crea la cuenta si es la primera vez. */
  signInWithGoogle: () => Promise<boolean>;
  /** Métodos de acceso vinculados a la cuenta actual. */
  hasGoogle: boolean;
  hasPassword: boolean;
  /** Vincula Google a la cuenta actual. Devuelve false si el usuario cancela. */
  linkGoogle: () => Promise<boolean>;
  /** Añade una contraseña a la cuenta actual, usando su mismo correo. */
  linkPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Elimina la cuenta con todos sus datos. Pide confirmar la identidad: con la contraseña si la cuenta tiene una (hay que
   * pasarla) o con Google si no. Devuelve false si se cancela el selector de Google; al terminar, la sesión se cierra sola.
   */
  deleteAccount: (password?: string) => Promise<boolean>;
}

// Borrar una biblioteca grande son varios lotes; sin conexión no terminarían nunca.
const DELETE_DATA_TIMEOUT_MS = 60000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [providers, setProviders] = useState<string[]>([]);
  // Datos del formulario de registro, para que la única escritura del perfil los incluya.
  const pendingProfile = useRef<ProfileInput | null>(null);

  useEffect(
    () =>
      subscribeToAuthState((nextUser) => {
        setUser(nextUser);
        setProviders(getLinkedProviders());
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
      hasGoogle: providers.includes(GOOGLE_PROVIDER),
      hasPassword: providers.includes(PASSWORD_PROVIDER),
      // Vincular no cambia el usuario, así que no dispara onAuthStateChanged: se refresca a mano.
      linkGoogle: async () => {
        const linked = await linkGoogleToCurrentUser();
        setProviders(getLinkedProviders());
        return linked;
      },
      linkPassword: async (password) => {
        await linkPasswordToCurrentUser(password);
        setProviders(getLinkedProviders());
      },
      signOut: signOutUser,
      deleteAccount: async (password) => {
        if (!user) throw Object.assign(new Error('auth/user-not-found'), { code: 'auth/user-not-found' });
        // Primero se confirma la identidad (también asegura que hay conexión); después los datos, mientras la sesión
        // sigue iniciada, y por último el usuario. Si algo falla a medias, repetirlo termina lo que quedó.
        if (!(await reauthenticateCurrentUser(password))) return false;
        await withTimeout(deleteAccountData(user.uid), DELETE_DATA_TIMEOUT_MS);
        await clearTimer(user.uid);
        await deleteCurrentUser();
        return true;
      },
    }),
    [user, initializing, providers],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
