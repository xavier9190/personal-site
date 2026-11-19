import { Suspense } from 'react';
import { resolveAuthConfig } from '@/lib/pin-auth';
import { PinAccessForm } from './PinAccessForm';

export const dynamic = 'force-dynamic';

export default function PinAccessPage() {
  const config = resolveAuthConfig(process.env);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Suspense fallback={null}>
        <PinAccessForm
          defaultSessionDays={config.defaultSessionDays}
          maxSessionDays={config.maxSessionDays}
          isMisconfigured={config.isMisconfigured}
        />
      </Suspense>
    </div>
  );
}
