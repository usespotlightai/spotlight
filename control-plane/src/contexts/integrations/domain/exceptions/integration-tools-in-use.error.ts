import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';

export class IntegrationToolsInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    integration: string,
    readonly uses: ToolUses,
  ) {
    super(
      `Integration ${integration} would stop offering tools in use. Tools in use: ${uses.uses
        .map((each) => `${each.tool} (used by ${each.by})`)
        .join(', ')}`,
    );
    this.name = 'IntegrationToolsInUseError';
  }
}
