import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';

export class IntegrationToolsInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    source: string,
    readonly uses: ToolUses,
  ) {
    super(
      `The ${source} integration would stop offering ${uses.uses
        .map((each) => `${each.tool}, which ${each.by} uses`)
        .join('; ')}; stop using it there first`,
    );
    this.name = 'IntegrationToolsInUseError';
  }
}
