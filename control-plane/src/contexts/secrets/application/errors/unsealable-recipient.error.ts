export class UnsealableRecipientError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'Recipient is not an X25519 public key. Expected: 32 bytes in base64',
    );
    this.name = 'UnsealableRecipientError';
  }
}
