import { isSetByTheRunner } from '@runs/domain/value-objects/runner-set-variables';
import { describe, expect, it } from 'vitest';

describe('the variables the runner sets', () => {
  it('include a variable in any case, and every SPOTLIGHT_ variable', () => {
    for (const variable of [
      'PATH',
      'path',
      'https_proxy',
      'User',
      'Spotlight_Run_Token',
    ]) {
      expect(isSetByTheRunner(variable)).toBe(true);
    }

    for (const variable of [
      'GITHUB_APP_PRIVATE_KEY',
      'PATHS',
      'MY_SPOTLIGHT_KEY',
    ]) {
      expect(isSetByTheRunner(variable)).toBe(false);
    }
  });
});
