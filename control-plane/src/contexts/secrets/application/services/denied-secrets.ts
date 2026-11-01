import type { DeniedSecret } from '@secrets/application/contracts/run-secret-fetch.contract';
import { NoSuchSecretError } from '@secrets/domain/exceptions/no-such-secret.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';

const DENIED_ERRORS = [
  NoSuchSecretError,
  SecretNotBoundError,
  SecretNotInjectableError,
  UnreadableSecretError,
];

export const deniedFor = (secret: string, error: unknown): DeniedSecret => {
  if (DENIED_ERRORS.some((kind) => error instanceof kind)) {
    return { secret, reason: (error as Error).message };
  }

  throw error;
};
