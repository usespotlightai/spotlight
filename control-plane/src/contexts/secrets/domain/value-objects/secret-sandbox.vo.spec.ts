import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SANDBOX_VALUE_MIN_LENGTH } from '@secrets/domain/value-objects/secret-sandbox.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { describe, expect, it } from 'vitest';

interface Shared {
  readonly minLength: number;
  readonly values: readonly { value: string; fits: boolean }[];
}

const isSample = (each: unknown): each is { value: string; fits: boolean } =>
  typeof each === 'object' &&
  each !== null &&
  'value' in each &&
  typeof each.value === 'string' &&
  'fits' in each &&
  typeof each.fits === 'boolean';

const isShared = (value: unknown): value is Shared => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const values: unknown = 'values' in value ? value.values : undefined;

  return (
    'minLength' in value &&
    typeof value.minLength === 'number' &&
    Array.isArray(values) &&
    values.every((each: unknown) => isSample(each))
  );
};

const written: unknown = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../../../data-plane/protocol/testdata/sandbox-env.json',
    ),
    'utf8',
  ),
);

if (!isShared(written)) {
  throw new Error('expected the shared sandbox-env samples');
}

const shared = written;

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
