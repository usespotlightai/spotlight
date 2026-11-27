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

interface SharedVariables {
  readonly variables: readonly string[];
  readonly prefix: string;
  readonly namePattern: string;
}

const isSharedVariables = (value: unknown): value is SharedVariables =>
  typeof value === 'object' &&
  value !== null &&
  'variables' in value &&
  Array.isArray(value.variables) &&
  value.variables.every((each) => typeof each === 'string') &&
  'prefix' in value &&
  typeof value.prefix === 'string' &&
  'namePattern' in value &&
  typeof value.namePattern === 'string';

describe('the variables the runner sets', () => {
  it('are the ones the runner lists, named by the rule the runner checks', () => {
    const shared: unknown = JSON.parse(readFileSync(SHARED, 'utf8'));

    if (!isSharedVariables(shared)) {
      throw new Error(`${SHARED} does not list the variables`);
    }

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
