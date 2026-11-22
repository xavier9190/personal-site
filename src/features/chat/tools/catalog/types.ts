import type { FunctionDeclaration } from '@google/genai';
import { z } from 'zod';

export type ToolModule = 'CALENDAR' | 'FINANCES' | 'ACADEMIC' | 'SHOPPING';
export type OperationKind = 'create' | 'update' | 'delete' | 'read';

export interface ToolFieldMetadata {
  name: string;
  label: string;
  description: string;
  required: boolean;
  inferableDefault?: string;
}

export interface ActionDefaultsContext {
  currentDateRecife?: string;
}

export interface ToolDefinition {
  name: string;
  module: ToolModule;
  description: string;
  isDestructive: boolean;
  schema: z.ZodTypeAny;
}

export interface ActionCatalogEntry<TSchema extends z.ZodTypeAny = z.ZodTypeAny>
  extends ToolDefinition {
  displayName: string;
  entityLabel: string;
  operation: OperationKind;
  schema: TSchema;
  fields: Record<string, ToolFieldMetadata>;
  requiredFields: string[];
  optionalFields: string[];
  inferableDefaults?: Record<string, (ctx?: ActionDefaultsContext) => unknown>;
  applyDefaults?: (
    rawArgs: Record<string, unknown>,
    ctx?: ActionDefaultsContext,
  ) => Record<string, unknown>;
}

/**
 * Helper to register an ActionCatalogEntry with derived requiredFields/optionalFields
 * when not explicitly overridden.
 */
export function defineAction<TSchema extends z.ZodTypeAny>(
  entry: Omit<ActionCatalogEntry<TSchema>, 'requiredFields' | 'optionalFields'> & {
    requiredFields?: string[];
    optionalFields?: string[];
  },
): ActionCatalogEntry<TSchema> {
  const fieldValues = Object.values(entry.fields);
  const requiredFields =
    entry.requiredFields ?? fieldValues.filter((f) => f.required).map((f) => f.name);
  const optionalFields =
    entry.optionalFields ?? fieldValues.filter((f) => !f.required).map((f) => f.name);

  return {
    ...entry,
    requiredFields,
    optionalFields,
  };
}

/**
 * Generates a Gemini FunctionDeclaration from a catalog entry's canonical Zod schema
 * using Zod v4's native `z.toJSONSchema`.
 *
 * Strips `$schema` and omits top-level `required` on mutating (`create` / `update`)
 * declarations so Gemini does not hallucinate missing slots during slot-filling.
 */
export function buildGeminiFunctionDeclaration(entry: ActionCatalogEntry): FunctionDeclaration {
  const generated = z.toJSONSchema(entry.schema, {
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  const { $schema: _ignoredSchema, ...rest } = generated;
  const parametersJsonSchema: Record<string, unknown> = { ...rest };

  if (entry.operation === 'create' || entry.operation === 'update') {
    delete parametersJsonSchema.required;
  }

  if (
    parametersJsonSchema.properties &&
    typeof parametersJsonSchema.properties === 'object'
  ) {
    const rawProps = parametersJsonSchema.properties as Record<string, Record<string, unknown>>;
    const enrichedProps: Record<string, Record<string, unknown>> = {};

    for (const [propName, propSchema] of Object.entries(rawProps)) {
      const meta = entry.fields[propName];
      if (meta && !propSchema.description) {
        const defaultHint = meta.inferableDefault
          ? ` (Padrão inferível: ${meta.inferableDefault})`
          : '';
        enrichedProps[propName] = {
          ...propSchema,
          description: `${meta.description}${defaultHint}`,
        };
      } else {
        enrichedProps[propName] = { ...propSchema };
      }
    }

    parametersJsonSchema.properties = enrichedProps;
  }

  return {
    name: entry.name,
    description: entry.description,
    parametersJsonSchema,
  };
}
