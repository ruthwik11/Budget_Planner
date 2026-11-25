import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const control =
  'w-full rounded-[9px] border bg-surface-2 text-fg placeholder:text-fg-4 transition-[border-color,box-shadow,background] duration-200 outline-none ' +
  'border-line hover:border-line-strong focus:border-[var(--accent-line)] focus:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'aria-[invalid=true]:border-[color-mix(in_oklab,var(--neg)_55%,transparent)] aria-[invalid=true]:shadow-[0_0_0_3px_var(--neg-soft)]';

export interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
  optional?: boolean;
}

/** Label + control + animated validation message, wired for screen readers. */
export function Field({ label, error, hint, children, className, optional }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-xs font-medium text-fg-2">
        {label}
        {optional && <span className="text-2xs font-normal text-fg-4">Optional</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? msgId : undefined })}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="e"
            id={msgId}
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-neg"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="h" id={msgId} className="text-xs text-fg-3">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(
  function Input({ className, leading, ...rest }, ref) {
    if (leading)
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-3">{leading}</span>
          <input ref={ref} className={cn(control, 'h-10 pl-9 pr-3', className)} {...rest} />
        </div>
      );
    return <input ref={ref} className={cn(control, 'h-10 px-3', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={3} className={cn(control, 'resize-none px-3 py-2.5', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-10 appearance-none pl-3 pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-3" />
    </div>
  );
});

/** Large, tabular amount entry with currency prefix. Value stays a string; parsing happens in Zod. */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { symbol: string; large?: boolean }>(
  function MoneyInput({ symbol, large, className, ...rest }, ref) {
    return (
      <div className="relative">
        <span
          className={cn(
            'pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-medium text-fg-3 num',
            large ? 'text-xl' : 'text-sm',
          )}
        >
          {symbol}
        </span>
        <input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          className={cn(control, 'num', large ? 'h-16 pl-11 pr-4 text-[2rem] font-medium tracking-tight' : 'h-10 pl-9 pr-3', className)}
          {...rest}
        />
      </div>
    );
  },
);

export function Checkbox({
  checked, indeterminate, onChange, label, className,
}: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all duration-150 active:scale-90',
        checked || indeterminate ? 'border-transparent bg-accent text-accent-ink' : 'border-line-strong bg-surface-2 hover:border-fg-4',
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {(checked || indeterminate) && (
          <motion.svg
            key={indeterminate ? 'i' : 'c'}
            viewBox="0 0 12 12"
            className="size-3"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            {indeterminate ? (
              <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <motion.path
                d="M2.5 6.2 5 8.6l4.5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22 }}
              />
            )}
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border p-[2px] transition-colors duration-200',
        checked ? 'border-transparent bg-accent' : 'border-line-strong bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
        className={cn('block size-4 rounded-full shadow-sm', checked ? 'ml-auto bg-accent-ink' : 'bg-fg-3')}
      />
    </button>
  );
}
