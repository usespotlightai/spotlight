import type { DeniedSecret } from '@secrets/application/contracts/run-secret-fetch.contract';
import { UnreadableSecretError } from '@secrets/application/errors/unreadable-secret.error';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretAwaitingValueError } from '@secrets/domain/exceptions/secret-awaiting-value.error';
import { SecretKeptOutOfSandboxError } from '@secrets/domain/exceptions/secret-kept-out-of-sandbox.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretTargetConflictError } from '@secrets/domain/exceptions/secret-target-conflict.error';
import { SecretTooShortForSandboxError } from '@secrets/domain/exceptions/secret-too-short-for-sandbox.error';

const DENIED_ERRORS = [
  NoSuchSecretError,
  SecretAwaitingValueError,
  SecretKeptOutOfSandboxError,
  SecretNotBoundError,
  SecretNotInjectableError,
  SecretTargetConflictError,
  SecretTooShortForSandboxError,
  UnreadableSecretError,
];

export const deniedFor = (secret: string, error: unknown): DeniedSecret => {
  if (DENIED_ERRORS.some((kind) => error instanceof kind)) {
    return { secret, reason: (error as Error).message };
  }

  throw error;
};
