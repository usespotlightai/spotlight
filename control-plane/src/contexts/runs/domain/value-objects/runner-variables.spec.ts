import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isRunnerVariable,
  RUNNER_VARIABLE_PREFIX,
  RUNNER_VARIABLES,
} from '@runs/domain/value-objects/runner-variables';
import { ENVIRONMENT_VARIABLE_NAME } from '@shared-kernel/domain/value-objects/environment-variable-name';
import { describe, expect, it } from 'vitest';

const SHARED = join(
  __dirname,
  '../../../../../../data-plane/protocol/testdata/sandbox-env.json',
);

describe('the variables the runner sets', () => {
  it('are the ones the runner lists, named by the rule the runner checks', () => {
    const shared = JSON.parse(readFileSync(SHARED, 'utf8')) as {
      variables: string[];
      prefix: string;
      namePattern: string;
    };

    expect(RUNNER_VARIABLES).toEqual(shared.variables);
    expect(RUNNER_VARIABLE_PREFIX).toBe(shared.prefix);
    expect(ENVIRONMENT_VARIABLE_NAME.source).toBe(shared.namePattern);
  });

  it('include a variable in any case, and every SPOTLIGHT_ variable', () => {
    for (const variable of [
      'PATH',
      'path',
      'https_proxy',
      'User',
      'Spotlight_Run_Token',
    ]) {
      expect(isRunnerVariable(variable)).toBe(true);
    }

    for (const variable of [
      'GITHUB_APP_PRIVATE_KEY',
      'PATHS',
      'MY_SPOTLIGHT_KEY',
    ]) {
      expect(isRunnerVariable(variable)).toBe(false);
    }
  });
});
