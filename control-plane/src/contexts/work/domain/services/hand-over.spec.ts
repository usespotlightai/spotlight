import {
  handsOverOnEnd,
  handsOverOnWait,
} from '@work/domain/services/hand-over';
import { describe, expect, it } from 'vitest';

describe('handing the work over to people', () => {
  it('hands over each time a run of the line waits for a person', () => {
    expect(handsOverOnWait('line')).toBe(true);
    expect(handsOverOnWait('person')).toBe(false);
  });

  it('hands over at the end of a run of the line whose run hands over', () => {
    expect(handsOverOnEnd('line', true)).toBe(true);
    expect(handsOverOnEnd('line', false)).toBe(false);
    expect(handsOverOnEnd('person', true)).toBe(false);
  });
});
