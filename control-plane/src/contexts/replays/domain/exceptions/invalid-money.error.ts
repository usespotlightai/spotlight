export class InvalidMoneyError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Money ${reason}.`);
    this.name = 'InvalidMoneyError';
  }
}
