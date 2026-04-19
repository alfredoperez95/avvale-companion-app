'use client';

import { createContext, useContext, useMemo } from 'react';

export type LauncherTileId = 'activations' | 'pipeline' | 'yubiq' | 'rfqAnalysis' | 'meddpicc';

export type User = {
  id: string;
  email: string;
  name?: string | null;
  lastName?: string | null;
  position?: string | null;
  /** Sector Avvale (`UserIndustry` en API). */
  industry?: string | null;
  avatarPath?: string | null;
  appearance?: string | null;
  role?: string;
  /** Orden de mosaicos App Launcher; permutación de activations, pipeline, yubiq, rfqAnalysis, meddpicc */
  launcherTileOrder?: LauncherTileId[] | null;
  /** Indica si el usuario guardó clave Anthropic (módulos con IA en el launcher). */
  hasAnthropicApiKey?: boolean;
  /** Id del usuario que tiene el puesto Growth Managing Director (solo uno); null si libre. */
  growthManagingDirectorUserId?: string | null;
};

type UserContextValue = {
  user: User | null;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  user,
  refreshUser,
  children,
}: {
  user: User | null;
  refreshUser: () => Promise<void>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ user, refreshUser }), [user, refreshUser]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): User | null {
  return useContext(UserContext)?.user ?? null;
}

export function useRefreshUser(): () => Promise<void> {
  const ctx = useContext(UserContext);
  if (!ctx) {
    return async () => {};
  }
  return ctx.refreshUser;
}
