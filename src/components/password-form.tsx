'use client';

import { useState } from 'react';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Wordmark } from './brand';

/** Change your own password (live mode). */
export function ChangePasswordForm({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const { changePassword } = useStore();
  const [f, setF] = useState({ old: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (f.next.length < 8) return setError('New password must be at least 8 characters.');
    if (f.next !== f.confirm) return setError('The new passwords do not match.');
    if (f.next === f.old) return setError('Choose a password different from the current one.');
    setBusy(true);
    const r = await changePassword(f.old, f.next);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
    setF({ old: '', next: '', confirm: '' });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : ''}`}>
      {(
        [
          ['old', 'Current password', 'current-password'],
          ['next', 'New password (8+ characters)', 'new-password'],
          ['confirm', 'Confirm new password', 'new-password'],
        ] as const
      ).map(([k, l, ac]) => (
        <div key={k}>
          <label className="label" htmlFor={`pw-${k}`}>{l}</label>
          <input id={`pw-${k}`} type="password" autoComplete={ac} required className="input" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
        </div>
      ))}
      {error && <p className={`rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-600 ${compact ? 'sm:col-span-3' : ''}`}>{error}</p>}
      {done && !error && (
        <p className={`flex items-center gap-1.5 rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700 ${compact ? 'sm:col-span-3' : ''}`}>
          <CheckCircle2 size={15} /> Password changed.
        </p>
      )}
      <div className={compact ? 'sm:col-span-3' : ''}>
        <button disabled={busy} className="btn-primary w-full sm:w-auto">
          <KeyRound size={15} /> {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

/** Blocks the app until someone signing in with a temporary password picks their own. */
export function MustChangePassword() {
  const { currentUser, signOut } = useStore();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="card w-full max-w-md">
        <Wordmark className="text-2xl" />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome{currentUser ? `, ${currentUser.fullName}` : ''}. You signed in with a temporary password. Set your own before continuing.
        </p>
        <div className="mt-5">
          <ChangePasswordForm />
        </div>
        <button onClick={signOut} className="mt-4 text-xs text-slate-400 hover:text-ink hover:underline">Sign out</button>
      </div>
    </div>
  );
}
