import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { MAX_CHECK_COMMAND } from '@change-review/domain/value-objects/stack-check.vo';
import { describe, expect, it } from 'vitest';

describe('CheckRequest', () => {
  it('keeps a check and setup of many lines', () => {
    const request = CheckRequest.of(
      'set -e\nnpm run lint\nnpm test\n',
      'npm ci\nnpm run build',
    );

    expect(request.command).toBe('set -e\nnpm run lint\nnpm test');
    expect(request.setup).toBe('npm ci\nnpm run build');
  });

  it('refuses an empty check', () => {
    expect(() => CheckRequest.of(' \n', null)).toThrow(InvalidChangeStackError);
  });

  it('refuses a check or setup longer than the limit', () => {
    const tooLong = 'x'.repeat(MAX_CHECK_COMMAND + 1);

    expect(() => CheckRequest.of(tooLong, null)).toThrow(
      `check command must not be empty and must be at most ${MAX_CHECK_COMMAND} characters`,
    );
    expect(() => CheckRequest.of('npm test', tooLong)).toThrow(
      `setup command must not be empty and must be at most ${MAX_CHECK_COMMAND} characters`,
    );
  });
});
