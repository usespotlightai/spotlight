import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class ActsOnItselfOnlyError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(`This run may not ${what}: it acts only on itself`);
    this.name = 'ActsOnItselfOnlyError';
  }
}
