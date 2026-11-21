import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SANDBOX_VALUE_MIN_LENGTH } from '@secrets/domain/value-objects/secret-sandbox.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { describe, expect, it } from 'vitest';

const shared = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../../../data-plane/protocol/testdata/sandbox-env.json',
    ),
    'utf8',
  ),
) as {
  minLength: number;
  values: readonly { value: string; fits: boolean }[];
};

describe('a value a run gets in its sandbox', () => {
  it('is as long as the runner asks', () => {
    expect(SANDBOX_VALUE_MIN_LENGTH).toBe(shared.minLength);
  });

  it.each(shared.values)(
    'fits the sandbox as the runner says for $value',
    ({ value, fits }) => {
      expect(SecretValue.of(value).fitsSandbox).toBe(fits);
    },
  );
});
