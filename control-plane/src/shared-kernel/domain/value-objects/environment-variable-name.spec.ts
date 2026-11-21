import { isEnvironmentVariableName } from '@shared-kernel/domain/value-objects/environment-variable-name';
import { describe, expect, it } from 'vitest';

describe('environment variable names', () => {
  it('take letters, digits and underscores, not starting with a digit', () => {
    expect(isEnvironmentVariableName('GITHUB_APP_PRIVATE_KEY')).toBe(true);
    expect(isEnvironmentVariableName('_x1')).toBe(true);
    expect(isEnvironmentVariableName('1X')).toBe(false);
    expect(isEnvironmentVariableName('A-B')).toBe(false);
    expect(isEnvironmentVariableName('')).toBe(false);
  });
});
