import type { SigningSecretInput } from '@integrations/application/ports/hook-compiler.port';
import type { SigningSecretChange } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import {
  SIGNING_SECRET_RULE,
  SigningSecret,
} from '@shared-kernel/domain/value-objects/signing-secret.vo';

// The error names the field signing.secret, so the message points at the field of the hook.
const suppliedSigningSecret = (raw: string): SigningSecret => {
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
          secret: suppliedSigningSecret(input.secret),
          version: input.version,
        },
      };
};
