import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';

export class IntegrationToolsInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    source: string,
    readonly uses: ToolUses,
  ) {
    super(
      `The ${source} integration would stop offering ${uses.uses
        .map((each) => `${each.tool}, which ${each.by} gives`)
        .join('; ')}; take the tool off those stations first`,
    );
    this.name = 'IntegrationToolsInUseError';
  }
}
