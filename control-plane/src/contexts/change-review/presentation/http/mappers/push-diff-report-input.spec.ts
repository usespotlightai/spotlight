import {
  pushDiffFailureInput,
  pushDiffInput,
} from '@change-review/presentation/http/mappers/push-diff-report-input';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

describe('pushDiffInput', () => {
  it('takes a diff and a base given as text, an empty diff too', () => {
    expect(pushDiffInput({ diff: '', base: 'abc' })).toEqual({
      diff: '',
      base: 'abc',
    });
  });

  it('turns away a body without a diff or a base as text', () => {
    for (const body of [
      undefined,
      null,
      'diff',
      {},
      { diff: 'x' },
      { base: 'abc' },
      { diff: 1, base: 'abc' },
      { diff: 'x', base: null },
    ]) {
      expect(() => pushDiffInput(body)).toThrow(BadRequestException);
    }
  });
});

describe('pushDiffFailureInput', () => {
  it('takes a reason given as text', () => {
    expect(pushDiffFailureInput({ reason: 'git broke' })).toBe('git broke');
  });

  it('turns away a body without a reason as text', () => {
    for (const body of [undefined, {}, { reason: 3 }]) {
      expect(() => pushDiffFailureInput(body)).toThrow(BadRequestException);
    }
  });
});
