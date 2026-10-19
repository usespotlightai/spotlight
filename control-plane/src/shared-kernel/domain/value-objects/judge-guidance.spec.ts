import {
  judgeGuidanceOf,
  MAX_GUIDANCE_LENGTH,
} from '@shared-kernel/domain/value-objects/judge-guidance';
import { describe, expect, it } from 'vitest';

describe('judgeGuidanceOf', () => {
  it('keeps one sentence, trimmed', () => {
    expect(judgeGuidanceOf('  Retry failed uploads.  ')).toBe(
      'Retry failed uploads.',
    );
  });

  it('keeps nothing that is missing, empty, over the length limit or on several lines', () => {
    expect(judgeGuidanceOf(undefined)).toBeNull();
    expect(judgeGuidanceOf(null)).toBeNull();
    expect(judgeGuidanceOf('   ')).toBeNull();
    expect(judgeGuidanceOf('a'.repeat(MAX_GUIDANCE_LENGTH))).toHaveLength(
      MAX_GUIDANCE_LENGTH,
    );
    expect(judgeGuidanceOf('a'.repeat(MAX_GUIDANCE_LENGTH + 1))).toBeNull();
    expect(judgeGuidanceOf('Retry.\nThen test.')).toBeNull();
  });
});
