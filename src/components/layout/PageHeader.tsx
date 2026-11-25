import type { ReactNode } from 'react';
import { SplitReveal } from '@/components/animations/Motion';
import { motion } from 'framer-motion';
import { EASE } from '@/constants/motion';

/** Page title reveals word-by-word; description and actions follow on the same beat. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <motion.div className="label-mono mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {eyebrow}
          </motion.div>
        )}
        <SplitReveal as="h1" className="text-[1.75rem] font-medium leading-[1.05] tracking-[-0.035em] md:text-[2.25rem]">
          {title}
        </SplitReveal>
        {description && (
          <motion.p
            className="mt-2 max-w-xl text-sm text-fg-3"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: EASE.outQuint }}
          >
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div
          className="flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE.outQuint }}
        >
          {actions}
        </motion.div>
      )}
    </div>
  );
}
