import { cn } from '@/lib/cn';

/**
 * A person, at three sizes.
 *
 * An initial rather than a photograph: there is nowhere to upload one, and a
 * generic silhouette tells you less than a letter does. The colour is derived
 * from the name so the same person is the same colour everywhere — a group of
 * grey circles is unreadable at row size, which is exactly where this is used
 * most.
 *
 * `dir="auto"` on the letter: a Hebrew initial and a Latin one both sit
 * centred, but the letter is text and inherits a direction whether we choose
 * one or not.
 */
const TONES = [
  'bg-[var(--swatch-teal)]',
  'bg-[var(--swatch-clay)]',
  'bg-[var(--swatch-plum)]',
  'bg-[var(--swatch-moss)]',
  'bg-[var(--swatch-slate)]',
  'bg-[var(--swatch-rose)]',
] as const;

const SIZES = {
  sm: 'size-5 text-[0.625rem]',
  md: 'size-7 text-xs',
  lg: 'size-9 text-sm',
} as const;

/** Stable across sessions and machines, which `Math.random` or a Map would not
 *  be — the same name must land on the same colour for everyone looking. */
function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

export function Avatar({
  name,
  size = 'md',
  className,
  title,
  decorative = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Defaults to the name; pass a fuller label where there is room for one. */
  title?: string;
  /** Set where the name is already written next to it — a member list, a menu
   *  row. Otherwise the name is announced twice, and the accessible name of the
   *  control becomes "נועה נועה". */
  decorative?: boolean;
}) {
  const initial = name.trim().charAt(0) || '·';

  return (
    <span
      title={title ?? name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold text-white',
        SIZES[size],
        toneFor(name),
        className,
      )}
    >
      <span dir="auto" aria-hidden>
        {initial}
      </span>
      {!decorative && <span className="sr-only">{name}</span>}
    </span>
  );
}
