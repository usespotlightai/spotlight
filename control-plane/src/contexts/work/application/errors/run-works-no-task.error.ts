import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class RunWorksNoTaskError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor(what: string) {
    super(`This run may not ${what}: it works no task`);
    this.name = 'RunWorksNoTaskError';
  }
}
