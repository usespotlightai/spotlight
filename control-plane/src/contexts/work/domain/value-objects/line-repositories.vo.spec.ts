import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { describe, expect, it } from 'vitest';

const of = (...named: string[]) =>
  LineRepositories.of(
    named.map((each) => ({ repository: Repository.of(each), setup: null })),
    null,
  );

describe('LineRepositories', () => {
  it('finds a repository by name, or nothing', () => {
    const repositories = of('acme/api');

    expect(repositories.named(RepositoryName.of('api'))?.value).toBe(
      'acme/api',
    );
    expect(repositories.named(RepositoryName.of('web'))).toBeNull();
  });

  describe('the repository a pull request opens against', () => {
    it('is the only one, where the line works one', () => {
      expect(of('acme/api').opening(null).value).toBe('acme/api');
    });

    it('is the one the agent names, where the line works several', () => {
      expect(
        of('acme/api', 'acme/web').opening(RepositoryName.of('web')).value,
      ).toBe('acme/web');
    });

    it('rejects where several are worked and none is named', () => {
      expect(() => of('acme/api', 'acme/web').opening(null)).toThrow(
        /Please name one/,
      );
    });

    it('rejects a name the line does not work', () => {
      expect(() => of('acme/api').opening(RepositoryName.of('web'))).toThrow(
        /no repository named web/,
      );
    });

    it('rejects where the line works none', () => {
      expect(() => LineRepositories.none().opening(null)).toThrow(
        NoRepositoryError,
      );
    });

    it('says nothing of any CLI flag', () => {
      let message = '';
      try {
        of('acme/api', 'acme/web').opening(null);
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).not.toContain('--repository');
      expect(message).toMatch(/Please name one/);
    });
  });
});
