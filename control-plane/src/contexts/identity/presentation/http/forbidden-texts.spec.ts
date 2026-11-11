import { FORBIDDEN_TEXTS } from '@identity/presentation/http/forbidden-texts';
import { ForbiddenActs } from '@platform/http/resources/forbidden-acts';
import { describe, expect, it } from 'vitest';

const registered = (): ForbiddenActs => {
  const acts = new ForbiddenActs();
  acts.register(FORBIDDEN_TEXTS);
  return acts;
};

describe('FORBIDDEN_TEXTS', () => {
  it('names every permission a request can lack, in the order the API lists them', () => {
    expect(registered().acts).toEqual([
      'configure',
      'secrets',
      'runners',
      'trusts',
      'administer',
      'create-workspaces',
      'plan',
    ]);
  });

  it.each([
    ['configure', 'Not allowed to change the secret'],
    ['secrets', 'Not allowed to change the secret'],
    ['runners', 'Not allowed to change the secret'],
    ['trusts', 'Not allowed to change the secret'],
    ['administer', 'Not allowed to administer the secret'],
  ])('titles a request that lacks %s', (act, title) => {
    expect(registered().textOf(act, 'secret')?.[0]).toBe(title);
  });

  it('says a token can neither create a workspace nor administer one', () => {
    expect(
      registered().textOf('create-workspaces', 'workspace')?.[1],
    ).toContain('A workspace token cannot create a workspace');
    expect(registered().textOf('administer', 'workspace')?.[1]).toContain(
      'A token can never administer',
    );
  });
});
