export class RepositoryFileUnwritableError extends Error {
  readonly violation = 'invalid' as const;

  constructor(path: string) {
    super(
      `${path} is a symbolic link in the repository; Spotlight edits only plain files`,
    );
    this.name = 'RepositoryFileUnwritableError';
  }
}
