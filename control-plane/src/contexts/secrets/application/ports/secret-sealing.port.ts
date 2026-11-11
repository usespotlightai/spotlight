import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

export const SECRET_SEALING = Symbol('SECRET_SEALING');

export interface SealingRecipient {
  readonly key: string;
}

export interface SealedFor {
  readonly subject: string;
  readonly secretName: string;
}

export interface SecretSealingPort {
  recipientOf(written: string): SealingRecipient;

  seal(
    value: SecretValue,
    recipient: SealingRecipient,
    sealedFor: SealedFor,
  ): string;
}
