'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CalendarDays, Clock, Flag, Folder, Layers, Repeat, Tag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseQuickAdd, type TokenKind } from '@/lib/quick-add-parser';
import { quickAddAction, type QuickAddContext } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';

const TOKEN_ICONS: Record<TokenKind, typeof CalendarDays> = {
  date: CalendarDays,
  deadline: Flag,
  time: Clock,
  bucket: Layers,
  project: Folder,
  label: Tag,
  priority: Flag,
  recurrence: Repeat,
};

/**
 * Quick add.
 *
 * The input stays a single plain line — what you typed is what you see — and
 * the parse result is echoed as chips underneath. That way the parser never
 * surprises you: you can see it read "מחר" as tomorrow before you commit.
 */
export function Composer({
  context,
  vocabulary,
  onClose,
  autoFocus = true,
}: {
  context: QuickAddContext;
  /** Existing project and label names, so the live chips match what the server
   *  will do with multi-word names. */
  vocabulary?: { projects: string[]; labels: string[] };
  onClose?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, new Date(), vocabulary) : null),
    [text, vocabulary],
  );
  const chips = parsed?.tokens ?? [];

  function submit() {
    const value = text.trim();
    if (!value || pending) return;

    startTransition(async () => {
      const result = await quickAddAction(value, context);
      if (!result.ok) {
        toast({ message: result.error ?? 'לא הצלחנו לשמור את המשימה', tone: 'error' });
        return;
      }
      setText('');
      inputRef.current?.focus();
      // Say where it went. A task added from Today but scheduled for next week
      // is not in the list you are looking at, and silence reads as failure.
      toast({ message: result.landedIn ? `נוספה ל${result.landedIn}` : 'נוספה משימה' });
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-row">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          dir="auto"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              if (text) setText('');
              else onClose?.();
            }
          }}
          placeholder="מה צריך לעשות?"
          aria-label="משימה חדשה"
          className="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />

        {chips.length > 0 && (
          <div data-testid="composer-chips" className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {parsed?.title === '' && (
              <span className="text-xs font-semibold text-p2">חסר שם למשימה</span>
            )}
            {chips.map((token) => {
              const Icon = TOKEN_ICONS[token.kind];
              return (
                <span
                  key={`${token.kind}-${token.start}`}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    token.kind === 'deadline'
                      ? 'bg-flag-soft text-flag'
                      : 'bg-accent-soft text-accent',
                  )}
                >
                  <Icon className="size-3" aria-hidden />
                  {token.display}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 border-bs border-line pt-2.5">
          <p className="text-xs text-muted">
            אפשר לכתוב <Hint>מחר</Hint> <Hint>בשעה 14:30</Hint> <Hint>כל יום שני</Hint>{' '}
            <Hint>#פרויקט</Hint> <Hint>@תווית</Hint> <Hint>!1</Hint>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ביטול
              </Button>
            )}
            <Button type="submit" size="sm" disabled={!parsed?.title || pending}>
              {pending ? 'מוסיפים…' : 'הוספה'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    // Each example is its own bidi paragraph. Without the isolation the leading
    // "@" and "!" are neutral characters that get pulled to the far side by the
    // surrounding Hebrew — the hint would render "תווית@" and tell the reader
    // to type something that is not what the parser accepts.
    <code
      dir="auto"
      className="mx-0.5 inline-block rounded-sm bg-surface-2 px-1 py-0.5 font-sans text-[0.7rem] text-ink-2 [unicode-bidi:isolate]"
    >
      {children}
    </code>
  );
}
