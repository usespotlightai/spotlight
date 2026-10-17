import type { SigningSecretInput } from '@integrations/application/ports/hook-compiler.port';
import type { SigningSecretChange } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';

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
          secret: HookSigningSecret.of(input.secret),
          version: input.version,
        },
      };
};
