import { signingSecretChange } from '@integrations/application/services/signing-secrets';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import {
  SIGNING_SECRET_RULE,
  SigningSecret,
} from '@shared-kernel/domain/value-objects/signing-secret.vo';
import { describe, expect, it } from 'vitest';

const SECRET = `whsec_${Buffer.alloc(32, 3).toString('base64')}`;

describe('signingSecretChange', () => {
  it('changes nothing for a hook that names no signing secret', () => {
    expect(signingSecretChange(null)).toEqual({ kind: 'none' });
  });

  it('keeps the stored secret when the definition gives only its version', () => {
    expect(signingSecretChange({ secret: null, version: 2 })).toEqual({
      kind: 'unchanged',
      version: 2,
    });
  });

  it('takes a supplied secret with its version', () => {
    expect(signingSecretChange({ secret: SECRET, version: 3 })).toEqual({
      kind: 'supplied',
      versioned: { secret: SigningSecret.of(SECRET), version: 3 },
    });
  });

  it('refuses a secret that is not well formed at signing.secret, and says what it must be', () => {
    expect(() =>
      signingSecretChange({ secret: 'hunter2', version: 1 }),
    ).toThrow(
      new InvalidHookError(
        FieldPath.of(['signing', 'secret']),
        SIGNING_SECRET_RULE,
      ),
    );
  });
});
