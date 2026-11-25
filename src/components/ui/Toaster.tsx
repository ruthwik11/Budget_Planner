import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useUI } from '@/store/ui';
import { cn } from '@/utils/cn';

const ICON = { success: CircleCheck, info: Info, warning: TriangleAlert, danger: CircleAlert };
const TONE = { success: 'text-pos', info: 'text-info', warning: 'text-warn', danger: 'text-neg' };

/** Toasts stack from the bottom-right, spring in with layout animation so the stack reflows smoothly. */
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-end gap-2 md:inset-x-auto md:bottom-5 md:right-5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const I = ICON[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role="status"
              className="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[14px] border border-line-strong bg-surface-2/95 p-3.5 pr-2.5 shadow-lg backdrop-blur-md"
            >
              <I size={17} className={cn('mt-px shrink-0', TONE[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-fg-3">{t.body}</p>}
              </div>
              {t.action && (
                <button
                  className="shrink-0 rounded-[7px] px-2 py-1 text-xs font-medium text-accent-fg hover:bg-accent-soft"
                  onClick={() => {
                    t.action!.run();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-4 hover:bg-surface-3 hover:text-fg">
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
