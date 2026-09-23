import { standingOf } from '@configuration/domain/services/integration-standing';
import { describe, expect, it } from 'vitest';

describe('standingOf', () => {
  it('only listens where the host is not linked by authorizing', () => {
    expect(standingOf(false, false)).toBe('listens');
  });

  it('is unlinked where the host links by authorizing and the team has not', () => {
    expect(standingOf(true, false)).toBe('unlinked');
  });

  it('is linked once the team has authorized the host', () => {
    expect(standingOf(true, true)).toBe('linked');
  });
});
