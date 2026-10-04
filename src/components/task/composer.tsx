'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowUp, CalendarDays, Clock, Flag, Folder, Layers, Repeat, Tag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseQuickAdd, type ParsedToken, type TokenKind } from '@/lib/quick-add-parser';
import { quickAddAction, type QuickAddContext } from '@/server/tasks/actions';
import { useToast } from '@/components/ui/toast';

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
}

const DAY_OFFERS: Suggestion[] = [
  { label: 'היום', aria: 'תזמון להיום', insert: 'היום', kind: 'date' },
  { label: 'מחר', aria: 'תזמון למחר', insert: 'מחר', kind: 'date' },
  { label: 'שבוע הבא', aria: 'תזמון לשבוע הבא', insert: 'שבוע הבא', kind: 'date' },
];

const TIME_OFFER: Suggestion = {
  label: 'בשעה',
  aria: 'קביעת שעה',
  insert: 'בשעה ',
  kind: 'time',
  partial: true,
};

const DEADLINE_OFFER: Suggestion = {
  label: 'עד…',
  aria: 'קביעת מועד הגשה',
  insert: 'עד ',
  kind: 'deadline',
  partial: true,
};

const PROJECT_OFFER: Suggestion = {
  label: '#פרויקט',
  aria: 'שיוך לפרויקט',
  insert: '#',
  kind: 'project',
  partial: true,
};

const LABEL_OFFER: Suggestion = {
  label: '@תווית',
  aria: 'הוספת תווית',
  insert: '@',
  kind: 'label',
  partial: true,
};

const PRIORITY_OFFER: Suggestion = {
  label: '!1',
  aria: 'עדיפות גבוהה',
  insert: '!1',
  kind: 'priority',
};

const REPEAT_OFFER: Suggestion = {
  label: 'כל יום',
  aria: 'משימה חוזרת',
  insert: 'כל יום ',
  kind: 'recurrence',
  partial: true,
};

/**
 * The syntax, as buttons — what is still missing, never what is already there.
 *
 * This was a fixed row of seven that only ever shrank. It is now a reading of
 * the sentence so far: the first slot answers "when", and once a day is settled
 * it stops proposing a second one and offers the hour instead. The deadline is
 * here at all now — `עד` is one of the two axes the product is built on, and it
 * was the only feature you could not discover from the interface.
 */
function offersFor(chips: ParsedToken[]): Suggestion[] {
  const has = (kind: TokenKind) => chips.some((token) => token.kind === kind);
  const out: Suggestion[] = [];

  const dated = has('date') || has('bucket') || has('recurrence');
  if (!dated) out.push(...DAY_OFFERS);
  else if (!has('time')) out.push(TIME_OFFER);

  if (!has('deadline')) out.push(DEADLINE_OFFER);
  if (!has('project')) out.push(PROJECT_OFFER);
  // A task can carry several, so this one never leaves.
  out.push(LABEL_OFFER);
  if (!has('priority')) out.push(PRIORITY_OFFER);
  if (!has('recurrence')) out.push(REPEAT_OFFER);

  return out;
}

/**
 * A resolved token is coloured like the thing it will produce. `!1` is a red
 * flag on the saved row, so it is red here too — an accent-blue "עדיפות 1"
 * previews the wrong task.
 */
function tokenColours(token: ParsedToken): { bg: string; fg: string } {
  // A wash rather than one of the `-soft` tokens: this layer sits over the
  // field, and a solid fill would hide the caret whenever it stood inside a
  // token. Both land within a shade of `--accent-soft` on either theme.
  const wash = (colour: string) => `color-mix(in oklab, var(${colour}) 14%, transparent)`;

  if (token.kind === 'deadline') return { bg: wash('--flag'), fg: 'var(--flag)' };
  if (token.kind === 'priority') {
    // "!1" / "p1" — priority 4 is the default and carries no colour of its own.
    const level = token.raw.replace(/\D/g, '');
    if (level === '1' || level === '2' || level === '3') {
      return { bg: wash(`--p${level}`), fg: `var(--p${level})` };
    }
  }
  return { bg: wash('--accent'), fg: 'var(--accent)' };
}

interface Segment {
  key: string;
  text: string;
  token?: ParsedToken;
}

/** The typed string, cut into what the parser claimed and what it left alone.
 *  Token spans are keyed by what was understood rather than by where it sits,
 *  so typing a title in front of a finished token does not re-mount it. */
function segment(text: string, tokens: ParsedToken[]): Segment[] {
  const out: Segment[] = [];
  const seen = new Map<string, number>();
  let last = 0;

  for (const token of tokens) {
    if (token.start > last) out.push({ key: `plain-${last}`, text: text.slice(last, token.start) });
    const signature = `${token.kind}:${token.display}`;
    const nth = seen.get(signature) ?? 0;
    seen.set(signature, nth + 1);
    out.push({ key: `token-${signature}-${nth}`, text: text.slice(token.start, token.end), token });
    last = token.end;
  }

  if (last < text.length) out.push({ key: `plain-${last}`, text: text.slice(last) });
  return out;
}

/**
 * Quick add.
 *
 * The field draws the parse onto the sentence itself. It used to keep the raw
 * syntax as grey punctuation and repeat every value as a pill underneath — the
 * task on screen twice, and neither copy the clean one. Now `מחר` wears the
 * colour of the date it became, in place, and the strip below carries only what
 * you could still add.
 *
 * What you typed is still exactly what is in the field: nothing is substituted
 * or reordered, only coloured. The input is transparent and a mirror behind it
 * repeats the same string with the parsed spans wrapped, so every character
 * stays where the browser put it and editing behaves like the plain field it
 * still is. That only holds while the two layers agree character for character,
 * which is why the highlight may not change any inline metric — see `.qa-token`.
 *
 * `sheet` is the phone: the composer is the surface rather than a card inside
 * one, so it goes flush to the edges the keyboard already owns. Cancel does not
 * survive that trade — there the scrim behind it is the way out, and it is a
 * labelled button in the tab order for anyone not using a thumb.
 */
export function Composer({
  context,
  vocabulary,
  onClose,
  onAdded,
  autoFocus = true,
  variant = 'inline',
}: {
  context: QuickAddContext;
  /** Existing project and label names, so the live highlight matches what the
   *  server will do with multi-word names. */
  vocabulary?: { projects: string[]; labels: string[] };
  onClose?: () => void;
  /** Handed the saved task instead of announcing it. A caller that can show the
   *  row — the list — says so by making it land there; one that cannot leaves
   *  this unset and gets the toast. */
  onAdded?: (id: string, landedIn?: string) => void;
  autoFocus?: boolean;
  variant?: 'inline' | 'sheet';
}) {
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
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
  const chips = useMemo(() => parsed?.tokens ?? [], [parsed]);
  const offered = useMemo(() => offersFor(chips), [chips]);
  const segments = useMemo(() => segment(text, chips), [text, chips]);

  /* Once the text is wider than the field the input scrolls, and the mirror has
     to travel with it. Copying the number across rather than computing one:
     both elements are the same box with the same direction, so whatever
     convention the engine uses for `scrollLeft` in RTL, they share it. */
  function syncScroll() {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) mirror.scrollLeft = input.scrollLeft;
  }

  useEffect(syncScroll, [text]);

  function edit(next: string, caret: number) {
    setText(next);
    caretRef.current = caret;
    inputRef.current?.focus();
  }

  function remove(token: ParsedToken) {
    const next = (text.slice(0, token.start) + text.slice(token.end))
      .replace(/\s{2,}/g, ' ')
      .trim();
    edit(next, next.length);
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
      // is not in the list you are looking at, and silence reads as failure —
      // unless the caller can put the row on screen, which says it better.
      if (onAdded && result.id) onAdded(result.id, result.landedIn);
      else toast({ message: result.landedIn ? `נוספה ל${result.landedIn}` : 'נוספה משימה' });
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
          : // `.composer-card` carries the focus glow — see globals.css.
            'composer-card rounded-xl border border-line bg-surface p-3 shadow-row',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          {/* The visible text, over the field rather than under it: a press has
              to be able to reach a token, and the input would otherwise take
              every one of them. The layer itself is transparent to the pointer,
              so anywhere that is not a token still lands a caret — and the
              token fills are washes rather than solids, so the caret and the
              selection carry on showing through from below. */}
          <div
            ref={mirrorRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 flex items-center overflow-hidden"
          >
            <span dir="auto" className="shrink-0 whitespace-pre text-base text-ink">
              {segments.map((seg) => {
                if (!seg.token) return <span key={seg.key}>{seg.text}</span>;
                const { bg, fg } = tokenColours(seg.token);
                const sigil = /^[#@!]/.test(seg.text) ? seg.text.slice(0, 1) : '';
                return (
                  <span
                    key={seg.key}
                    className="qa-token"
                    data-token={seg.token.kind}
                    style={{ '--qa-bg': bg, '--qa-fg': fg } as React.CSSProperties}
                    // The highlight is the only thing on this layer that takes
                    // a press: tapping the word takes it back out of the text.
                    // The old chips taught that gesture, and on a phone the
                    // alternative is landing a caret between two Hebrew words.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => remove(seg.token!)}
                  >
                    {sigil && <span className="qa-sigil">{sigil}</span>}
                    {sigil ? seg.text.slice(1) : seg.text}
                  </span>
                );
              })}
            </span>
          </div>

          <input
            ref={inputRef}
            dir="auto"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onScroll={syncScroll}
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
              // `block`, so the wrapper is exactly the input's box. Left
              // inline, the wrapper is a line box three pixels taller than the
              // field and the mirror centres itself half a pixel off the text
              // it is standing in for.
              'qa-input relative block w-full bg-transparent text-base text-transparent outline-none',
              '[caret-color:var(--ink)] placeholder:text-muted',
              '[@media(pointer:coarse)]:h-11',
            )}
          />
        </div>

        <button
          type="submit"
          aria-label="הוספה"
          aria-busy={pending}
          disabled={!ready}
          className={cn(
            'grid shrink-0 place-items-center rounded-full transition-[background-color,transform]',
            sheet ? 'size-11' : 'size-9',
            ready
              ? 'bg-accent text-[var(--on-accent)] shadow-row active:scale-95'
              : 'bg-surface-2 text-muted',
          )}
        >
          <ArrowUp className={sheet ? 'size-5' : 'size-4'} strokeWidth={2.75} aria-hidden />
        </button>
      </div>

      {/* The highlight is a colour, and a colour is not readable aloud. This is
          the same parse said in words, for anyone who cannot see the field
          light up — and the only place the priority is still spelled out. */}
      <p aria-live="polite" data-testid="composer-chips" className="sr-only">
        {chips.map((token) => token.display).join(' · ')}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <div
          className={cn(
            // Scrolls rather than wraps: wrapping made the sheet grow a line at
            // a time under the thumb while the keyboard was pushing it up.
            'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // Full-bleed on the sheet, so the strip runs off the edge instead
            // of ending in a gap that reads as "that is all of them".
            sheet && '-mx-4 px-4',
          )}
        >
          {parsed?.title === '' && (
            <span className="shrink-0 text-xs font-semibold text-p2">חסר שם למשימה</span>
          )}

          {offered.map((suggestion) => {
            const Icon = TOKEN_ICONS[suggestion.kind];
            return (
              <button
                key={suggestion.label}
                type="button"
                // Without this the field blurs, and on a phone the keyboard
                // drops and the sheet lurches down the screen mid-tap.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => insert(suggestion)}
                aria-label={suggestion.aria}
                className={cn(
                  // No border. These are what you could still say, not controls
                  // with weight of their own — outlined, they were the same
                  // object as the resolved chips they used to sit beside.
                  'inline-flex h-8 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2',
                  'text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink',
                  '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-3',
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

        {/* Two text buttons under a rule cost a whole band of height to say what
            the keyboard already does, at the far end of a column from the word
            being typed. The keys say it in place. */}
        {!sheet && (
          <div className="flex shrink-0 items-center gap-3 ps-2 text-2xs text-muted">
            <span>
              <kbd className="font-sans">⏎</kbd> להוספה
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                <kbd className="font-sans">esc</kbd> לביטול
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
