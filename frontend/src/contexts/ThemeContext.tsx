'use client';

import { createContext, useContext } from 'react';

export type Theme = 'microsoft' | 'fiori';

const ThemeContext = createContext<Theme>('microsoft');

export function ThemeProvider({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
