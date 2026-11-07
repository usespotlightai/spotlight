import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class EgressBlockedError extends ApplicationError {
  readonly kind = 'not-allowed' as const;

  constructor(host: string, reason: string) {
    super(`Outbound call to ${host} blocked. ${reason}`);
    this.name = 'EgressBlockedError';
  }
}
