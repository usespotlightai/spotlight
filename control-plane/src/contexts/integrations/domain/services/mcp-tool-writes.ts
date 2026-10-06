export interface McpToolHints {
  readonly readOnlyHint?: unknown;
  readonly destructiveHint?: unknown;
}

export const mcpToolWrites = (hints: McpToolHints | undefined): boolean =>
  hints?.readOnlyHint !== true || hints.destructiveHint === true;
