import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { motion } from 'framer-motion';
import { KineticTitle } from '@/components/fx/Editorial';
import { navIndex } from './nav';
import { EASE } from '@/constants/motion';

/**
 * Editorial page header: an index line ("07 — Plan") that draws across the page,
 * a display-serif headline whose characters rise into place, then the
 * description and actions on the same beat.
 */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const idx = navIndex(pathname);
  return (
    <header className="mb-8 md:mb-12">
      <div className="mb-5 flex items-center gap-4">
        <motion.span className="label-mono whitespace-nowrap" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          {idx ? `${idx.n} — ${eyebrow ?? idx.group}` : eyebrow}
        </motion.span>
        <motion.span
          aria-hidden
          className="h-px flex-1 origin-left bg-line-strong"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, delay: 0.15, ease: EASE.outQuint }}
        />
      </div>
      <KineticTitle className="text-[clamp(3.2rem,8.5vw,7.25rem)] text-fg">{title}</KineticTitle>
      {(description || actions) && (
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          {description && (
            <motion.p
              className="max-w-xl text-[0.95rem] leading-relaxed text-fg-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE.outQuint }}
            >
              {description}
            </motion.p>
          )}
          {actions && (
            <motion.div
              className="flex flex-wrap items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: EASE.outQuint }}
            >
              {actions}
            </motion.div>
          )}
        </div>
      )}
    </header>
  );
}
