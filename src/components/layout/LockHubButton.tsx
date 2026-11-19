'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LockHubButtonProps {
  variant: 'desktop' | 'mobile';
}

export function LockHubButton({ variant }: LockHubButtonProps) {
  const router = useRouter();
  const [locking, setLocking] = useState(false);

  async function handleLockHub() {
    if (locking) return;
    setLocking(true);
    try {
      await fetch('/api/pin', { method: 'DELETE' });
    } finally {
      router.push('/pin');
      router.refresh();
      setLocking(false);
    }
  }

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={handleLockHub}
        disabled={locking}
        aria-label="TRANCAR HUB"
        title="TRANCAR HUB"
        className={cn(
          'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-[#121212] px-1 py-1 text-[9px] leading-tight tracking-wider text-[#f1f3f5] uppercase transition-all hover:border-[#f1f3f5]/40 disabled:opacity-50',
        )}
      >
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">TRANCAR HUB</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLockHub}
      disabled={locking}
      aria-label="TRANCAR HUB"
      className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs tracking-wider text-[#f1f3f5] uppercase transition-all hover:border-dashed disabled:opacity-50"
    >
      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{locking ? 'TRANCANDO...' : 'TRANCAR HUB'}</span>
    </button>
  );
}
