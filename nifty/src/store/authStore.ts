import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** The super_admin's original identity, non-null only while impersonating. */
  originalUser: User | null;
  originalToken: string | null;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;

  /** Save the current session and switch to the impersonated user's token. */
  impersonate: (user: User, token: string) => void;
  /** Restore the original super_admin session. */
  stopImpersonating: () => void;
  isImpersonating: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      originalUser: null,
      originalToken: null,

      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null, originalUser: null, originalToken: null }),
      isAuthenticated: () => !!get().token && !!get().user,

      impersonate: (user, token) =>
        set((s) => ({
          originalUser: s.user,
          originalToken: s.token,
          user,
          token,
        })),

      stopImpersonating: () =>
        set((s) => ({
          user: s.originalUser,
          token: s.originalToken,
          originalUser: null,
          originalToken: null,
        })),

      isImpersonating: () => !!get().originalToken,
    }),
    {
      name: 'nifty-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        originalUser: state.originalUser,
        originalToken: state.originalToken,
      }),
    },
  ),
);
