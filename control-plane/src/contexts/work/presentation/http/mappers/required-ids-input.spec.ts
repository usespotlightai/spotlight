import { BadRequestException } from '@nestjs/common';
import { requiredIdsInput } from '@work/presentation/http/mappers/required-ids-input';
import { describe, expect, it } from 'vitest';

describe('requiredIdsInput', () => {
  it('takes a list of ids, an empty one too', () => {
    expect(requiredIdsInput(['task_1'], 'blockedBy')).toEqual(['task_1']);
    expect(requiredIdsInput([], 'blockedBy')).toEqual([]);
  });

  it('refuses anything else, so a bad body never clears the list', () => {
    for (const bad of [undefined, null, 'task_1', [1], [null]]) {
      expect(() => requiredIdsInput(bad, 'blockedBy')).toThrow(
        BadRequestException,
      );
    }
  });
});
