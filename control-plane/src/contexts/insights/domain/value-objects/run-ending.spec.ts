import { leftWork } from '@insights/domain/value-objects/run-ending';
import { describe, expect, it } from 'vitest';

describe('leftWork', () => {
  it.each([
    ['completed', true],
    ['stopped', true],
    ['failed', false],
    ['exhausted', false],
    ['superseded', false],
    ['cancelled', false],
  ] as const)(
    'says whether a run that ended %s left work: %s',
    (ending, judged) => {
      expect(leftWork(ending)).toBe(judged);
    },
  );
});
