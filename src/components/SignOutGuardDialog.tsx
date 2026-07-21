import React, { useState } from 'react';
import { RefreshCw, LogOut, X } from 'lucide-react';

interface SignOutGuardDialogProps {
  pendingCount: number;
  /** "Sync Now" — attempt a flush, then re-evaluate. Returns how many entries are still pending afterward (0 means it's safe to sign out now). */
  onSyncNow: () => Promise<number>;
  onLeaveAnyway: () => void;
  onCancel: () => void;
}

/**
 * Milestone 2.6.4 — the three-way sign-out choice from
 * CLOUD_SYNC_PROPOSAL.md §7 / APPLICATION_INTEGRATION_PLAN.md §2.6.4.
 * Presentational only: every decision (what "Sync Now" actually does, when
 * to close, what counts as still-pending) is owned by the caller
 * (`App.tsx`'s `requestSignOut`/`handleSignOutGuard*` handlers), matching
 * the same separation of concerns already used for `SyncEngine` itself —
 * this component never imports `services/sync` directly.
 */
export default function SignOutGuardDialog({ pendingCount, onSyncNow, onLeaveAnyway, onCancel }: SignOutGuardDialogProps) {
  const [busy, setBusy] = useState(false);
  const [currentPending, setCurrentPending] = useState(pendingCount);

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      const stillPending = await onSyncNow();
      setCurrentPending(stillPending);
      // If onSyncNow fully cleared the queue, the caller has already
      // completed sign-out and unmounted this dialog — nothing further to
      // do here. If it didn't, we just show the updated count below.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={busy ? undefined : onCancel} />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0D12] p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#D4AF37]" /> Unsynced Changes
          </h3>
          <button onClick={onCancel} disabled={busy} className="text-[#94949C] hover:text-white disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#94949C] leading-relaxed">
          You have {currentPending} unsynchronized change{currentPending === 1 ? '' : 's'} that{' '}
          {currentPending === 1 ? "hasn't" : "haven't"} finished syncing to your account yet. Leaving now means{' '}
          {currentPending === 1 ? 'it' : 'they'} may not be saved.
        </p>

        <div className="space-y-2 pt-1">
          <button
            onClick={handleSyncNow}
            disabled={busy}
            className="w-full rounded-lg px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-black disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Syncing…' : 'Sync Now'}
          </button>

          <button
            onClick={onLeaveAnyway}
            disabled={busy}
            className="w-full rounded-lg px-4 py-2.5 text-xs font-bold text-red-300 bg-red-500/10 hover:bg-red-500/15 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Anyway
          </button>

          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full rounded-lg px-4 py-2 text-xs font-bold text-[#94949C] hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
