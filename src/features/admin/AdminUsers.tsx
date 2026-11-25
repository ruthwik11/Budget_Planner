import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Panel } from '@/components/ui/Controls';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Overlay';
import { Field, Input, Select } from '@/components/ui/Field';
import { useMoney } from '@/hooks/useMoney';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { userForm, type UserFormValues } from '@/schemas';
import { totals } from '@/lib/finance';
import { formatDate } from '@/utils/dates';
import { usePrefs } from '@/store/prefs';
import type { User } from '@/types';
import { DemoNotice, initials, useAllData } from './shared';

export default function AdminUsers() {
  const { users, transactions } = useAllData();
  const { fmt } = useMoney();
  const dateFmt = usePrefs((s) => s.dateFormat);
  const me = useFinance((s) => s.sessionUserId);
  const create = useFinance((s) => s.createUser);
  const toggle = useFinance((s) => s.toggleUserStatus);
  const remove = useFinance((s) => s.deleteUser);
  const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const { register, handleSubmit, reset, formState, setError } = useForm<UserFormValues>({ resolver: zodResolver(userForm), defaultValues: { name: '', username: '', role: 'user' } });

  const submit = handleSubmit((v) => {
    const r = create({ name: v.name, username: v.username, role: v.role });
    if (!r.ok) {
      setError('username', { message: r.reason });
      return;
    }
    toast({ tone: 'success', title: 'Profile created', body: `${v.name} got default categories and the budget policy.` });
    reset();
    setOpen(false);
  });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" description="Create, suspend and remove profiles." actions={<Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setOpen(true)}>New profile</Button>} />
      <DemoNotice />
      <Panel bodyClassName="pt-2">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left">
                {['User', 'Role', 'Status', 'Transactions', 'Spent', 'Since', ''].map((h, i) => (
                  <th key={i} className={`py-2.5 font-normal ${i === 0 ? 'pl-5' : 'px-3'} ${i === 4 ? 'text-right' : ''}`}><span className="label-mono">{h}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {users.map((u, i) => {
                  const own = transactions.filter((t) => t.userId === u.id);
                  const t = totals(own);
                  return (
                    <motion.tr key={u.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0, x: -20 }} className="border-t border-line">
                      <td className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 place-items-center rounded-[8px] bg-surface-3 text-xs font-semibold">{initials(u.name)}</span>
                          <div>
                            <div className="font-medium">{u.name}{u.id === me && <span className="ml-1.5 text-xs text-fg-4">(you)</span>}</div>
                            <div className="text-xs text-fg-3">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3"><Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>{u.role}</Badge></td>
                      <td className="px-3"><Badge tone={u.status === 'active' ? 'pos' : 'neg'} dot>{u.status}</Badge></td>
                      <td className="px-3 text-fg-2 num">{own.length}</td>
                      <td className="px-3 text-right font-medium num">{fmt(t.expense, { decimals: false })}</td>
                      <td className="px-3 text-fg-3">{formatDate(u.createdAt, dateFmt)}</td>
                      <td className="pr-5 text-right">
                        {u.id !== me && (
                          <span className="inline-flex gap-1">
                            <IconButton label={u.status === 'active' ? `Suspend ${u.name}` : `Activate ${u.name}`} size="sm" onClick={() => { toggle(u.id); toast({ tone: 'info', title: `${u.name} ${u.status === 'active' ? 'suspended' : 'activated'}` }); }}>
                              {u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                            </IconButton>
                            <IconButton label={`Delete ${u.name}`} size="sm" tone="danger" onClick={() => setDeleting(u)}><Trash2 size={14} /></IconButton>
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="New profile" description="No password is stored. Profiles are demo identities in this browser." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="user-form">Create</Button></>}>
        <form id="user-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Full name" error={formState.errors.name?.message}>{(p) => <Input {...p} {...register('name')} data-autofocus />}</Field>
          <Field label="Username" error={formState.errors.username?.message}>{(p) => <Input {...p} {...register('username')} autoComplete="off" />}</Field>
          <Field label="Role">{(p) => <Select {...p} {...register('role')}><option value="user">Personal</option><option value="admin">Admin</option></Select>}</Field>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        body="The profile and all of its transactions, accounts, budgets, goals and schedules will be permanently removed from this browser."
        onConfirm={() => { if (deleting) { remove(deleting.id); toast({ tone: 'warning', title: 'Profile deleted' }); } }}
      />
    </>
  );
}
