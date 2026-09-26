import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

export const RUN_SEALING = Symbol('RUN_SEALING');

export interface SealingRecipient {
  readonly key: string;
}

export interface SealedFor {
  readonly runId: string;
  readonly secretName: string;
}

export interface RunSealingPort {
  recipientOf(written: string): SealingRecipient;

  seal(
    value: SecretValue,
    recipient: SealingRecipient,
    sealedFor: SealedFor,
  ): string;
}
