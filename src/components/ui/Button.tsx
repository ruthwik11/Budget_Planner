import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';
import { SPRING } from '@/constants/motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,border-color,box-shadow] duration-200 ease-[var(--ease-out-soft)] disabled:opacity-40 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.3)] hover:brightness-[1.06]',
  secondary: 'bg-surface-3 text-fg border border-line hover:bg-hover hover:border-line-strong',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-2',
  danger: 'bg-neg-soft text-neg border border-[color-mix(in_oklab,var(--neg)_30%,transparent)] hover:bg-[color-mix(in_oklab,var(--neg)_18%,transparent)]',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-[8px]',
  md: 'h-9 px-3.5 text-sm rounded-[9px]',
  lg: 'h-11 px-5 text-base rounded-[11px]',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

/** Press feedback is a quick spring squash; hover is a CSS colour shift (cheap, no JS per frame). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.965 }}
      transition={SPRING.snappy}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </motion.button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md'; tone?: 'default' | 'danger'; active?: boolean }
>(function IconButton({ label, className, children, size = 'md', tone = 'default', active, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[8px] text-fg-3 transition-[color,background,transform] duration-150 active:scale-90',
        size === 'sm' ? 'size-7' : 'size-9',
        tone === 'danger' ? 'hover:bg-neg-soft hover:text-neg' : 'hover:bg-surface-2 hover:text-fg',
        active && 'bg-surface-2 text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
