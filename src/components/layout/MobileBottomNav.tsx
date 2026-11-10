'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getModuleByPath, MODULES } from '@/config/modules';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/pin')) {
    return null;
  }

  const activeModule = getModuleByPath(pathname);

  return (
    <nav
      aria-label="NAVEGAÇÃO INFERIOR MOBILE"
      className="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t-2 border-[#f1f3f5] bg-[#121212] px-2 md:hidden"
    >
      {MODULES.map((mod) => {
        const Icon = mod.icon;
        const isActive = activeModule?.id === mod.id;

        return (
          <Link
            key={mod.id}
            href={mod.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition-all',
              isActive
                ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212]'
                : 'border-transparent bg-[#121212] text-[#f1f3f5] hover:border-[#f1f3f5]',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{mod.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
