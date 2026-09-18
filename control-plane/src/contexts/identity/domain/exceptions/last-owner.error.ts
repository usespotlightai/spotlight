export class LastOwnerError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super(
      'This workspace would be left with nobody who owns it. Make somebody else an owner first',
    );
    this.name = 'LastOwnerError';
  }
}
