import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { lineRepositoryOf } from '@change-review/domain/services/line-repository';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

describe('lineRepositoryOf', () => {
  it('finds the repository of a name, ignoring case', () => {
    expect(lineRepositoryOf([API, WEB], 'WEB')).toBe(WEB);
  });

  it('takes the only repository of a line when the name is null', () => {
    expect(lineRepositoryOf([API], null)).toBe(API);
  });

  it('refuses a null name when the line has several repositories', () => {
    expect(() => lineRepositoryOf([API, WEB], null)).toThrow(
      InvalidChangeStackError,
    );
  });

  it('refuses a null name when the line has no repository', () => {
    expect(() => lineRepositoryOf([], null)).toThrow(InvalidChangeStackError);
  });

  it('refuses a name the line does not have', () => {
    expect(() => lineRepositoryOf([API], 'web')).toThrow(
      InvalidChangeStackError,
    );
  });
});
