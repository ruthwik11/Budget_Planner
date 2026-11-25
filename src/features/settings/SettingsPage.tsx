import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Database, Download, Monitor, Moon, RotateCcw, Sun, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Panel, Segmented } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useCurrentUser } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { usePrefs, type ThemePref } from '@/store/prefs';
import { exportBackup, useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { CURRENCIES, formatMoney, type CurrencyCode, type NumberLocale } from '@/utils/money';
import { formatDate, todayISO, type DateFormat } from '@/utils/dates';
import { backupSchema, profileForm } from '@/schemas';
import { DATASETS, type DatasetId } from '@/mock-data/seed';
import { downloadFile, readFileText } from '@/utils/download';
import { cn } from '@/utils/cn';
import { scrollToElement } from '@/components/animations/Cinematic';

function Row({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-fg-3">{hint}</p>}
      </div>
      <div className="shrink-0 sm:min-w-[240px] sm:max-w-[320px]">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const user = useCurrentUser();
  const prefs = usePrefs();
  const { base } = useMoney();
  const updateProfile = useFinance((s) => s.updateProfile);
  const loadDataset = useFinance((s) => s.loadDataset);
  const wipeAll = useFinance((s) => s.wipeAll);
  const importBackup = useFinance((s) => s.importBackup);
  const datasetId = useFinance((s) => s.datasetId);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [pending, setPending] = useState<DatasetId | null>(null);
  const [wipe, setWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // wait for the route transition to finish before scrolling to the section
    if (location.hash !== '#notifications') return;
    const t = setTimeout(() => scrollToElement(document.getElementById('notifications')), 950);
    return () => clearTimeout(t);
  }, []);

  const saveName = () => {
    const r = profileForm.safeParse({ name });
    if (!r.success) {
      setNameErr(r.error.issues[0].message);
      return;
    }
    setNameErr(null);
    updateProfile({ name: r.data.name });
    toast({ tone: 'success', title: 'Profile saved' });
  };

  const onBackup = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readFileText(file);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('That file isn’t valid JSON.');
      }
      const parsed = backupSchema.safeParse(json);
      if (!parsed.success) throw new Error(`Not a valid Cadence backup (${parsed.error.issues[0]?.path.join('.') || 'format'}).`);
      importBackup(parsed.data);
      toast({ tone: 'success', title: 'Backup restored', body: `${parsed.data.data.transactions.length} transactions loaded.` });
    } catch (e) {
      toast({ tone: 'danger', title: 'Import failed', body: (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const n = prefs.notifications;
  const sample = formatMoney(12345678, { currency: prefs.currency, locale: prefs.locale });

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Preferences are saved in this browser. Nothing is sent to a server." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel eyebrow="Profile" title="You">
          <Row label="Display name" htmlFor="set-name" hint={`@${user?.username} · ${user?.role === 'admin' ? 'admin (demo)' : 'personal workspace'}`}>
            <div className="flex gap-2">
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameErr} maxLength={60} />
              <Button variant="secondary" onClick={saveName} disabled={name === user?.name}>Save</Button>
            </div>
            {nameErr && <p role="alert" className="mt-1 text-xs text-neg">{nameErr}</p>}
          </Row>
          <Row label="Theme" hint="Vanilla is the default; Moonstone night is the dark variant.">
            <Segmented<ThemePref>
              label="Theme"
              value={prefs.theme}
              onChange={(v) => prefs.set({ theme: v })}
              className="w-full"
              options={[
                { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={13} />Dark</span> },
                { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={13} />Light</span> },
                { value: 'system', label: <span className="flex items-center justify-center gap-1.5"><Monitor size={13} />Auto</span> },
              ]}
            />
          </Row>
          <Row label="Reduce motion" hint="Auto follows your operating system setting.">
            <Segmented label="Reduce motion" value={prefs.reduceMotion} onChange={(v) => prefs.set({ reduceMotion: v })} className="w-full" options={[{ value: 'system', label: 'Auto' }, { value: 'on', label: 'Reduced' }, { value: 'off', label: 'Full' }]} />
          </Row>
          <Row label="Smooth scrolling" hint="Inertial wheel scrolling (touch stays native).">
            <div className="flex justify-end"><Switch checked={prefs.smoothScroll} onChange={(v) => prefs.set({ smoothScroll: v })} label="Smooth scrolling" /></div>
          </Row>
          <Row label="Film transitions" hint="Page changes play as a short cut with the page title.">
            <div className="flex justify-end"><Switch checked={prefs.filmTransitions} onChange={(v) => prefs.set({ filmTransitions: v })} label="Film transitions" /></div>
          </Row>
          <Row label="Custom cursor" hint="A trailing ring that reacts to buttons and cards (mouse only).">
            <div className="flex justify-end"><Switch checked={prefs.customCursor} onChange={(v) => prefs.set({ customCursor: v })} label="Custom cursor" /></div>
          </Row>
          <Row label="Hide amounts" hint="Masks figures for screen sharing. Shortcut: eye icon in the top bar.">
            <div className="flex justify-end"><Switch checked={prefs.hideAmounts} onChange={(v) => prefs.set({ hideAmounts: v })} label="Hide amounts" /></div>
          </Row>
        </Panel>

        <Panel eyebrow="Formats" title="Currency & numbers">
          <Row label="Display currency" htmlFor="set-cur" hint={`Data is stored in ${base}. Other currencies convert at fixed demo rates.`}>
            <Select id="set-cur" value={prefs.currency} onChange={(e) => prefs.set({ currency: e.target.value as CurrencyCode })}>
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.name}{c.code !== base ? ` (1 ${c.code} = ₹${(c.inrPaise / 100).toFixed(2)})` : ''}</option>
              ))}
            </Select>
          </Row>
          <Row label="Number format" htmlFor="set-loc" hint={<span className="num">Preview: {sample}</span>}>
            <Select id="set-loc" value={prefs.locale} onChange={(e) => prefs.set({ locale: e.target.value as NumberLocale })}>
              <option value="en-IN">1,23,45,678.00 (Indian)</option>
              <option value="en-US">12,345,678.00 (International)</option>
              <option value="de-DE">12.345.678,00 (European)</option>
              <option value="fr-FR">12 345 678,00 (French)</option>
            </Select>
          </Row>
          <Row label="Date format" htmlFor="set-date" hint={`Preview: ${formatDate(todayISO(), prefs.dateFormat)}`}>
            <Select id="set-date" value={prefs.dateFormat} onChange={(e) => prefs.set({ dateFormat: e.target.value as DateFormat })}>
              {(['DD MMM YYYY', 'MMM DD, YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as DateFormat[]).map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Row>
        </Panel>

        <Panel eyebrow="Alerts" title="Notifications" id="notifications">
          {([
            ['budget', 'Budget thresholds', 'When a budget passes 80%.'],
            ['overspend', 'Overspending', 'When a budget goes over its limit.'],
            ['goals', 'Goal milestones', 'At 25, 50, 75 and 100%.'],
            ['upcoming', 'Upcoming payments', 'Bills due within 3 days.'],
            ['summary', 'Monthly summary', 'Last month’s totals, at the start of each month.'],
            ['transactions', 'Transaction activity', 'When you add income, expenses or transfers.'],
          ] as [keyof typeof n, string, string][]).map(([k, l, h]) => (
            <Row key={k} label={l} hint={h}>
              <div className="flex justify-end"><Switch checked={n[k]} onChange={(v) => prefs.set({ notifications: { ...n, [k]: v } })} label={l} /></div>
            </Row>
          ))}
        </Panel>

        <Panel eyebrow="Data" title="Backup & demo data">
          <Row label="Export backup" hint="Everything in this workspace as a JSON file.">
            <Button variant="secondary" className="w-full" icon={<Download size={15} />} onClick={() => { downloadFile(`cadence-backup-${todayISO()}.json`, JSON.stringify(exportBackup(), null, 2), 'application/json'); toast({ tone: 'success', title: 'Backup downloaded' }); }}>
              Download JSON
            </Button>
          </Row>
          <Row label="Import backup" hint="Validated before anything is replaced. Max 5 MB.">
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onBackup(e.target.files?.[0])} aria-label="Choose backup file" />
            <Button variant="secondary" className="w-full" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>Restore from JSON</Button>
          </Row>
          <div className="border-t border-line py-4">
            <p className="text-sm font-medium">Demo datasets</p>
            <p className="mt-0.5 text-xs text-fg-3">Replace everything with a sample dataset. Export a backup first if you want to keep your data.</p>
            <div className="mt-3 grid gap-2">
              {DATASETS.map((d) => (
                <button key={d.id} onClick={() => setPending(d.id)} className={cn('flex items-center gap-3 rounded-[12px] border p-3 text-left transition-colors', datasetId === d.id ? 'border-[var(--accent-line)] bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-surface-2')}>
                  <Database size={16} className="shrink-0 text-fg-3" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">{d.name}{datasetId === d.id && <Badge tone="accent">loaded</Badge>}</span>
                    <span className="block text-xs text-fg-3">{d.description}</span>
                  </span>
                  <RotateCcw size={14} className="text-fg-4" />
                </button>
              ))}
            </div>
          </div>
          <Row label="Erase everything" hint="Clears all data and preferences from this browser.">
            <Button variant="danger" className="w-full" icon={<Trash2 size={15} />} onClick={() => setWipe(true)}>Erase local data</Button>
          </Row>
        </Panel>
      </div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        tone="primary"
        confirmLabel="Load dataset"
        title={`Load “${DATASETS.find((d) => d.id === pending)?.name}”?`}
        body="All current transactions, budgets, goals and schedules will be replaced. This can’t be undone unless you exported a backup."
        onConfirm={() => {
          if (!pending) return;
          loadDataset(pending);
          toast({ tone: 'success', title: 'Dataset loaded', body: DATASETS.find((d) => d.id === pending)?.name });
          if (!useFinance.getState().sessionUserId) navigate('/login');
        }}
      />
      <ConfirmDialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Erase all local data?"
        confirmLabel="Erase"
        body="Every record and preference stored by Cadence in this browser will be deleted and replaced with empty demo profiles, and you’ll be signed out. This can’t be undone."
        onConfirm={() => {
          wipeAll();
          localStorage.removeItem('cadence:prefs');
          navigate('/login');
        }}
      />
    </>
  );
}
