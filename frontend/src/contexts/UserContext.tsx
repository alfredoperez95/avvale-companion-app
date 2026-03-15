'use client';

import { createContext, useContext } from 'react';

export type User = {
  id: string;
  email: string;
  name?: string | null;
  lastName?: string | null;
  appearance?: string | null;
  role?: string;
};

const UserContext = createContext<User | null>(null);

export function UserProvider({ user, children }: { user: User | null; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): User | null {
  return useContext(UserContext);
}
