export class UnknownLabelError extends Error {
  readonly violation = 'not-found' as const;

  constructor(labelId: string) {
    super(`There is no label ${labelId}`);
    this.name = 'UnknownLabelError';
  }
}
