'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const Context = createContext('/app/today');
const KEY = 'seder-settings-return';
const isWorkspace = (path: string) => path.startsWith('/app/') && !path.startsWith('/app/settings');

export function WorkspaceReturnProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = pathname + (params.size ? `?${params}` : '');
  const [returnTo, setReturnTo] = useState('/app/today');
  useEffect(() => {
    if (isWorkspace(pathname)) {
      setReturnTo(href);
      try { sessionStorage.setItem(KEY, href); } catch {}
    } else {
      try { const saved = sessionStorage.getItem(KEY); if (saved && isWorkspace(saved) && !saved.includes('://')) setReturnTo(saved); } catch {}
    }
  }, [pathname, href]);
  return <Context.Provider value={returnTo}>{children}</Context.Provider>;
}

export const useWorkspaceReturn = () => useContext(Context);
