import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import {
  ApplicationError,
  type ApplicationErrorKind,
} from '@shared-kernel/application/errors/application-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import {
  DomainError,
  type DomainErrorKind,
} from '@shared-kernel/domain/exceptions/domain-error';

type FailureKind = DomainErrorKind | ApplicationErrorKind;

const PERMANENT_KINDS: ReadonlySet<FailureKind> = new Set([
  'invalid',
  'not-allowed',
  'not-found',
]);

export const deliveryFailureOf = (error: unknown): DeliveryFailure | null => {
  if (error instanceof UpstreamError) {
    return error.retryable
      ? DeliveryFailure.transient(error.message)
      : DeliveryFailure.permanent(error.message);
  }

  if (!(error instanceof DomainError || error instanceof ApplicationError)) {
    return null;
  }

  if (error.kind === 'conflict') {
    return DeliveryFailure.transient(error.message);
  }

  return PERMANENT_KINDS.has(error.kind)
    ? DeliveryFailure.permanent(error.message)
    : null;
};
