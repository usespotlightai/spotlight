import type { GivenSigningSecret } from '@integrations/application/ports/hook-compiler.port';
import type { SecretGiven } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';

export const secretGiven = (given: GivenSigningSecret | null): SecretGiven => {
  if (!given) {
    return { kind: 'none' };
  }

  return given.secret === null
    ? { kind: 'kept', version: given.version }
    : {
        kind: 'given',
        held: {
          secret: HookSigningSecret.of(given.secret),
          version: given.version,
        },
      };
};
