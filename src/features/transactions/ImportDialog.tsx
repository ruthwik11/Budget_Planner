import { useRef, useState } from 'react';
import { FileUp, TriangleAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Controls';
import { previewImport, CSV_TEMPLATE, type ImportPreview } from './csvIO';
import { useUserData } from '@/hooks/useData';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { readFileText, downloadFile } from '@/utils/download';
import { useMoney } from '@/hooks/useMoney';
import { CATEGORY_PALETTE } from '@/constants/palette';

/** CSV import with validation preview. Amounts are read in the display currency and converted. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cats, accts } = useUserData();
  const addCategory = useFinance((s) => s.addCategory);
  const importTx = useFinance((s) => s.importTransactions);
  const toast = useUI((s) => s.toast);
  const { fromDisplay, currency } = useMoney();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setFileName('');
    setErr(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') {
      setErr('Please choose a .csv file.');
      return;
    }
    try {
      const text = await readFileText(f);
      setFileName(f.name);
      setPreview(previewImport(text, cats));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const commit = () => {
    if (!preview) return;
    const catByKey = new Map(cats.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c.id]));
    preview.newCategories.forEach((k, i) => {
      const [kind, name] = k.split(':') as ['income' | 'expense', string];
      const c = addCategory({ name, kind, icon: 'tag', color: CATEGORY_PALETTE[(cats.length + i) % CATEGORY_PALETTE.length] });
      catByKey.set(`${kind}:${name.toLowerCase()}`, c.id);
    });
    const acctByName = new Map(accts.map((a) => [a.name.toLowerCase(), a.id]));
    const n = importTx(
      preview.valid.map((v) => ({
        type: v.type, title: v.title, amount: fromDisplay(v.amount), date: v.date,
        categoryId: catByKey.get(`${v.type}:${v.category.toLowerCase()}`) ?? null,
        accountId: (v.account && acctByName.get(v.account.toLowerCase())) || accts[0].id,
        paymentMethod: 'other' as const, tags: ['imported'],
      })),
    );
    toast({ tone: 'success', title: `Imported ${n} transactions`, body: preview.newCategories.length ? `${preview.newCategories.length} new categories created.` : undefined });
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import transactions"
      description={`CSV with columns date, type, title, category, amount (in ${currency}), optional account.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => downloadFile('cadence-import-template.csv', CSV_TEMPLATE, 'text/csv;charset=utf-8')}>
            Download template
          </Button>
          <Button variant="primary" disabled={!preview?.valid.length} onClick={commit}>
            Import {preview?.valid.length ? preview.valid.length : ''} rows
          </Button>
        </>
      }
    >
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose CSV file" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0]);
        }}
        className="flex w-full flex-col items-center gap-2 rounded-[14px] border border-dashed border-line-strong bg-surface-2/50 px-6 py-10 text-center transition-colors hover:border-[var(--accent-line)] hover:bg-accent-soft"
      >
        <FileUp size={22} className="text-fg-3" />
        <span className="text-sm font-medium">{fileName || 'Drop a CSV here or click to browse'}</span>
        <span className="text-xs text-fg-3">Max 5 MB · validated before anything is saved</span>
      </button>
      {err && <p role="alert" className="mt-3 text-sm text-neg">{err}</p>}
      {preview && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="pos">{preview.valid.length} valid</Badge>
            {preview.errors.length > 0 && <Badge tone="neg">{preview.errors.length} skipped</Badge>}
            {preview.newCategories.length > 0 && <Badge tone="info">{preview.newCategories.length} new categories</Badge>}
          </div>
          {preview.errors.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-[10px] border border-line bg-surface-2 p-3 text-xs text-fg-3">
              {preview.errors.slice(0, 50).map((e) => (
                <li key={e.line} className="flex gap-2 py-0.5">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0 text-warn" /> Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
