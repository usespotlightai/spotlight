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

const kindOf = (error: unknown): FailureKind | null =>
  error instanceof DomainError || error instanceof ApplicationError
    ? error.kind
    : null;

export const deliveryFailureOf = (error: unknown): DeliveryFailure | null => {
  if (error instanceof UpstreamError) {
    return error.retryable
      ? DeliveryFailure.transient(error.message)
      : DeliveryFailure.permanent(error.message);
  }

  const kind = kindOf(error);

  if (kind === 'conflict') {
    return DeliveryFailure.transient((error as Error).message);
  }

  return kind !== null && PERMANENT_KINDS.has(kind)
    ? DeliveryFailure.permanent((error as Error).message)
    : null;
};
