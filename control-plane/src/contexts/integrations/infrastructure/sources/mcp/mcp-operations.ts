import { mcpToolWrites } from '@integrations/domain/services/mcp-tool-writes';
import {
  describedAs,
  isNameable,
  keepingFirst,
  type OperationRecord,
  type ReadOperations,
  toolWordsOf,
} from '@integrations/infrastructure/sources/operation-record';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

type Properties = Readonly<Record<string, unknown>>;

const isHeld = (value: unknown): value is Properties =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const descriptionOf = (schema: unknown): string | null =>
  isHeld(schema) && typeof schema.description === 'string'
    ? schema.description.trim() || null
    : null;

const recordOf = (tool: Tool): OperationRecord | string => {
  const name = toolWordsOf(tool.name);
  const properties = isHeld(tool.inputSchema.properties)
    ? tool.inputSchema.properties
    : {};
  const required = tool.inputSchema.required ?? [];
  const unnameable = Object.keys(properties).find((each) => !isNameable(each));

  if (name === '') {
    return `passes over ${tool.name}, which has no name a tool can take`;
  }

  if (unnameable) {
    return `passes over ${tool.name}, because it takes ${unnameable}, which a tool cannot`;
  }

  return {
    name,
    upstream: tool.name,
    description: describedAs(
      tool.description,
      tool.title ?? tool.annotations?.title ?? `Use ${tool.name}`,
    ),
    inputs: Object.entries(properties).map(([input, schema]) => ({
      name: input,
      schema,
      required: required.includes(input),
      description: descriptionOf(schema),
    })),
    writes: mcpToolWrites(tool.annotations),
    call: { kind: 'mcp', tool: tool.name },
  };
};

export const mcpOperations = (tools: readonly Tool[]): ReadOperations => {
  const records: OperationRecord[] = [];
  const passedOver: string[] = [];

  for (const tool of tools) {
    const read = recordOf(tool);

    if (typeof read === 'string') {
      passedOver.push(read);
    } else {
      records.push(read);
    }
  }

  const kept = keepingFirst(records);

  return {
    operations: kept.operations,
    passedOver: [...passedOver, ...kept.passedOver],
  };
};
