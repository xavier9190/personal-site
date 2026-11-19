'use client';

import { useEffect } from 'react';
import { registerPwaServiceWorker } from '@/lib/pwa-client';

export function PwaRegistrar() {
  useEffect(() => {
    void registerPwaServiceWorker();
  }, []);

  return null;
}
