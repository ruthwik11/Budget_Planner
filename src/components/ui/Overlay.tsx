import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cn } from '@/utils/cn';
import { EASE } from '@/constants/motion';
import { useMediaQuery } from '@/hooks/useMisc';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focus trap, Esc to close, scroll lock, focus restore. Shared by Dialog and Drawer. */
function useModalBehaviour(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = ref.current;
      const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? el)?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      html.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, ref]);
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Dialog: centred on desktop, becomes a bottom sheet on small screens.
 * Enter: scrim fades, panel rises 16px from 97% scale with a soft blur clearing (TTM-style layered entrance).
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const mobile = useMediaQuery('(max-width: 640px)');
  useModalBehaviour(open, onClose, ref);
  const width = size === 'sm' ? 'sm:max-w-[420px]' : size === 'lg' ? 'sm:max-w-[760px]' : 'sm:max-w-[540px]';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" data-lenis-prevent>
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line-strong bg-surface shadow-lg outline-none',
              'rounded-t-[22px] sm:rounded-[18px]',
              width,
            )}
            initial={mobile ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.97, filter: 'blur(6px)' }}
            animate={mobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={mobile ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ duration: mobile ? 0.42 : 0.36, ease: EASE.outQuint }}
            drag={mobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 120 || i.velocity.y > 600) onClose();
            }}
          >
            {mobile && <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />}
            <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-medium tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-fg-3">
                    {description}
                  </p>
                )}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
                <X size={17} />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Side drawer for details. Slides from the right; full-height sheet on mobile. */
export function Drawer({ open, onClose, title, description, children, footer }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalBehaviour(open, onClose, ref);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75]" data-lenis-prevent>
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line-strong bg-surface shadow-lg outline-none sm:inset-y-2 sm:right-2 sm:rounded-[18px] sm:border"
            initial={{ x: '104%' }}
            animate={{ x: 0 }}
            exit={{ x: '104%' }}
            transition={{ duration: 0.5, ease: EASE.wipe }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-base font-medium">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
              </div>
              <IconButton label="Close" onClick={onClose} className="-mr-2">
                <X size={17} />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-3.5">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirm step for destructive actions — replaces window.confirm with an accessible dialog. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Delete', tone = 'danger',
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; tone?: 'danger' | 'primary';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <button className="h-9 rounded-[9px] px-3.5 text-sm text-fg-2 hover:bg-surface-3 hover:text-fg" onClick={onClose}>
            Cancel
          </button>
          <button
            data-autofocus
            className={cn(
              'h-9 rounded-[9px] px-3.5 text-sm font-medium transition active:scale-95',
              tone === 'danger' ? 'bg-neg text-white hover:brightness-110' : 'bg-accent text-accent-ink',
            )}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-fg-2">{body}</div>
    </Dialog>
  );
}
