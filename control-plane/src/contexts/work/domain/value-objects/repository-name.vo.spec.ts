import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { describe, expect, it } from 'vitest';

describe('RepositoryName', () => {
  it('names the repository whose name it is, whoever owns it', () => {
    const name = RepositoryName.of('web');

    expect(name.names(Repository.of('acme/web'))).toBe(true);
    expect(name.names(Repository.of('acme/api'))).toBe(false);
  });

  it('reads a name with a .git ending as the name', () => {
    expect(RepositoryName.of('web.git').equals(RepositoryName.of('web'))).toBe(
      true,
    );
  });

  it('refuses a path, an empty name or a dot segment', () => {
    expect(() => RepositoryName.of('acme/web')).toThrow(InvalidRepositoryError);
    expect(() => RepositoryName.of(' ')).toThrow(InvalidRepositoryError);
    expect(RepositoryName.parsed('..')).toBeNull();
  });
});
