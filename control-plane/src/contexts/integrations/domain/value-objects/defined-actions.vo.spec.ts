import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { describe, expect, it } from 'vitest';

describe('DefinedActions', () => {
  it('hands back an action it defines', () => {
    expect(DefinedActions.of(['post']).named('post', 'schedule')).toBe('post');
  });

  it('refuses one it does not define', () => {
    expect(() =>
      DefinedActions.of(['post']).named('digest', 'schedule'),
    ).toThrow(/names an action "digest" that is not defined/);
  });
});
