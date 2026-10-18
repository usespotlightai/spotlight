export class InvalidRecipientError extends Error {
  readonly kind = 'invalid' as const;

  constructor() {
    super(
      'Recipient is not an X25519 public key. Expected: 32 bytes in base64',
    );
    this.name = 'InvalidRecipientError';
  }
}
