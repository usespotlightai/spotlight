import type { HttpMethod } from '@integrations/domain/value-objects/spec-operation.vo';

const WRITING_METHODS: readonly HttpMethod[] = [
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

export interface McpToolHints {
  readonly readOnlyHint?: unknown;
  readonly destructiveHint?: unknown;
}

export const httpOperationWrites = (method: HttpMethod): boolean =>
  WRITING_METHODS.includes(method);

export const graphqlOperationWrites = (
  operation: 'query' | 'mutation',
): boolean => operation === 'mutation';

export const mcpToolWrites = (hints: McpToolHints | undefined): boolean =>
  hints?.readOnlyHint !== true || hints.destructiveHint === true;
