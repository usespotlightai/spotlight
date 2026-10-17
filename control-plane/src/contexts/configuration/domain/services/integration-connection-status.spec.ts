import { connectionStatusOf } from '@configuration/domain/services/integration-connection-status';
import { describe, expect, it } from 'vitest';

describe('connectionStatusOf', () => {
  it('only listens where the host is not linked by authorizing', () => {
    expect(connectionStatusOf(false, false)).toBe('listens');
  });

  it('is unlinked where the host links by authorizing and the team has not', () => {
    expect(connectionStatusOf(true, false)).toBe('unlinked');
  });

  it('is linked once the team has authorized the host', () => {
    expect(connectionStatusOf(true, true)).toBe('linked');
  });
});
