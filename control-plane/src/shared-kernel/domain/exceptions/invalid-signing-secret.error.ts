import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

// The rule that a signing secret obeys, for the messages that refuse one.
export const SIGNING_SECRET_RULE =
  'must be whsec_ followed by 24 to 64 base64-encoded random bytes';

export class InvalidSigningSecretError extends DomainError {
  readonly kind = 'invalid' as const;

  readonly because = SIGNING_SECRET_RULE;

  constructor() {
    super(`A signing secret ${SIGNING_SECRET_RULE}.`);
    this.name = 'InvalidSigningSecretError';
  }
}
