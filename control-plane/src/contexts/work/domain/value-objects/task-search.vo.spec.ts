import { InvalidTaskSearchError } from '@work/domain/exceptions/invalid-task-search.error';
import { TaskSearch } from '@work/domain/value-objects/task-search.vo';
import { describe, expect, it } from 'vitest';

describe('TaskSearch', () => {
  it('takes each word once, in lower case', () => {
    expect(TaskSearch.of('  Scaffold  the scaffold ').words).toEqual([
      'scaffold',
      'the',
    ]);
  });

  it('rejects an empty search', () => {
    expect(() => TaskSearch.of('   ')).toThrow(InvalidTaskSearchError);
  });

  it('rejects one longer than it allows', () => {
    expect(() => TaskSearch.of('x'.repeat(201))).toThrow(
      InvalidTaskSearchError,
    );
  });
});
