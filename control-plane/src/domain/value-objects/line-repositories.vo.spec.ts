import { DuplicateRepositoryError } from '@domain/exceptions/duplicate-repository.error';
import { NoRepositoryError } from '@domain/exceptions/no-repository.error';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const of = (...named: string[]) =>
  LineRepositories.of(named.map((each) => Repository.of(each)));

describe('LineRepositories', () => {
  it('holds the repositories it is given', () => {
    expect(of('acme/api', 'acme/web').all.map((each) => each.value)).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });

  it('refuses two repositories that share a name', () => {
    expect(() => of('acme/api', 'other/api')).toThrow(DuplicateRepositoryError);
  });

  it('finds a repository by name, or nothing', () => {
    const repositories = of('acme/api');

    expect(repositories.named('api')?.value).toBe('acme/api');
    expect(repositories.named('web')).toBeNull();
  });

  describe('the repository a pull request opens against', () => {
    it('is the only one, where the line works one', () => {
      expect(of('acme/api').opening(null).value).toBe('acme/api');
    });

    it('is the one the agent names, where the line works several', () => {
      expect(of('acme/api', 'acme/web').opening('web').value).toBe('acme/web');
    });

    it('refuses where several are worked and none is named', () => {
      expect(() => of('acme/api', 'acme/web').opening(null)).toThrow(
        /name which one/,
      );
    });

    it('refuses a name the line does not work', () => {
      expect(() => of('acme/api').opening('web')).toThrow(
        /no repository named "web"/,
      );
    });

    it('refuses where the line works none', () => {
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
      expect(message).toMatch(/name which one/);
    });
  });
});
