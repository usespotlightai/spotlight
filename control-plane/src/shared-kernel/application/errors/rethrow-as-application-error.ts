import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export function rethrowAsApplicationError(error: unknown): never {
  if (error instanceof DomainError && error.isRefusal()) {
    throw new TranslatedDomainError(error);
  }

  throw error;
}
