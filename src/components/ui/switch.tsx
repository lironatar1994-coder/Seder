'use client';

import { cn } from '@/lib/cn';

/**
 * An on/off control.
 *
 * A real `role="switch"` button rather than a styled checkbox: the thing being
 * toggled takes effect immediately, and a checkbox implies a form that has yet
 * to be submitted.
 *
 * The knob moves with a transform, which is physical and does not mirror on
 * its own — hence the `rtl:` variants. Everything else here is logical.
 */
export function Switch({
  checked,
  onChange,
  id,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
        // 24px tall is right for the row and wrong for a thumb; the target
        // grows past the track only where the pointer is coarse.
        "before:absolute before:content-['']",
        '[@media(pointer:coarse)]:before:-inset-y-2.5 [@media(pointer:coarse)]:before:-inset-x-4',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'block size-5 rounded-full bg-paper shadow-row transition-transform duration-200',
          checked
            ? 'translate-x-[1.375rem] rtl:-translate-x-[1.375rem]'
            : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}
