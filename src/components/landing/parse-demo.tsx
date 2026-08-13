'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Flag, Folder, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';

/**
 * The landing page's argument, performed rather than described.
 *
 * One Hebrew sentence is typed into the real composer, the parser lights up the
 * parts it understood, those parts leave the line — which is exactly what the
 * product does, and the reason the saved title is clean — and what remains lands
 * as a task row carrying the same facts as chips.
 *
 * Everything here mirrors `components/task/composer.tsx` and `task-row.tsx`:
 * same chip colours, same icons, same completion moment. A landing page that
 * invents its own version of the interface is advertising a different product.
 */

type Kind = 'date' | 'time' | 'project' | 'priority';

interface Group {
  kind: Kind | null;
  /** The space before the token; it collapses with the token it belongs to. */
  lead: string;
  head: string;
  /** Digits, which live in their own LTR island. */
  num?: string;
  /** `!1` has no strong character, so it needs an explicit direction. */
  ltr?: boolean;
}

const GROUPS: Group[] = [
  { kind: null, lead: '', head: 'לסיים את המצגת' },
  { kind: 'date', lead: ' ', head: 'מחר' },
  { kind: 'time', lead: ' ', head: 'בשעה ', num: '14:30' },
  { kind: 'project', lead: ' ', head: '#עבודה' },
  { kind: 'priority', lead: ' ', head: '!', num: '1', ltr: true },
];

const CHIPS: { kind: Kind; icon: typeof CalendarDays; label: string }[] = [
  { kind: 'date', icon: CalendarDays, label: 'מחר' },
  { kind: 'time', icon: Clock, label: '14:30' },
  { kind: 'project', icon: Folder, label: 'עבודה' },
  { kind: 'priority', icon: Flag, label: 'דחוף' },
];

const LENGTHS = GROUPS.map((g) => g.lead.length + g.head.length + (g.num?.length ?? 0));
const OFFSETS = LENGTHS.reduce<number[]>((acc, len, i) => [...acc, (acc[i - 1] ?? 0) + len], []);
const TOTAL = OFFSETS[OFFSETS.length - 1];

/** Where each token sits in the lighting order. The title is not a token. */
const ORDER = new Map<Kind, number>(CHIPS.map((c, i) => [c.kind, i + 1]));

type Stage = 'typing' | 'parsing' | 'stripping' | 'saved';

const TYPE_MS = 28;
const TOKEN_MS = 220;

export function ParseDemo() {
  const [run, setRun] = useState(0);
  const [typed, setTyped] = useState(0);
  const [lit, setLit] = useState(0);
  const [stage, setStage] = useState<Stage>('typing');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);

    // With reduced motion the sequence is not a slower animation, it is no
    // animation: the end state is the information, so show it and stop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(TOTAL);
      setLit(CHIPS.length);
      setStage('saved');
      return;
    }

    setTyped(0);
    setLit(0);
    setStage('typing');

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    let t = 320;
    for (let i = 1; i <= TOTAL; i++) at(t + i * TYPE_MS, () => setTyped(i));

    t += TOTAL * TYPE_MS + 420;
    at(t, () => setStage('parsing'));
    for (let i = 1; i <= CHIPS.length; i++) at(t + i * TOKEN_MS, () => setLit(i));

    t += CHIPS.length * TOKEN_MS + 560;
    at(t, () => setStage('stripping'));
    // Long enough to read what is left, which is the whole point of the strip.
    at(t + 900, () => setStage('saved'));

    return () => timers.forEach(clearTimeout);
  }, [run]);

  // The chips stay after the save. They are the resting state's whole argument:
  // beside a title with the recognised words gone, they show where those words
  // went. Clearing them the way the live composer does would leave anyone who
  // arrived late — or who has motion turned off — looking at an empty box.
  const showChips = stage !== 'typing';

  return (
    <div className="animate-fade-up">
      {/* The sequence rewrites its own text as it types, so it is described
          once for a screen reader and hidden as a moving target. */}
      <p className="sr-only">
        הדגמה: כותבים בתיבת ההוספה ״לסיים את המצגת מחר בשעה 14:30 #עבודה !1״, וסדר שומר משימה בשם
        ״לסיים את המצגת״, מתוזמנת למחר בשעה 14:30, בפרויקט עבודה, בעדיפות דחוף.
      </p>

      <div aria-hidden>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-row">
          <p className="text-lg leading-snug text-ink sm:text-xl md:text-2xl">
            {GROUPS.map((group, i) => (
              <Segment
                key={group.kind ?? 'title'}
                group={group}
                typed={typed - OFFSETS[i] + LENGTHS[i]}
                lit={group.kind ? lit >= (ORDER.get(group.kind) ?? 0) : false}
                stripped={stage === 'stripping' || stage === 'saved'}
              />
            ))}
            {typed === 0 && <span className="text-muted">מה צריך לעשות?</span>}
            <span
              className={cn(
                'ms-px inline-block h-[1.05em] w-0.5 translate-y-[0.15em] rounded-full bg-accent align-top',
                stage === 'typing' ? 'animate-caret' : 'opacity-0',
              )}
            />
          </p>

          {/* The parse is echoed as chips before anything is saved — the same
              promise the composer makes: no surprises on commit. */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-1.5 transition-[opacity,margin] duration-300 ease-[var(--ease-out-soft)]',
              showChips ? 'mt-3 opacity-100' : 'mt-0 opacity-0',
            )}
          >
            {CHIPS.map((chip, i) => {
              const Icon = chip.icon;
              return (
                <span
                  key={chip.kind}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent',
                    'transition-[opacity,transform] duration-200 ease-[var(--ease-out-soft)]',
                    lit > i ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
                  )}
                >
                  <Icon className="size-3" aria-hidden />
                  <span className={chip.kind === 'time' ? 'num' : undefined}>{chip.label}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            'ps-4 transition-[opacity,transform] duration-300 ease-[var(--ease-out-soft)]',
            stage === 'saved'
              ? 'translate-y-0 opacity-100 delay-100'
              : 'pointer-events-none -translate-y-1 opacity-0',
          )}
        >
          <ResultRow done={done} onToggle={() => setDone((d) => !d)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 ps-4">
        <p className="text-sm text-muted">
          אפשר גם <Syntax>כל יום שני</Syntax> <Syntax>עד 20/8</Syntax> <Syntax>@תווית</Syntax>{' '}
          <Syntax>מתישהו</Syntax>
        </p>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted',
            'transition-colors duration-120 hover:text-ink',
            stage === 'saved' ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <RotateCcw className="size-3.5 icon-flip" aria-hidden />
          שוב
        </button>
      </div>
    </div>
  );
}

/** One group of the sentence: types in, lights up, then leaves the line. */
function Segment({
  group,
  typed,
  lit,
  stripped,
}: {
  group: Group;
  typed: number;
  lit: boolean;
  stripped: boolean;
}) {
  const lead = group.lead.slice(0, typed);
  const head = group.head.slice(0, typed - group.lead.length);
  const num = group.num?.slice(0, typed - group.lead.length - group.head.length) ?? '';
  const gone = stripped && group.kind !== null;

  return (
    // Every group is an inline-block aligned to the top of the line box, which
    // is what lets a collapsing one keep its baseline with the plain text
    // beside it: `overflow: hidden` synthesises a baseline, `align-top` never
    // asks for one. All groups share a font size, so top and baseline agree.
    <span
      className={cn(
        'inline-block max-w-[22ch] overflow-hidden whitespace-pre align-top',
        'transition-[max-width,opacity,background-color,color] duration-500 ease-[var(--ease-out-soft)]',
        lit && !gone && 'rounded-[3px] bg-accent-soft text-accent',
        gone && 'max-w-0 opacity-0',
      )}
    >
      {lead}
      {group.ltr ? (
        <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
          {head}
          {num && <span className="num">{num}</span>}
        </span>
      ) : (
        <>
          {head}
          {num && <span className="num">{num}</span>}
        </>
      )}
    </span>
  );
}

/**
 * What the parse produced, as the app's own row.
 *
 * The checkbox works: the completion stroke is the one delightful moment in the
 * product, and a landing page that describes it instead of letting you press it
 * has kept the best part to itself.
 */
function ResultRow({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-row">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'ביטול השלמה: לסיים את המצגת' : 'סימון כהושלם: לסיים את המצגת'}
        onClick={onToggle}
        className={cn(
          'relative mt-0.5 grid size-5 shrink-0 place-items-center overflow-hidden rounded-md border-2',
          'transition-colors duration-120',
          done ? 'border-accent bg-accent' : 'border-p1 hover:border-accent',
        )}
      >
        <Check
          className={cn(
            'size-3 text-[var(--on-accent)] transition-opacity duration-150',
            done ? 'opacity-100' : 'opacity-0',
          )}
          strokeWidth={3.5}
          aria-hidden
        />
      </button>

      <div className="min-w-0 flex-1">
        <span className="relative inline-block max-w-full align-top">
          <span className={cn('block text-base leading-snug', done ? 'text-muted' : 'text-ink')}>
            לסיים את המצגת
          </span>
          {done && (
            <span
              aria-hidden
              className="strike-line absolute start-0 top-1/2 h-px w-full bg-muted"
            />
          )}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              done ? 'text-muted' : 'text-ink-2',
            )}
          >
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            מחר
            <Clock className="ms-0.5 size-3 shrink-0" aria-hidden />
            <span className="num">14:30</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: swatchVar('clay') }}
            />
            עבודה
          </span>
        </span>
      </div>

      <span className={cn('shrink-0 pt-0.5 text-p1', done && 'opacity-40')}>
        <Flag className="size-3.5 fill-current" aria-hidden />
      </span>
    </div>
  );
}

function Syntax({ children }: { children: React.ReactNode }) {
  return (
    // Each example is its own bidi paragraph: "@" and "!" are neutral, and
    // without isolation the surrounding Hebrew drags them to the far side and
    // the hint tells you to type something the parser would not accept.
    <code
      dir="auto"
      className="mx-0.5 inline-block rounded-sm bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-ink-2 [unicode-bidi:isolate]"
    >
      {children}
    </code>
  );
}
