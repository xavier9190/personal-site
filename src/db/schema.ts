export * from '@/features/calendar/schema';
export * from '@/features/finances/schema';
export * from '@/features/academic/schema';
export * from '@/features/shopping/schema';
export * from '@/features/chat/schema';

export const DOMAIN_TABLE_NAMES = [
  'calendar_events',
  'credit_cards',
  'installment_plans',
  'payable_bills',
  'transactions',
  'finance_preferences',
  'academic_projects',
  'project_milestones',
  'project_links',
  'shopping_items',
  'chat_threads',
  'chat_messages',
  'pending_tool_actions',
] as const;
