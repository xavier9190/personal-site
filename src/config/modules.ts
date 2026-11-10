export type ModuleId = 'chat' | 'calendar' | 'finances' | 'academic' | 'shopping';

export interface AppModuleConfig {
  id: ModuleId;
  label: string;
  href: string;
  showAddButton: boolean;
  addButtonLabel?: string;
}

export const MODULES: readonly AppModuleConfig[] = [
  {
    id: 'chat',
    label: 'CHAT',
    href: '/',
    showAddButton: false,
  },
  {
    id: 'calendar',
    label: 'CALENDÁRIO',
    href: '/calendario',
    showAddButton: true,
    addButtonLabel: '+ NOVA AGENDA',
  },
  {
    id: 'finances',
    label: 'FINANÇAS',
    href: '/financas',
    showAddButton: true,
    addButtonLabel: 'ADICIONAR +',
  },
  {
    id: 'academic',
    label: 'ACADÊMICO',
    href: '/academico',
    showAddButton: true,
    addButtonLabel: '+ ADICIONAR',
  },
  {
    id: 'shopping',
    label: 'COMPRAS',
    href: '/compras',
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
