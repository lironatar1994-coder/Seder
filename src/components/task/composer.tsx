'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowUp, CalendarDays, Clock, Flag, Folder, Layers, Repeat, Tag, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseQuickAdd, type ParsedToken, type TokenKind } from '@/lib/quick-add-parser';
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

interface Suggestion {
  /** Shown on the chip — the syntax itself, so tapping teaches you to type it. */
  label: string;
  /** Announced instead of the raw syntax, which reads as gibberish aloud. */
  aria: string;
  /** What lands in the field. */
  insert: string;
  kind: TokenKind;
  /** The insert is only the opening of a token — leave the caret against it and
   *  no trailing space, because the user still has to type the value. */
  partial?: boolean;
  /** Stays offered even once one is set, because a task can carry several. */
  repeatable?: boolean;
}

/**
 * A resolved chip is coloured like the thing it will produce. `!1` is a red
 * flag on the saved row, so it is a red flag here too — an accent-blue chip
 * reading "עדיפות 1" previews the wrong task.
 */
const CHIP_TONE = {
  accent: 'bg-accent-soft text-accent hover:bg-accent/15',
  flag: 'bg-flag-soft text-flag hover:bg-flag/15',
  p1: 'bg-p1/10 text-p1 hover:bg-p1/18',
  p2: 'bg-p2/10 text-p2 hover:bg-p2/18',
  p3: 'bg-p3/10 text-p3 hover:bg-p3/18',
} as const;

function toneOf(token: ParsedToken) {
  if (token.kind === 'deadline') return CHIP_TONE.flag;
  if (token.kind === 'priority') {
    // "!1" / "p1" — priority 4 is the default and carries no colour of its own.
    const level = token.raw.replace(/\D/g, '');
    return CHIP_TONE[`p${level}` as 'p1' | 'p2' | 'p3'] ?? CHIP_TONE.accent;
  }
  return CHIP_TONE.accent;
}

/**
 * The syntax, as buttons.
 *
 * This row used to be a paragraph of examples: grey pills, sitting beside real
 * buttons, that did nothing when you pressed them. On a phone that is the worst
 * of both — it looks like the control strip every other task app puts here, and
 * it is documentation. Now each one writes its own token into the field, so the
 * strip both works and still shows you what to type next time.
 */
const SUGGESTIONS: Suggestion[] = [
  { label: 'היום', aria: 'תזמון להיום', insert: 'היום', kind: 'date' },
  { label: 'מחר', aria: 'תזמון למחר', insert: 'מחר', kind: 'date' },
  { label: '#פרויקט', aria: 'שיוך לפרויקט', insert: '#', kind: 'project', partial: true },
  { label: '@תווית', aria: 'הוספת תווית', insert: '@', kind: 'label', partial: true, repeatable: true },
  { label: 'בשעה', aria: 'קביעת שעה', insert: 'בשעה ', kind: 'time', partial: true },
  { label: '!1', aria: 'עדיפות גבוהה', insert: '!1', kind: 'priority' },
  { label: 'כל יום', aria: 'משימה חוזרת', insert: 'כל יום ', kind: 'recurrence', partial: true },
];

/**
 * Quick add.
 *
 * The input stays a single plain line — what you typed is what you see — and
 * the parse result is echoed as chips underneath. That way the parser never
 * surprises you: you can see it read "מחר" as tomorrow before you commit.
 *
 * One strip carries both halves of that conversation. A filled chip is
 * something the parser found, and pressing it takes the token back out of the
 * text; an outlined chip is something you can still add. A kind drops off the
 * offer once it is set, so the strip is never proposing a second date.
 *
 * `sheet` is the phone: the composer is the surface rather than a card inside
 * one, so it goes flush to the edges the keyboard already owns and trades the
 * two text buttons for a single round send under the thumb. Cancel does not
 * survive that trade — there the scrim behind it is the way out, and it is a
 * labelled button in the tab order for anyone not using a thumb.
 */
export function Composer({
  context,
  vocabulary,
  onClose,
  autoFocus = true,
  variant = 'inline',
}: {
  context: QuickAddContext;
  /** Existing project and label names, so the live chips match what the server
   *  will do with multi-word names. */
  vocabulary?: { projects: string[]; labels: string[] };
  onClose?: () => void;
  autoFocus?: boolean;
  variant?: 'inline' | 'sheet';
}) {
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const { toast } = useToast();
  const sheet = variant === 'sheet';

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // React owns the value, so a chip that rewrites the text also has to put the
  // caret back afterwards — otherwise it lands at the end of a string the user
  // was typing in the middle of.
  useEffect(() => {
    if (caretRef.current === null) return;
    inputRef.current?.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  });

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, new Date(), vocabulary) : null),
    [text, vocabulary],
  );
  const chips = parsed?.tokens ?? [];

  const offered = useMemo(() => {
    const used = new Set(chips.map((token) => token.kind));
    return SUGGESTIONS.filter((s) => s.repeatable || !used.has(s.kind));
  }, [chips]);

  function edit(next: string, caret: number) {
    setText(next);
    caretRef.current = caret;
    inputRef.current?.focus();
  }

  function insert(suggestion: Suggestion) {
    const input = inputRef.current;
    const at = input?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const after = text.slice(at);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const head = before + lead + suggestion.insert + (suggestion.partial ? '' : ' ');
    edit(head + after, head.length);
  }

  function remove(token: ParsedToken) {
    const next = (text.slice(0, token.start) + text.slice(token.end))
      .replace(/\s{2,}/g, ' ')
      .trim();
    edit(next, next.length);
  }

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

  const ready = Boolean(parsed?.title) && !pending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(
        sheet
          ? // Flush to the three edges the keyboard already occupies. As a
            // floating card it was a rounded rectangle hovering over a rounded
            // keyboard, and it gave up 16px of field width to say so.
            'rounded-t-2xl border-bs border-line bg-surface px-4 pt-3 shadow-pop' +
              ' pb-[max(1rem,env(safe-area-inset-bottom))]'
          : 'rounded-xl border border-line bg-surface p-3 shadow-row',
      )}
    >
      <div className="flex items-center gap-2">
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
          // Chrome offers to fill a bare text field with an address or a card,
          // and puts a bar over the keyboard to do it.
          autoComplete="off"
          enterKeyHint="done"
          className={cn(
            'min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted',
            '[@media(pointer:coarse)]:h-11',
          )}
        />

        {sheet && (
          <button
            type="submit"
            aria-label="הוספה"
            aria-busy={pending}
            disabled={!ready}
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,transform]',
              ready
                ? 'bg-accent text-[var(--on-accent)] shadow-row active:scale-95'
                : 'bg-surface-2 text-muted',
            )}
          >
            <ArrowUp className="size-5" strokeWidth={2.75} aria-hidden />
          </button>
        )}
      </div>

      <div
        className={cn(
          // Scrolls rather than wraps: wrapping made the sheet grow a line at a
          // time under the thumb while the keyboard was pushing it up.
          'mt-2 flex items-center gap-1.5 overflow-x-auto',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // Full-bleed, so the strip runs off the edge instead of ending in a
          // gap that reads as "that is all of them".
          sheet ? '-mx-4 px-4' : '-mx-3 px-3',
        )}
      >
        <div data-testid="composer-chips" className="flex shrink-0 items-center gap-1.5">
          {parsed?.title === '' && (
            <span className="shrink-0 text-xs font-semibold text-p2">חסר שם למשימה</span>
          )}
          {chips.map((token) => {
            const Icon = TOKEN_ICONS[token.kind];
            return (
              <button
                key={`${token.kind}-${token.start}`}
                type="button"
                // Without this the field blurs, and on a phone the keyboard
                // drops and the sheet lurches down the screen mid-tap.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => remove(token)}
                aria-label={`הסרת ${token.display}`}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
                  '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-3.5',
                  toneOf(token),
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {token.display}
                <X className="size-3 opacity-60" aria-hidden />
              </button>
            );
          })}
        </div>

        {offered.map((suggestion) => {
          const Icon = TOKEN_ICONS[suggestion.kind];
          return (
            <button
              key={suggestion.label}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insert(suggestion)}
              aria-label={suggestion.aria}
              className={cn(
                'inline-flex h-8 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full border border-line px-2.5',
                'text-xs font-medium text-muted transition-colors',
                'hover:border-line-strong hover:bg-surface-2 hover:text-ink',
                '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-3.5',
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {/* Each label is its own bidi paragraph. Otherwise the leading
                  "#", "@" and "!" are neutral characters that the surrounding
                  Hebrew drags to the far side, and the chip tells you to type
                  "תווית@" — which the parser does not accept. */}
              <span dir="auto" className="[unicode-bidi:isolate]">
                {suggestion.label}
              </span>
            </button>
          );
        })}
      </div>

      {!sheet && (
        <div className="mt-3 flex items-center justify-end gap-2 border-bs border-line pt-2.5">
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ביטול
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!ready}>
            {pending ? 'מוסיפים…' : 'הוספה'}
          </Button>
        </div>
      )}
    </form>
  );
}
