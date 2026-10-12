import type { Persistence } from 'firebase/auth';

// TypeScript resuelve los tipos web de 'firebase/auth', pero Metro empaqueta la entrada de React Native,
// que sí exporta getReactNativePersistence (ver @firebase/auth/dist/rn/index.rn.d.ts).
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
