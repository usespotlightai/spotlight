import { InvalidRepositoryError } from '@domain/exceptions/invalid-repository.error';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

describe('Repository', () => {
  it('takes the owner and the name GitHub knows it by', () => {
    const repository = Repository.of('usespotlightai/spotlight');

    expect(repository.owner).toBe('usespotlightai');
    expect(repository.name).toBe('spotlight');
    expect(repository.value).toBe('usespotlightai/spotlight');
  });

  it('drops the suffix a clone URL carries', () => {
    expect(Repository.of('acme/widgets.git').value).toBe('acme/widgets');
  });

  // The name reaches a URL the control plane builds, so anything that could
  // steer that URL somewhere else is refused here rather than escaped later.
  it('refuses what is not one repository', () => {
    for (const raw of [
      'spotlight',
      'acme/widgets/extra',
      '/widgets',
      'acme/',
      'acme/../secrets',
      'acme/wid gets',
      'acme/wid?gets',
      '',
    ]) {
      expect(() => Repository.of(raw)).toThrow(InvalidRepositoryError);
    }
  });

  it('is the same repository whatever the spacing', () => {
    expect(
      Repository.of('  acme/widgets  ').equals(Repository.of('acme/widgets')),
    ).toBe(true);
  });
});
