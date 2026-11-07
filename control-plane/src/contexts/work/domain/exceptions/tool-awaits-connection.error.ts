import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolAwaitsConnectionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(tool: string, integration: string) {
    super(
      `${tool} acts as the person who started this task, and they haven't connected ${integration}. They've been asked in their inbox. Nothing was sent. Stop here and end your turn: you're resumed once they connect.`,
    );
    this.name = 'ToolAwaitsConnectionError';
  }
}
