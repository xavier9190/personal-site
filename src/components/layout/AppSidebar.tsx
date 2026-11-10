'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getModuleByPath, MODULES } from '@/config/modules';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/pin')) {
    return null;
  }

  const activeModule = getModuleByPath(pathname);

  return (
    <aside
      aria-label="NAVEGAÇÃO PRINCIPAL DESKTOP"
      className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r-2 md:border-[#f1f3f5] md:bg-[#121212] md:px-4 md:py-5"
    >
      <div className="mb-4 px-2">
        <span className="block text-base tracking-widest text-[#f1f3f5] uppercase">
          HUB PESSOAL
        </span>
        <div className="mt-3 h-[2px] w-full bg-[#f1f3f5]" />
      </div>

      <nav className="flex flex-col gap-1">
        {MODULES.map((mod) => {
          const isActive = activeModule?.id === mod.id;

          return (
            <Link
              key={mod.id}
              href={mod.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[42px] items-center justify-between rounded-md border px-3 py-2 text-sm text-[#f1f3f5] uppercase tracking-wider transition-all',
                isActive
                  ? 'border-[#f1f3f5] bg-[#121212]'
                  : 'border-transparent bg-[#121212] hover:border-[#f1f3f5]/40',
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rotate-45 border border-[#f1f3f5]"
                />
                <span>{mod.label}</span>
              </span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="h-5 w-[2px] rounded-full bg-[#f1f3f5]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 px-2">
        <div className="h-[2px] w-full bg-[#f1f3f5]" />
      </div>
    </aside>
  );
}
