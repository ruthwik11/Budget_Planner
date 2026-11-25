import { useCallback, useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Bell, Command, Eye, EyeOff, LogOut, Menu as MenuIcon, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { ADMIN_NAV, PAGE_TITLES, SETTINGS_ITEM, USER_NAV, type NavItem } from './nav';
import { Wordmark } from './Wordmark';
import { IconButton } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Controls';
import { useCurrentUser } from '@/hooks/useData';
import { useNotifications } from '@/hooks/useNotifications';
import { useHotkey } from '@/hooks/useMisc';
import { useFinance } from '@/store/finance';
import { usePrefs } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { useMagnetic } from '@/components/animations/Motion';
import { useSpotlight } from '@/components/fx/Interactions';
import { cn } from '@/utils/cn';
import { EASE, SPRING } from '@/constants/motion';

function initials(name: string) {
  return name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function useThemeToggle() {
  const theme = usePrefs((s) => s.theme);
  const set = usePrefs((s) => s.set);
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  return { resolved, toggle: () => set({ theme: resolved === 'dark' ? 'light' : 'dark' }) };
}

// ───────────────────────── sidebar ─────────────────────────

function SideLink({ item, index, onNavigate }: { item: NavItem; index: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.to === '/admin'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-[9px] px-2.5 text-sm transition-colors duration-200',
          isActive ? 'text-fg' : 'text-fg-3 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              transition={SPRING.nav}
              className="absolute inset-0 rounded-[9px] border border-line-strong bg-surface-2 shadow-sm"
            >
              <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-x-[1px] -translate-y-1/2 rounded-full bg-accent" />
            </motion.span>
          )}
          <Icon size={16} strokeWidth={1.75} className="relative transition-transform duration-300 group-hover:scale-110" />
          <span className="relative flex-1">{item.label}</span>
          <span className="relative font-mono text-[10px] text-fg-4 opacity-0 transition-opacity group-hover:opacity-100">
            {String(index).padStart(2, '0')}
          </span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const logout = useFinance((s) => s.logout);
  const navigate = useNavigate();
  const groups = user?.role === 'admin' ? ADMIN_NAV : USER_NAV;
  let n = 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4">
        <NavLink to={user?.role === 'admin' ? '/admin' : '/'} onClick={onNavigate} aria-label="Cadence home">
          <Wordmark size={19} />
        </NavLink>
      </div>
      <LayoutGroup id="sidebar">
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.label} className="mt-4 first:mt-1">
              <div className="label-mono px-2.5 pb-1.5">{g.label}</div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <SideLink key={it.to} item={it} index={++n} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 border-t border-line pt-3">
            <SideLink item={user?.role === 'admin' ? { ...SETTINGS_ITEM, to: '/admin/settings' } : SETTINGS_ITEM} index={++n} onNavigate={onNavigate} />
          </div>
        </nav>
      </LayoutGroup>
      {user && (
        <div className="m-3 flex items-center gap-3 rounded-[12px] border border-line bg-surface-2/60 p-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface-3 text-xs font-semibold text-fg-2">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-2xs text-fg-3">{user.role === 'admin' ? 'Admin · demo mode' : `@${user.username}`}</div>
          </div>
          <IconButton
            label="Sign out"
            size="sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── top bar ─────────────────────────

function TopBar() {
  const { pathname } = useLocation();
  const user = useCurrentUser();
  const { unread } = useNotifications();
  const setPalette = useUI((s) => s.setPalette);
  const setNotifications = useUI((s) => s.setNotifications);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const openTx = useUI((s) => s.openTxEditor);
  const hide = usePrefs((s) => s.hideAmounts);
  const setPrefs = usePrefs((s) => s.set);
  const { resolved, toggle } = useThemeToggle();
  const magnet = useMagnetic<HTMLButtonElement>(0.2);
  const title = PAGE_TITLES[pathname] ?? '';

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:px-6 lg:px-8">
        <IconButton label="Open navigation" className="md:hidden -ml-2" onClick={() => setMobileNav(true)}>
          <MenuIcon size={18} />
        </IconButton>
        <div className="md:hidden">
          <Wordmark size={17} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="hidden items-center gap-2 text-sm md:flex"
          >
            <span className="text-fg-3">{user?.role === 'admin' ? 'Admin' : 'Workspace'}</span>
            <span className="text-fg-4">/</span>
            <span className="font-medium">{title}</span>
          </motion.div>
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPalette(true)}
            className="hidden h-9 w-[260px] items-center gap-2 rounded-[9px] border border-line bg-surface-2/70 px-3 text-sm text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2 lg:flex"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Search or jump to…</span>
            <Kbd>
              <Command size={10} />
            </Kbd>
            <Kbd>K</Kbd>
          </button>
          <IconButton label="Search" className="lg:hidden" onClick={() => setPalette(true)}>
            <Search size={17} />
          </IconButton>
          <IconButton label={hide ? 'Show amounts' : 'Hide amounts'} onClick={() => setPrefs({ hideAmounts: !hide })} active={hide}>
            {hide ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <IconButton label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`} onClick={toggle}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={resolved}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.25, ease: EASE.out }}
              >
                {resolved === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </motion.span>
            </AnimatePresence>
          </IconButton>
          {user?.role === 'user' && (
            <IconButton label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setNotifications(true)} className="relative">
              <Bell size={17} />
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                    className="absolute right-[3px] top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full border-2 border-bg bg-accent px-[3px] text-[8.5px] font-semibold leading-none text-accent-ink num"
                    style={{ animation: 'pulse-dot 2.4s ease-in-out infinite' }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </motion.span>
                )}
              </AnimatePresence>
            </IconButton>
          )}
          {user?.role === 'user' && (
            <button
              ref={magnet}
              onClick={() => openTx()}
              className="ml-2 hidden h-9 items-center gap-1.5 rounded-[9px] bg-accent pl-2.5 pr-3.5 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-[filter] hover:brightness-105 active:scale-95 md:flex"
            >
              <Plus size={16} strokeWidth={2.2} /> New
              <span className="ml-1 rounded-[4px] bg-accent-ink/10 px-1 font-mono text-[10px]">N</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ───────────────────────── mobile ─────────────────────────

function MobileTabBar() {
  const user = useCurrentUser();
  const openTx = useUI((s) => s.openTxEditor);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const items: NavItem[] =
    user?.role === 'admin'
      ? ADMIN_NAV[0].items.slice(0, 4)
      : [USER_NAV[0].items[0], USER_NAV[0].items[1], USER_NAV[1].items[0], USER_NAV[1].items[1]];
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);
  const Tab = ({ it }: { it: NavItem }) => (
    <NavLink
      to={it.to}
      end={it.to === '/' || it.to === '/admin'}
      className={({ isActive }) => cn('relative flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10.5px]', isActive ? 'text-fg' : 'text-fg-3')}
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="tab-active" transition={SPRING.nav} className="absolute top-0 h-[2px] w-8 rounded-full bg-accent" />}
          <it.icon size={19} strokeWidth={1.75} />
          {it.short ?? it.label}
        </>
      )}
    </NavLink>
  );
  return (
    <nav
      aria-label="Primary mobile"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <LayoutGroup id="tabs">
        <div className="flex h-[60px] items-stretch">
          {left.map((it) => (
            <Tab key={it.to} it={it} />
          ))}
          {user?.role === 'user' ? (
            <div className="flex flex-1 items-start justify-center">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => openTx()}
                aria-label="New transaction"
                className="-mt-4 grid size-12 place-items-center rounded-[15px] bg-accent text-accent-ink shadow-[0_10px_24px_-8px_color-mix(in_oklab,var(--accent)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.4)]"
              >
                <Plus size={22} strokeWidth={2.2} />
              </motion.button>
            </div>
          ) : null}
          {right.map((it) => (
            <Tab key={it.to} it={it} />
          ))}
          <button onClick={() => setMobileNav(true)} className="flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10.5px] text-fg-3">
            <MenuIcon size={19} strokeWidth={1.75} />
            More
          </button>
        </div>
      </LayoutGroup>
    </nav>
  );
}

function MobileDrawer() {
  const open = useUI((s) => s.mobileNav);
  const setOpen = useUI((s) => s.setMobileNav);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, setOpen]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] md:hidden" data-lenis-prevent>
          <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[84%] max-w-[320px] border-r border-line-strong bg-surface shadow-lg"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.45, ease: EASE.wipe }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0 }}
            onDragEnd={(_, i) => (i.offset.x < -80 || i.velocity.x < -500) && setOpen(false)}
          >
            <IconButton label="Close navigation" className="absolute right-3 top-3.5 z-10" onClick={() => setOpen(false)}>
              <X size={18} />
            </IconButton>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ───────────────────────── shell ─────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const openTx = useUI((s) => s.openTxEditor);
  const setPalette = useUI((s) => s.setPalette);
  useSpotlight();
  useHotkey('k', useCallback((e: KeyboardEvent) => { e.preventDefault(); setPalette(true); }, [setPalette]), { meta: true, global: true });
  useHotkey('n', useCallback((e: KeyboardEvent) => { if (user?.role === 'user') { e.preventDefault(); openTx(); } }, [openTx, user?.role]));
  useHotkey('/', useCallback((e: KeyboardEvent) => { e.preventDefault(); setPalette(true); }, [setPalette]));

  return (
    <div className="grain relative min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-sunken/60 md:block">
        <SidebarContent />
      </aside>
      <div className="relative md:pl-[232px]">
        <TopBar />
        <main id="main" tabIndex={-1} className="relative mx-auto w-full max-w-[1480px] px-4 pb-28 pt-5 outline-none md:px-6 md:pb-16 md:pt-7 lg:px-8">
          {children}
        </main>
      </div>
      <MobileTabBar />
      <MobileDrawer />
    </div>
  );
}
