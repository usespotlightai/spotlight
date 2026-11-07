import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolHookDeniedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(tool: string, reason: string) {
    super(
      [`A hook stopped ${tool}, so nothing was sent.`, reason.trim()]
        .filter(Boolean)
        .join(' '),
    );
    this.name = 'ToolHookDeniedError';
  }
}
