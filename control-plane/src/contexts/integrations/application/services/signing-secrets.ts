import type { SigningSecretInput } from '@integrations/application/ports/hook-compiler.port';
import type { SigningSecretChange } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import {
  SIGNING_SECRET_RULE,
  SigningSecret,
} from '@shared-kernel/domain/value-objects/signing-secret.vo';

// A hook names the field of a secret that does not sign, so the message points at signing.secret.
const signingSecretOf = (raw: string): SigningSecret => {
  if (!SigningSecret.isWellFormed(raw)) {
    throw new InvalidHookError(
      FieldPath.of(['signing', 'secret']),
      SIGNING_SECRET_RULE,
    );
  }

  return SigningSecret.of(raw);
};

export const signingSecretChange = (
  input: SigningSecretInput | null,
): SigningSecretChange => {
  if (!input) {
    return { kind: 'none' };
  }

  return input.secret === null
    ? { kind: 'unchanged', version: input.version }
    : {
        kind: 'supplied',
        versioned: {
          secret: signingSecretOf(input.secret),
          version: input.version,
        },
      };
};
