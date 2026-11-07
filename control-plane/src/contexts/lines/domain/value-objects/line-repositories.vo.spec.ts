import { DuplicateRepositoryError } from '@lines/domain/exceptions/duplicate-repository.error';
import { MixedRunnerImagesError } from '@lines/domain/exceptions/mixed-runner-images.error';
import { LineRepositories } from '@lines/domain/value-objects/line-repositories.vo';
import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it } from 'vitest';

const of = (...named: string[]) =>
  LineRepositories.of(
    named.map((each) => LineRepositoryConfig.of(Repository.of(each))),
  );

const repositoryConfig = (name: string, image?: string, setup?: string) =>
  LineRepositoryConfig.of(Repository.of(name), {
    image: image ? RunnerImage.of(image) : null,
    setup: setup ? RepositorySetup.of(setup) : null,
  });

describe('LineRepositories', () => {
  it('keeps the repositories it is given', () => {
    expect(
      of('acme/api', 'acme/web').entries.map((each) => each.repository.value),
    ).toEqual(['acme/api', 'acme/web']);
  });

  it('rejects two repositories that share a name', () => {
    expect(() => of('acme/api', 'other/api')).toThrow(DuplicateRepositoryError);
  });

  it('runs in no image when no repository names one', () => {
    expect(of('acme/api', 'acme/web').image).toBeNull();
  });

  it('runs in the one image its repositories name', () => {
    const repositories = LineRepositories.of([
      repositoryConfig('acme/api', 'ghcr.io/acme/app:1'),
      repositoryConfig('acme/web'),
      repositoryConfig('acme/docs', 'ghcr.io/acme/app:1'),
    ]);

    expect(repositories.image?.value).toBe('ghcr.io/acme/app:1');
  });

  it('rejects repositories naming different images', () => {
    expect(() =>
      LineRepositories.of([
        repositoryConfig('acme/api', 'ghcr.io/acme/api:1'),
        repositoryConfig('acme/web', 'ghcr.io/acme/web:1'),
      ]),
    ).toThrow(MixedRunnerImagesError);
  });

  it('knows the setup of each repository, or none', () => {
    const repositories = LineRepositories.of([
      repositoryConfig('acme/api', undefined, 'npm ci'),
      repositoryConfig('acme/web'),
    ]);

    expect(
      repositories.entries.map((each) => [
        each.repository.value,
        each.setup?.value ?? null,
      ]),
    ).toEqual([
      ['acme/api', 'npm ci'],
      ['acme/web', null],
    ]);
  });

  it('equals repositories worked alike, whatever their order', () => {
    const repositories = LineRepositories.of([
      repositoryConfig('acme/api', 'ghcr.io/acme/app:1', 'npm ci'),
      repositoryConfig('acme/web'),
    ]);

    expect(
      repositories.equals(
        LineRepositories.of([
          repositoryConfig('acme/web'),
          repositoryConfig('acme/api', 'ghcr.io/acme/app:1', 'npm ci'),
        ]),
      ),
    ).toBe(true);
    expect(
      repositories.equals(
        LineRepositories.of([
          repositoryConfig('acme/api', 'ghcr.io/acme/app:1', 'pnpm install'),
          repositoryConfig('acme/web'),
        ]),
      ),
    ).toBe(false);
  });
});
