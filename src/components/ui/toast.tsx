'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { CircleCheck, Info, CircleAlert, X } from 'lucide-react';
import { playCompletionSound } from '@/lib/completion-sound';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone?: 'default' | 'success' | 'error';
  sound?: 'complete';
  group?: string;
  action?: ToastAction;
  duration?: number;
}

type ToastInput = Omit<Toast, 'id'>;

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId++;
      setToasts((current) => [...current.filter(t => !input.group || t.group !== input.group).slice(-2), { ...input, id }]);
      if (input.sound === 'complete') void playCompletionSound();
      const duration = input.duration ?? (input.action ? 7000 : 4000);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  const timersSnapshot = timers;
  useEffect(() => {
    const map = timersSnapshot.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [timersSnapshot]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Anchored to the inline-end edge: bottom-left in Hebrew, bottom-right
          in LTR. `right: 0` would pin it to the wrong corner. */}
      <div
        role="status"
        data-testid="toasts"
        aria-live="polite"
        aria-atomic="false"
        // Desktop: bottom corner. Phone CSS places notices above task controls;
        // settings has its own bottom position without workspace tabs or Add.
        className="toast-stack pointer-events-none fixed inset-be-[calc(1rem+var(--tab-bar))] inset-e-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            data-toast-tone={t.tone ?? 'default'}
            role={t.tone === 'error' ? 'alert' : undefined}
            className={cn(
              'animate-toast-in pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-pop',
              t.tone === 'error'
                ? 'border-p1/30 bg-surface text-ink'
                : 'border-[var(--notice-line)] bg-[var(--notice-soft)] text-ink',
            )}
          >
            {t.tone === 'error' ? <CircleAlert className="size-5 shrink-0 text-p1" aria-hidden /> : t.tone === 'success' ? <CircleCheck className="size-5 shrink-0 text-[var(--notice)]" aria-hidden /> : <Info className="size-5 shrink-0 text-[var(--notice)]" aria-hidden />}
            <p className="min-w-0 flex-1 text-sm leading-snug">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-sm text-sm font-semibold text-[var(--notice)] underline-offset-4 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="סגירת הודעה" onClick={() => dismiss(t.id)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--notice)] hover:bg-surface-2 [@media(pointer:coarse)]:size-11"><X className="size-4" aria-hidden /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
