'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const ENDPOINT = '/seder/.well-known/vee-visitor-signal';
const VISITOR_KEY = 'seder.monitor.visitor';
const SESSION_KEY = 'seder.monitor.session';
const VISITOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GRID_SIZE = 12;

type TapCell = { x: number; y: number; taps: number };

function randomId(): string {
  return crypto.randomUUID?.()
    ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function persistentId(): string {
  try {
    const now = Date.now();
    const stored = JSON.parse(localStorage.getItem(VISITOR_KEY) || 'null') as { id?: string; expiresAt?: number } | null;
    if (stored?.id && Number(stored.expiresAt) > now) return stored.id;
    const id = randomId();
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id, expiresAt: now + VISITOR_TTL_MS }));
    return id;
  } catch {
    return randomId();
  }
}

function sessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const id = randomId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

function monitoredPath(pathname: string): string {
  if (pathname === '/seder' || pathname.startsWith('/seder/')) return pathname;
  return `/seder${pathname === '/' ? '' : pathname}`;
}

function commonPayload(path: string) {
  return {
    event_id: randomId(),
    visitor_id: persistentId(),
    session_id: sessionId(),
    path,
    webdriver: navigator.webdriver === true,
  };
}

function post(payload: Record<string, unknown>, beacon = false): void {
  const body = JSON.stringify(payload);
  if (beacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
  void fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

export function VisitorSignal() {
  const pathname = usePathname();

  useEffect(() => {
    const path = monitoredPath(pathname || '/');
    const startedAt = performance.now();
    let maximumScroll = 0;
    const cells = new Map<string, TapCell>();

    post(commonPayload(path));

    const updateScroll = () => {
      const root = document.documentElement;
      const range = Math.max(0, root.scrollHeight - window.innerHeight);
      const depth = range === 0 ? 100 : Math.round((window.scrollY / range) * 100);
      maximumScroll = Math.max(maximumScroll, Math.min(100, depth));
    };
    const recordTap = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      const x = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(event.clientX / Math.max(1, window.innerWidth) * GRID_SIZE)));
      const y = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(event.clientY / Math.max(1, window.innerHeight) * GRID_SIZE)));
      const key = `${x}:${y}`;
      const current = cells.get(key);
      cells.set(key, { x, y, taps: (current?.taps ?? 0) + 1 });
    };
    const flush = () => post({
      kind: 'engagement',
      ...commonPayload(path),
      scroll_depth: maximumScroll,
      dwell_ms: Math.round(performance.now() - startedAt),
      viewport_width: window.innerWidth,
      viewport_class: window.innerWidth <= 640 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop',
      zones: [],
      views: [],
      heatmap: [...cells.values()].sort((a, b) => b.taps - a.taps).slice(0, 60),
    }, true);

    updateScroll();
    document.addEventListener('click', recordTap, true);
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('pagehide', flush, { once: true });

    return () => {
      document.removeEventListener('click', recordTap, true);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [pathname]);

  return null;
}
