export class LastOwnerError extends Error {
  readonly violation = 'conflict' as const;

  constructor() {
    super(
      'The workspace needs at least one owner. Please make someone else an owner first.',
    );
    this.name = 'LastOwnerError';
  }
}
