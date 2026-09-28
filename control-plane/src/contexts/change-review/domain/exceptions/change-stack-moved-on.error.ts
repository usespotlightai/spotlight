export class ChangeStackMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This change stack changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'ChangeStackMovedOnError';
  }
}
