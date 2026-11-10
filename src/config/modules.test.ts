import { describe, expect, it } from 'vitest';
import { getModuleByPath, MODULES } from './modules';

describe('module registry seam (Sidebar / BottomNav & Add Button rules)', () => {
  it('registers all 5 canonical modules in order with uppercase labels', () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      'chat',
      'calendar',
      'finances',
      'academic',
      'shopping',
    ]);
    expect(MODULES.map((m) => m.label)).toEqual([
      'CHAT',
      'CALENDÁRIO',
      'FINANÇAS',
      'ACADÊMICO',
      'COMPRAS',
    ]);
  });

  it('hides the standardized add button on Chat and displays it on the other 4 modules', () => {
    const chat = getModuleByPath('/');
    const calendar = getModuleByPath('/calendario');
    const finances = getModuleByPath('/financas');
    const academic = getModuleByPath('/academico');
    const shopping = getModuleByPath('/compras');

    expect(chat?.showAddButton).toBe(false);
    expect(calendar?.showAddButton).toBe(true);
    expect(calendar?.addButtonLabel).toBe('+ NOVA AGENDA');
    expect(finances?.showAddButton).toBe(true);
    expect(finances?.addButtonLabel).toBe('ADICIONAR +');
    expect(academic?.showAddButton).toBe(true);
    expect(academic?.addButtonLabel).toBe('+ ADICIONAR');
    expect(shopping?.showAddButton).toBe(true);
    expect(shopping?.addButtonLabel).toBe('+ ADICIONAR');
  });
});
