import type { DeniedSecret } from '@secrets/application/contracts/run-secret-fetch.contract';
import { UnreadableSecretError } from '@secrets/application/errors/unreadable-secret.error';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretAwaitingValueError } from '@secrets/domain/exceptions/secret-awaiting-value.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretTargetConflictError } from '@secrets/domain/exceptions/secret-target-conflict.error';

const DENIED_ERRORS = [
  NoSuchSecretError,
  SecretAwaitingValueError,
  SecretNotBoundError,
  SecretNotInjectableError,
  SecretTargetConflictError,
  UnreadableSecretError,
];

export const deniedFor = (secret: string, error: unknown): DeniedSecret => {
  if (DENIED_ERRORS.some((kind) => error instanceof kind)) {
    return { secret, reason: (error as Error).message };
  }

  throw error;
};
