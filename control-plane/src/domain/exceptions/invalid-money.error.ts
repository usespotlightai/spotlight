export class InvalidMoneyError extends Error {
  constructor(reason: string) {
    super(`Money ${reason}`);
    this.name = 'InvalidMoneyError';
  }
}
