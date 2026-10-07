export class RepositoryFileUnwritableError extends Error {
  readonly violation = 'invalid' as const;

  constructor(path: string) {
    super(`${path} is a symbolic link. Only plain files can be edited.`);
    this.name = 'RepositoryFileUnwritableError';
  }
}
