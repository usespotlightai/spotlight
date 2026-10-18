export class RepositoryFileUnwritableError extends Error {
  readonly kind = 'invalid' as const;

  constructor(path: string) {
    super(`File ${path} is a symbolic link. Spotlight edits only plain files.`);
    this.name = 'RepositoryFileUnwritableError';
  }
}
