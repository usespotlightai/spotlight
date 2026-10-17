import { givenEdits } from '@work/presentation/http/mappers/given-edits';
import { describe, expect, it } from 'vitest';

describe('givenEdits', () => {
  it('reads what the person changed by input name', () => {
    expect(
      givenEdits([
        { name: 'issue', value: 'ENG-12' },
        { name: 'body', value: 'Fixed in #41.' },
      ]),
    ).toEqual({ issue: 'ENG-12', body: 'Fixed in #41.' });
  });

  it('reads no changes where none were sent', () => {
    expect(givenEdits(undefined)).toBeNull();
    expect(givenEdits([])).toBeNull();
  });

  it('leaves out what is not a name and a text value, for the task to reject', () => {
    expect(
      givenEdits([{ name: 'limit', value: 100 }, 'body', { name: 'queue' }]),
    ).toEqual({});
  });
});
