import { editsInput } from '@work/presentation/http/mappers/edits-input';
import { describe, expect, it } from 'vitest';

describe('editsInput', () => {
  it('reads what the person changed by input name', () => {
    expect(
      editsInput([
        { name: 'issue', value: 'ENG-12' },
        { name: 'body', value: 'Fixed in #41.' },
      ]),
    ).toEqual({ issue: 'ENG-12', body: 'Fixed in #41.' });
  });

  it('reads no changes where none were sent', () => {
    expect(editsInput(undefined)).toBeNull();
    expect(editsInput([])).toBeNull();
  });

  it('leaves out what is not a name and a text value, for the task to reject', () => {
    expect(
      editsInput([{ name: 'limit', value: 100 }, 'body', { name: 'queue' }]),
    ).toEqual({});
  });
});
