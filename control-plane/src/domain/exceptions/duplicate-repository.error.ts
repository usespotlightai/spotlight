export class DuplicateRepositoryError extends Error {
  readonly violation = 'invalid' as const;

  constructor(name: string) {
    super(
      `A line works ${name} twice, and each is cloned into a directory of its own name`,
    );
    this.name = 'DuplicateRepositoryError';
  }
}
