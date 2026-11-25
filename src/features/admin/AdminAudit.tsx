import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Empty, Panel } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Input } from '@/components/ui/Field';
import { useDebounced } from '@/hooks/useMisc';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { toCSV } from '@/utils/csv';
import { downloadFile } from '@/utils/download';
import { todayISO } from '@/utils/dates';
import { DemoNotice, useAllData } from './shared';

export default function AdminAudit() {
  const { audit } = useAllData();
  const clear = useFinance((s) => s.clearAudit);
  const toast = useUI((s) => s.toast);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 150);
  const [confirm, setConfirm] = useState(false);
  const list = useMemo(() => {
    const s = dq.toLowerCase();
    return s ? audit.filter((a) => `${a.action} ${a.actor} ${a.details}`.toLowerCase().includes(s)) : audit;
  }, [audit, dq]);
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit trail"
        description="Sign-ins, profile changes, imports and admin actions, newest first."
        actions={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => downloadFile(`cadence-audit-${todayISO()}.csv`, toCSV(['time', 'action', 'actor', 'details'], audit.map((a) => [new Date(a.at).toISOString(), a.action, a.actor, a.details])), 'text/csv;charset=utf-8')}>Export</Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirm(true)} disabled={!audit.length}>Clear</Button>
          </>
        }
      />
      <DemoNotice />
      <Panel bodyClassName="pt-4">
        <div className="mb-4"><Input leading={<Search size={15} />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter events" aria-label="Filter events" /></div>
        {list.length === 0 ? <Empty title="No events" /> : (
          <ol className="relative flex flex-col">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-line" aria-hidden />
            {list.slice(0, 200).map((a, i) => (
              <motion.li key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }} className="relative flex gap-4 py-2.5 pl-6">
                <span className="absolute left-[3px] top-[15px] size-[9px] rounded-full border-2 border-surface bg-fg-3" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={/delete|clear|wipe/i.test(a.action) ? 'neg' : /sign/i.test(a.action) ? 'neutral' : 'info'}>{a.action}</Badge>
                    <span className="text-fg-2">{a.actor}</span>
                    <span className="ml-auto text-xs text-fg-4 num">{new Date(a.at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-fg-3">{a.details}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </Panel>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Clear the audit trail?" body="All events are removed. A single “Audit cleared” event is recorded." onConfirm={() => { clear(); toast({ tone: 'info', title: 'Audit trail cleared' }); }} />
    </>
  );
}
