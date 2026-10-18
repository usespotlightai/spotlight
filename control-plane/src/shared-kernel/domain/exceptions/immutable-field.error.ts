export class ImmutableFieldError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImmutableFieldError';
  }
}
