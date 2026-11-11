import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type {
  DomainError,
  RefusalKind,
} from '@shared-kernel/domain/exceptions/domain-error';

export class TranslatedDomainError extends ApplicationError {
  readonly kind: RefusalKind;

  constructor(readonly refusal: DomainError & { readonly kind: RefusalKind }) {
    super(refusal.message);
    this.kind = refusal.kind;
    this.name = 'TranslatedDomainError';
  }
}
