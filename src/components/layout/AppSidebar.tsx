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
      className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r-2 md:border-[#f1f3f5] md:bg-[#121212] md:p-4"
    >
      <div className="mb-8 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-3 text-center sketch-shadow-sm">
        <span className="text-base tracking-widest text-[#f1f3f5] uppercase">
          HUB PESSOAL
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeModule?.id === mod.id;

          return (
            <Link
              key={mod.id}
              href={mod.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[44px] items-center gap-3 rounded-md border-2 px-3 py-2.5 text-sm uppercase tracking-wider transition-all',
                isActive
                  ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212] sketch-shadow-sm'
                  : 'border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{mod.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
