import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { DuplicateRepositoryError } from '@work/domain/exceptions/duplicate-repository.error';
import { MixedRunnerImagesError } from '@work/domain/exceptions/mixed-runner-images.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it } from 'vitest';

const of = (...named: string[]) =>
  LineRepositories.of(
    named.map((each) => WorkedRepository.of(Repository.of(each))),
  );

const worked = (name: string, image?: string, setup?: string) =>
  WorkedRepository.of(Repository.of(name), {
    image: image ? RunnerImage.of(image) : null,
    setup: setup ? RepositorySetup.of(setup) : null,
  });

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

  it('runs in no image when no repository names one', () => {
    expect(of('acme/api', 'acme/web').image).toBeNull();
  });

  it('runs in the one image its repositories name', () => {
    const repositories = LineRepositories.of([
      worked('acme/api', 'ghcr.io/acme/app:1'),
      worked('acme/web'),
      worked('acme/docs', 'ghcr.io/acme/app:1'),
    ]);

    expect(repositories.image?.value).toBe('ghcr.io/acme/app:1');
  });

  it('refuses repositories naming different images', () => {
    expect(() =>
      LineRepositories.of([
        worked('acme/api', 'ghcr.io/acme/api:1'),
        worked('acme/web', 'ghcr.io/acme/web:1'),
      ]),
    ).toThrow(MixedRunnerImagesError);
  });

  it('knows the setup of each repository, or none', () => {
    const repositories = LineRepositories.of([
      worked('acme/api', undefined, 'npm ci'),
      worked('acme/web'),
    ]);

    expect(repositories.setupOf(Repository.of('acme/api'))?.value).toBe(
      'npm ci',
    );
    expect(repositories.setupOf(Repository.of('acme/web'))).toBeNull();
    expect(repositories.setupOf(Repository.of('acme/docs'))).toBeNull();
  });

  it('equals repositories worked alike, whatever their order', () => {
    const repositories = LineRepositories.of([
      worked('acme/api', 'ghcr.io/acme/app:1', 'npm ci'),
      worked('acme/web'),
    ]);

    expect(
      repositories.equals(
        LineRepositories.of([
          worked('acme/web'),
          worked('acme/api', 'ghcr.io/acme/app:1', 'npm ci'),
        ]),
      ),
    ).toBe(true);
    expect(
      repositories.equals(
        LineRepositories.of([
          worked('acme/api', 'ghcr.io/acme/app:1', 'pnpm install'),
          worked('acme/web'),
        ]),
      ),
    ).toBe(false);
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
        /Please name one/,
      );
    });

    it('refuses a name the line does not work', () => {
      expect(() => of('acme/api').opening('web')).toThrow(
        /no repository named web/,
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
      expect(message).toMatch(/Please name one/);
    });
  });
});
