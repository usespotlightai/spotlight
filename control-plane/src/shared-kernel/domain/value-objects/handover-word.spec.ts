import { requestsAPerson } from '@shared-kernel/domain/value-objects/handover-word';
import { describe, expect, it } from 'vitest';

describe('requestsAPerson', () => {
  it('reads review in any case, and no word at all, as a handover to a person', () => {
    expect(requestsAPerson('review')).toBe(true);
    expect(requestsAPerson(' Review ')).toBe(true);
    expect(requestsAPerson('')).toBe(true);
    expect(requestsAPerson(null)).toBe(true);
  });

  it('reads any other word as no handover to a person', () => {
    expect(requestsAPerson('done')).toBe(false);
    expect(requestsAPerson('implementation')).toBe(false);
  });
});
