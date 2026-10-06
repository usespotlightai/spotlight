export class DuplicateRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(name: string) {
    super(
      `Repository ${name} is listed twice. Each repository is cloned into a directory of its own name.`,
    );
    this.name = 'DuplicateRepositoryError';
  }
}
