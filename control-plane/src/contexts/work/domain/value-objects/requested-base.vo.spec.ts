import { Branch } from '@work/domain/value-objects/branch.vo';
import { RequestedBase } from '@work/domain/value-objects/requested-base.vo';
import { describe, expect, it } from 'vitest';

const MAIN = Branch.of('main');
const RELEASE = Branch.of('release/1.x');

describe('RequestedBase', () => {
  it('keeps a base that is not the default branch', () => {
    expect(RequestedBase.of(RELEASE, [MAIN]).taskBase).toEqual(RELEASE);
  });

  it('keeps no base when it is the default branch of every repository', () => {
    expect(RequestedBase.of(MAIN, [MAIN, MAIN]).taskBase).toBeNull();
  });

  it('keeps the base when it is the default branch of only some repositories', () => {
    expect(
      RequestedBase.of(MAIN, [MAIN, Branch.of('master')]).taskBase,
    ).toEqual(MAIN);
  });

  it('keeps the base when no repository is known', () => {
    expect(RequestedBase.of(MAIN, []).taskBase).toEqual(MAIN);
  });
});
