import type { z } from 'zod';
import { formatCentsToBRL } from '@/lib/currency';
import type { ActiveDraftContext } from '../ai/types';
import type { PendingToolActionRecord } from '../service';
import { getActionCatalogEntry } from './catalog';
import type { ActionCatalogEntry, ActionDefaultsContext } from './catalog/types';

export interface DraftFieldSummary {
  key: string;
  label: string;
  value: string;
}

export interface DraftMissingField {
  key: string;
  label: string;
}

export interface DraftSummary {
  actionLabel: string;
  collectedFields: DraftFieldSummary[];
  missingFields: DraftMissingField[];
}

export type SlotInspectionResult =
  | {
      status: 'COMPLETE';
      preparedArgs: Record<string, unknown>;
    }
  | {
      status: 'INCOMPLETE';
      collectedArgs: Record<string, unknown>;
      missingFields: string[];
      missingFieldLabels: string[];
      draftSummary: DraftSummary;
    }
  | {
      status: 'INVALID';
      zodError: z.ZodError;
    };

const EXPLICIT_CANCEL_PATTERNS: RegExp[] = [
  /^(?:ah\s+|ei\s+|ent[aã]o\s+|por\s+favor\s+|pode\s+)?(?:esquece|esque[çc]a)(?:\s+isso|\s+esse\s+rascunho|\s+o\s+rascunho|\s+tudo)?$/i,
  /^(?:ah\s+|ei\s+|ent[aã]o\s+|por\s+favor\s+|pode\s+)?(?:cancela|cancelar|cancele)(?:\s+isso|\s+esse\s+rascunho|\s+o\s+rascunho|\s+este\s+rascunho)?$/i,
  /^(?:ah\s+|ei\s+|ent[aã]o\s+)?(?:deixa|deixar)\s+(?:isso\s+)?(?:pra\s+l[aá]|quieto)$/i,
  /^(?:n[aã]o|nao)\s+(?:quero|precisa|preciso)\s+mais(?:\s+isso)?$/i,
  /^(?:desisto|desiste|aborta|abortar|mudei\s+de\s+id[eé]ia)$/i,
];

export function isExplicitDraftCancellation(message: string): boolean {
  const normalized = message
    .trim()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!normalized) return false;
  return EXPLICIT_CANCEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function safeParseArgsJson(argsJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(argsJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed json
  }
  return {};
}

export function isMissingSlotValue(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

export function stripEmptyArgs(
  rawArgs: unknown,
  preserveNullForOptional: boolean = false,
  requiredFields: string[] = [],
): Record<string, unknown> {
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return {};
  }
  const requiredSet = new Set(requiredFields);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawArgs)) {
    if (val === undefined) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (val === null && (!preserveNullForOptional || requiredSet.has(key))) continue;
    out[key] = val;
  }
  return out;
}

export function mergeDraftArgs(
  toolName: string,
  prevArgs: Record<string, unknown>,
  nextArgs: Record<string, unknown>,
): Record<string, unknown> {
  const entry = getActionCatalogEntry(toolName);
  const cleanNext = stripEmptyArgs(
    nextArgs,
    entry?.operation === 'update',
    entry?.requiredFields ?? [],
  );
  const merged: Record<string, unknown> = { ...prevArgs, ...cleanNext };

  if (toolName === 'createCalendarEvent') {
    if (cleanNext.allDay === true) {
      delete merged.startTime;
      delete merged.endTime;
    } else if (cleanNext.startTime !== undefined && cleanNext.endTime === undefined) {
      delete merged.endTime;
    }
  }

  return merged;
}

function formatCollectedValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'SIM' : 'NÃO';
  }
  if (
    typeof value === 'number' &&
    (key.endsWith('Cents') ||
      key === 'amountCents' ||
      key === 'priceCents' ||
      key === 'installmentAmountCents')
  ) {
    return formatCentsToBRL(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function buildDraftSummary(
  entry: ActionCatalogEntry,
  collectedArgs: Record<string, unknown>,
  missingFields: string[],
): DraftSummary {
  const collectedFields: DraftFieldSummary[] = [];
  for (const [key, value] of Object.entries(collectedArgs)) {
    if (isMissingSlotValue(value)) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const label = entry.fields[key]?.label ?? key.toUpperCase();
    collectedFields.push({
      key,
      label,
      value: formatCollectedValue(key, value),
    });
  }

  return {
    actionLabel: entry.displayName,
    collectedFields,
    missingFields: missingFields.map((key) => ({
      key,
      label: entry.fields[key]?.label ?? key.toUpperCase(),
    })),
  };
}

export function formatDraftDescription(
  entry: ActionCatalogEntry,
  missingFields: string[],
): string {
  const labels = missingFields.map((key) => entry.fields[key]?.label ?? key.toUpperCase());
  if (labels.length === 0) {
    return entry.displayName;
  }
  return `${entry.displayName} — FALTA: ${labels.join(', ')}`;
}

export function inspectActionSlots(
  entry: ActionCatalogEntry,
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): SlotInspectionResult {
  const cleanArgs = stripEmptyArgs(
    rawArgs,
    entry.operation === 'update',
    entry.requiredFields,
  );

  const argsWithEntryDefaults = entry.applyDefaults
    ? entry.applyDefaults(cleanArgs, ctx)
    : { ...cleanArgs };

  const collectedArgs = stripEmptyArgs(
    argsWithEntryDefaults,
    entry.operation === 'update',
    entry.requiredFields,
  );

  const preparedArgs: Record<string, unknown> = { ...collectedArgs };
  if (entry.inferableDefaults) {
    for (const [key, computeDefault] of Object.entries(entry.inferableDefaults)) {
      if (preparedArgs[key] === undefined) {
        preparedArgs[key] = computeDefault(ctx);
      }
    }
  }

  const parsed = entry.schema.safeParse(preparedArgs);
  if (parsed.success) {
    return {
      status: 'COMPLETE',
      preparedArgs,
    };
  }

  const missingSet = new Set<string>();
  for (const fieldName of entry.requiredFields) {
    if (isMissingSlotValue(preparedArgs[fieldName])) {
      missingSet.add(fieldName);
    }
  }

  if (
    entry.name === 'createCalendarEvent' &&
    preparedArgs.allDay !== true &&
    isMissingSlotValue(preparedArgs.startTime)
  ) {
    missingSet.add('startTime');
  }

  for (const issue of parsed.error.issues) {
    if (issue.path.length === 1) {
      const key = String(issue.path[0]);
      if (key in entry.fields && isMissingSlotValue(preparedArgs[key])) {
        missingSet.add(key);
      }
    }
  }

  const hasNonMissingValidationError = parsed.error.issues.some((issue) => {
    if (issue.path.length > 0) {
      const rootKey = String(issue.path[0]);
      return !missingSet.has(rootKey);
    }
    if (
      entry.name === 'createCalendarEvent' &&
      issue.message === 'HORÁRIO DE INÍCIO E FIM OBRIGATÓRIOS' &&
      missingSet.has('startTime')
    ) {
      return false;
    }
    return true;
  });

  if (hasNonMissingValidationError || missingSet.size === 0) {
    return {
      status: 'INVALID',
      zodError: parsed.error,
    };
  }

  const orderedFieldKeys = Object.keys(entry.fields);
  const missingFields = [
    ...orderedFieldKeys.filter((k) => missingSet.has(k)),
    ...Array.from(missingSet).filter((k) => !orderedFieldKeys.includes(k)),
  ];
  const missingFieldLabels = missingFields.map(
    (k) => entry.fields[k]?.label ?? k.toUpperCase(),
  );

  return {
    status: 'INCOMPLETE',
    collectedArgs,
    missingFields,
    missingFieldLabels,
    draftSummary: buildDraftSummary(entry, collectedArgs, missingFields),
  };
}

export function buildActiveDraftContext(
  draft: PendingToolActionRecord | null,
): ActiveDraftContext | null {
  if (!draft || draft.status !== 'DRAFTING') {
    return null;
  }
  const entry = getActionCatalogEntry(draft.toolName);
  const collectedArgs = safeParseArgsJson(draft.argsJson);
  let missingFieldKeys: string[] = [];
  if (draft.missingFieldsJson) {
    try {
      const parsed = JSON.parse(draft.missingFieldsJson);
      if (Array.isArray(parsed)) {
        missingFieldKeys = parsed.map(String);
      }
    } catch {
      // ignore
    }
  }

  return {
    actionId: draft.id,
    toolName: draft.toolName,
    displayName: entry?.displayName ?? draft.toolName,
    entityLabel: entry?.entityLabel ?? draft.toolName,
    collectedArgs,
    missingFields: missingFieldKeys.map((name) => ({
      name,
      label: entry?.fields[name]?.label ?? name.toUpperCase(),
      description: entry?.fields[name]?.description ?? name,
    })),
  };
}
