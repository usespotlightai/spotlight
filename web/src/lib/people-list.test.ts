import { describe, expect, it } from 'vitest';
import { namesOf } from '@/lib/people-list';

describe('namesOf', () => {
  it('names one, two or more people in a sentence', () => {
    expect(namesOf([{ name: 'Anna' }])).toBe('Anna');
    expect(namesOf([{ name: 'Anna' }, { name: 'Ben' }])).toBe('Anna and Ben');
    expect(namesOf([{ name: 'Anna' }, { name: 'Ben' }, { name: 'Cy' }])).toBe(
      'Anna, Ben and Cy',
    );
  });

  it('calls a person without a name someone', () => {
    expect(namesOf([{ name: ' ' }])).toBe('Someone');
  });
});
