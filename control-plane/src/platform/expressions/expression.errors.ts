export class ExpressionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(source: string, reason: string) {
    super(`${source}: ${reason}`);
    this.name = 'ExpressionError';
  }
}

export class ExpressionFailedError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly location: string | null,
    readonly source: string,
    readonly reason: string,
  ) {
    super(`${location ?? source}: ${reason}`);
    this.name = 'ExpressionFailedError';
  }
}

export const firstLine = (error: unknown, otherwise: string): string =>
  error instanceof Error
    ? (error.message.split('\n')[0] ?? otherwise)
    : otherwise;
