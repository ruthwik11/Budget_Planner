import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Database, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Input, MoneyInput } from '@/components/ui/Field';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { minorToDecimalString, parseMoney } from '@/utils/money';
import { DATASETS } from '@/mock-data/seed';
import { DemoNotice } from './shared';

export default function AdminPolicy() {
  const policy = useFinance((s) => s.policy);
  const update = useFinance((s) => s.updatePolicy);
  const loadDataset = useFinance((s) => s.loadDataset);
  const wipeAll = useFinance((s) => s.wipeAll);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const { symbol, toDisplay, fromDisplay } = useMoney();
  const [rows, setRows] = useState(() => Object.entries(policy.defaults).map(([name, v]) => ({ name, value: minorToDecimalString(toDisplay(v)) })));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [reset, setReset] = useState(false);
  const [wipe, setWipe] = useState(false);

  const save = () => {
    const errs: Record<number, string> = {};
    const out: Record<string, number> = {};
    rows.forEach((r, i) => {
      const name = r.name.trim();
      const v = parseMoney(r.value);
      if (!name) errs[i] = 'Name required';
      else if (v === null || v < 0) errs[i] = 'Invalid amount';
      else if (out[name] !== undefined) errs[i] = 'Duplicate category';
      else out[name] = fromDisplay(v);
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update(out);
    toast({ tone: 'success', title: 'Default policy saved', body: 'Applies to profiles created from now on.' });
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="Policy & data" description="Defaults for new profiles, and database maintenance." />
      <DemoNotice />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel eyebrow="New profiles" title="Default monthly budget policy">
          <p className="mb-4 text-sm text-fg-3">Matched to category names when a profile is created.</p>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input value={r.name} aria-label="Category name" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-invalid={!!errors[i]} />
                  {errors[i] && <p className="mt-1 text-xs text-neg">{errors[i]}</p>}
                </div>
                <div className="w-40"><MoneyInput symbol={symbol} value={r.value} aria-label={`${r.name} limit`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} /></div>
                <IconButton label={`Remove ${r.name}`} tone="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X size={15} /></IconButton>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" icon={<Plus size={14} />} onClick={() => setRows([...rows, { name: '', value: '' }])}>Add row</Button>
            <Button variant="primary" className="ml-auto" onClick={save}>Save policy</Button>
          </div>
        </Panel>
        <Panel eyebrow="Database" title="Maintenance">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 rounded-[12px] border border-line p-4">
              <Database size={18} className="shrink-0 text-fg-3" />
              <div className="flex-1"><p className="text-sm font-medium">Reset sample database</p><p className="text-xs text-fg-3">Reload the “{DATASETS[0].name}” demo for all profiles.</p></div>
              <Button variant="secondary" icon={<RotateCcw size={14} />} onClick={() => setReset(true)}>Reset</Button>
            </div>
            <div className="flex items-center gap-4 rounded-[12px] border border-[color-mix(in_oklab,var(--neg)_30%,transparent)] bg-neg-soft p-4">
              <Trash2 size={18} className="shrink-0 text-neg" />
              <div className="flex-1"><p className="text-sm font-medium">Wipe database</p><p className="text-xs text-fg-3">Remove every record from this browser and sign out.</p></div>
              <Button variant="danger" onClick={() => setWipe(true)}>Wipe</Button>
            </div>
          </div>
        </Panel>
      </div>
      <ConfirmDialog open={reset} onClose={() => setReset(false)} tone="primary" confirmLabel="Reset" title="Reset the sample database?" body="All profiles’ data will be replaced with fresh demo data." onConfirm={() => { loadDataset('personal'); toast({ tone: 'success', title: 'Sample database restored' }); if (!useFinance.getState().sessionUserId) navigate('/login'); }} />
      <ConfirmDialog open={wipe} onClose={() => setWipe(false)} confirmLabel="Wipe" title="Wipe the database?" body="Every record is deleted from this browser and replaced with empty demo profiles. You’ll be signed out. This can’t be undone." onConfirm={() => { wipeAll(); navigate('/login'); }} />
    </>
  );
}
