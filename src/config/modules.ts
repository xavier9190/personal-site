import {
  Calendar,
  GraduationCap,
  MessageSquare,
  ShoppingBag,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type ModuleId = 'chat' | 'calendar' | 'finances' | 'academic' | 'shopping';

export interface AppModuleConfig {
  id: ModuleId;
  label: string;
  href: string;
  icon: LucideIcon;
  showAddButton: boolean;
  addButtonLabel?: string;
}

export const MODULES: readonly AppModuleConfig[] = [
  {
    id: 'chat',
    label: 'CHAT',
    href: '/',
    icon: MessageSquare,
    showAddButton: false,
  },
  {
    id: 'calendar',
    label: 'CALENDÁRIO',
    href: '/calendario',
    icon: Calendar,
    showAddButton: true,
    addButtonLabel: '+ NOVA AGENDA',
  },
  {
    id: 'finances',
    label: 'FINANÇAS',
    href: '/financas',
    icon: Wallet,
    showAddButton: true,
    addButtonLabel: 'ADICIONAR +',
  },
  {
    id: 'academic',
    label: 'ACADÊMICO',
    href: '/academico',
    icon: GraduationCap,
    showAddButton: true,
    addButtonLabel: '+ ADICIONAR',
  },
  {
    id: 'shopping',
    label: 'COMPRAS',
    href: '/compras',
    icon: ShoppingBag,
    showAddButton: true,
    addButtonLabel: '+ ADICIONAR',
  },
] as const;

export function getModuleByPath(pathname: string): AppModuleConfig | undefined {
  const normalized = pathname === '' ? '/' : pathname;
  if (normalized === '/') {
    return MODULES[0];
  }
  return MODULES.find((mod) => mod.href !== '/' && normalized.startsWith(mod.href));
}
