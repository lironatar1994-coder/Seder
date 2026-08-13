import * as React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      /* dir="auto" per field: an email or an English word typed into a Hebrew
         form resolves its own direction instead of jumping to the wrong side.
         Callers that need a fixed direction (email, time) override it. */
      dir={props.dir ?? 'auto'}
      className={cn(
        'block w-full rounded-lg border border-line-strong bg-surface',
        'px-3 py-2.5 text-base text-ink',
        'transition-colors duration-120',
        'hover:border-muted focus:border-accent',
        'aria-[invalid=true]:border-p1',
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      dir={props.dir ?? 'auto'}
      className={cn(
        'block w-full resize-y rounded-lg border border-line-strong bg-surface',
        'px-3 py-2.5 text-base leading-relaxed text-ink',
        'transition-colors duration-120 hover:border-muted focus:border-accent',
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-sm font-semibold text-ink-2', className)}
      {...props}
    />
  );
}

/** Field-level error. Wired to the input with aria-describedby by the caller. */
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm font-medium text-p1">
      {children}
    </p>
  );
}
