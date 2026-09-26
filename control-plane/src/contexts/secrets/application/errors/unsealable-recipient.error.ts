export class UnsealableRecipientError extends Error {
  readonly violation = 'invalid' as const;

  constructor() {
    super(
      'The recipient is not an X25519 public key: 32 bytes, written in base64',
    );
    this.name = 'UnsealableRecipientError';
  }
}
