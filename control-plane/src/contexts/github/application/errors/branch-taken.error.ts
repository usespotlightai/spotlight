import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class BranchTakenError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(branch: string) {
    super(
      `Branch ${branch} has commits not written by Spotlight. Spotlight leaves it unchanged.`,
    );
    this.name = 'BranchTakenError';
  }
}
