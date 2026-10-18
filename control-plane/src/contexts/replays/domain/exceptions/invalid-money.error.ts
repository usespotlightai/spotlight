export class InvalidMoneyError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Money ${reason}.`);
    this.name = 'InvalidMoneyError';
  }
}
