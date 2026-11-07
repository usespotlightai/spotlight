import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class RepositoryFileUnwritableError extends ApplicationError {
  readonly kind = 'invalid' as const;

  constructor(path: string) {
    super(`File ${path} is a symbolic link. Spotlight edits only plain files.`);
    this.name = 'RepositoryFileUnwritableError';
  }
}
