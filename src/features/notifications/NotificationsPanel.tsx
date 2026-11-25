import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarClock, CircleCheck, Flame, PartyPopper, Receipt, TriangleAlert, X } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { Empty } from '@/components/ui/Controls';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/types';
import { cn } from '@/utils/cn';

const ICON: Record<AppNotification['kind'], typeof Bell> = {
  overspend: Flame, 'budget-threshold': TriangleAlert, 'goal-milestone': PartyPopper, upcoming: CalendarClock, summary: Receipt, transaction: CircleCheck,
};
const TONE: Record<AppNotification['severity'], string> = {
  danger: 'text-neg bg-neg-soft', warning: 'text-warn bg-warn-soft', success: 'text-pos bg-pos-soft', info: 'text-info bg-info-soft',
};

export function NotificationsPanel() {
  const open = useUI((s) => s.notifications);
  const setOpen = useUI((s) => s.setNotifications);
  const { list, unread, isRead } = useNotifications();
  const markRead = usePrefs((s) => s.markRead);
  const dismiss = usePrefs((s) => s.dismiss);
  const navigate = useNavigate();

  return (
    <Drawer
      open={open}
      onClose={() => {
        setOpen(false);
        markRead(list.map((n) => n.id));
      }}
      title="Notifications"
      description={unread ? `${unread} unread` : 'You’re all caught up'}
      footer={
        list.length > 0 && (
          <>
            <button className="text-sm text-fg-3 hover:text-fg" onClick={() => markRead(list.map((n) => n.id))}>
              Mark all read
            </button>
            <button className="ml-auto text-sm text-fg-3 hover:text-fg" onClick={() => { setOpen(false); navigate('/settings#notifications'); }}>
              Preferences
            </button>
          </>
        )
      }
    >
      {list.length === 0 ? (
        <Empty icon={<Bell size={18} />} title="Nothing needs you" body="Budget alerts, goal milestones and upcoming payments will show up here." />
      ) : (
        <ul className="-mx-2 flex flex-col">
          <AnimatePresence initial={false}>
            {list.map((n, i) => {
              const I = ICON[n.kind];
              const read = isRead(n.id);
              return (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0, x: 60, height: 0, transition: { duration: 0.25 } }}
                  className="group relative"
                >
                  <button
                    onClick={() => {
                      markRead([n.id]);
                      if (n.href) {
                        setOpen(false);
                        navigate(n.href);
                      }
                    }}
                    className="flex w-full gap-3 rounded-[12px] px-2 py-3 pr-9 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-[9px]', TONE[n.severity])}>
                      <I size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', read ? 'text-fg-2' : 'font-medium text-fg')}>{n.title}</span>
                      <span className="mt-0.5 block text-xs text-fg-3">{n.body}</span>
                    </span>
                    {!read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                  <button
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(n.id)}
                    className="absolute right-1 top-3 grid size-7 place-items-center rounded-[7px] text-fg-4 opacity-0 transition-opacity hover:bg-surface-3 hover:text-fg focus:opacity-100 group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Drawer>
  );
}
