import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ToolNeedsWorkError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(tool: string) {
    super(`${tool} is used on what a run works, and this run works nothing`);
    this.name = 'ToolNeedsWorkError';
  }
}
