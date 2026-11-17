import { passesOn } from '@insights/domain/value-objects/label-source';
import { describe, expect, it } from 'vitest';

describe('passesOn', () => {
  it('passes the run where people accepted it or merged its pull request', () => {
    expect(passesOn('accepted')).toBe(true);
    expect(passesOn('merged')).toBe(true);
    expect(passesOn('sent-back')).toBe(false);
    expect(passesOn('held')).toBe(false);
  });
});
