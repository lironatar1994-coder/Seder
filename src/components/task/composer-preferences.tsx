'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_COMPOSER_PREFERENCES, type ComposerPreferences } from '@/lib/composer-preferences';

const Context = createContext<ComposerPreferences>(DEFAULT_COMPOSER_PREFERENCES);

export function ComposerPreferencesProvider({ value, children }: { value: ComposerPreferences; children: React.ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useComposerPreferences() {
  return useContext(Context);
}
