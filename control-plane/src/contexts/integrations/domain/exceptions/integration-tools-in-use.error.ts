import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IntegrationToolsInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    integration: string,
    readonly uses: ToolUses,
  ) {
    super(
      `Integration ${integration} would stop offering tools in use. Tools in use: ${uses.uses
        .map((each) => `${each.tool.value} (used by ${each.by})`)
        .join(', ')}`,
    );
    this.name = 'IntegrationToolsInUseError';
  }
}
