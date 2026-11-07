import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';

export interface HookAllowances {
  readonly provided: readonly ToolName[];
  readonly signsTokens: boolean;
  allowsHost(host: string): boolean;
}

export const providesTool = (
  allowances: HookAllowances,
  tool: ToolName,
): boolean => allowances.provided.some((each) => each.equals(tool));
