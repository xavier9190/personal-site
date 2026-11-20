import type { FunctionDeclaration } from '@google/genai';
import {
  buildGeminiFunctionDeclaration,
  type ActionCatalogEntry,
  type ToolDefinition,
} from './types';
import { CALENDAR_CATALOG } from './calendar';
import { FINANCES_CATALOG } from './finances';
import { ACADEMIC_CATALOG } from './academic';
import { SHOPPING_CATALOG } from './shopping';

export * from './types';
export * from './calendar';
export * from './finances';
export * from './academic';
export * from './shopping';

export const ACTION_CATALOG: Record<string, ActionCatalogEntry> = {
  ...CALENDAR_CATALOG,
  ...FINANCES_CATALOG,
  ...ACADEMIC_CATALOG,
  ...SHOPPING_CATALOG,
};

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = ACTION_CATALOG;

export function getActionCatalogEntry(toolName: string): ActionCatalogEntry | undefined {
  return ACTION_CATALOG[toolName];
}

export function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return Object.values(ACTION_CATALOG).map((entry) =>
    buildGeminiFunctionDeclaration(entry),
  );
}
