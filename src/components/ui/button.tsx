import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-[var(--on-accent)] hover:bg-accent-hover shadow-row',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-p1 border border-p1/30 hover:bg-p1/8',
};

const SIZES: Record<Size, string> = {
  // `sm` is a 36px control, which is right beside dense content and wrong under
  // a thumb. It grows to the touch floor only where the pointer is coarse, so
  // desktop toolbars keep their density.
  sm: 'h-9 px-3 text-sm gap-1.5 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-4',
  md: 'h-11 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-semibold',
        'transition-colors duration-120 ease-[var(--ease-out-soft)]',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone tells a screen reader nothing. */
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, label, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted',
          'transition-colors duration-120 hover:bg-surface-2 hover:text-ink',
          'disabled:pointer-events-none disabled:opacity-40',
          // 32px is a comfortable pointer target and a poor thumb one. Rather
          // than grow the glyph — which would coarsen every toolbar in the app —
          // the target grows past the box on touch devices only. The visual
          // size, and so the layout, is unchanged.
          "before:absolute before:content-[''] [@media(pointer:coarse)]:before:-inset-1.5",
          className,
        )}
        {...props}
      />
    );
  },
);
