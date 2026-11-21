import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RUNNER_SET_VARIABLES,
  RUNNER_VARIABLE_PREFIX,
} from '@runs/domain/value-objects/runner-set-variables';
import { describe, expect, it } from 'vitest';

const SHARED = join(
  __dirname,
  '../../../../../../data-plane/protocol/testdata/runner-set-variables.json',
);

describe('the variables the runner sets', () => {
  it('are the ones the control plane keeps secrets out of, as the runner lists them', () => {
    const shared = JSON.parse(readFileSync(SHARED, 'utf8')) as {
      variables: string[];
      prefix: string;
    };

    expect(RUNNER_SET_VARIABLES).toEqual(shared.variables);
    expect(RUNNER_VARIABLE_PREFIX).toBe(shared.prefix);
  });
});
