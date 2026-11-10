'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  GraduationCap,
  MessageSquare,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { getModuleByPath, MODULES, type ModuleId } from '@/config/modules';
import { cn } from '@/lib/utils';

const MODULE_ICONS: Record<ModuleId, typeof MessageSquare> = {
  chat: MessageSquare,
  calendar: Calendar,
  finances: Wallet,
  academic: GraduationCap,
  shopping: ShoppingBag,
};

export function AppSidebar() {
  const pathname = usePathname() || '/';
  const activeModule = getModuleByPath(pathname);

  return (
    <aside
      aria-label="NAVEGAÇÃO PRINCIPAL DESKTOP"
      className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r-2 md:border-[#f1f3f5] md:bg-[#1e1e1e] md:p-4"
    >
      <div className="mb-8 rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-3 text-center sketch-shadow-sm">
        <span className="text-base tracking-widest text-[#f1f3f5] uppercase">
          HUB PESSOAL
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-3">
        {MODULES.map((mod) => {
          const Icon = MODULE_ICONS[mod.id];
          const isActive = activeModule?.id === mod.id;

          return (
            <Link
              key={mod.id}
              href={mod.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[44px] items-center gap-3 rounded-md border-2 px-3 py-2.5 text-sm uppercase tracking-wider transition-all',
                isActive
                  ? 'border-[#ffec99] bg-[#ffec99] text-[#121212] sketch-shadow-sm'
                  : 'border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] hover:border-[#a5d8ff] hover:text-[#a5d8ff]',
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
