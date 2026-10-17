import { connectionStatusOf } from '@configuration/domain/services/integration-connection-status';
import { describe, expect, it } from 'vitest';

describe('connectionStatusOf', () => {
  it('needs no connection where the integration requires none', () => {
    expect(connectionStatusOf(false, false)).toBe('not-required');
  });

  it('is disconnected where the integration requires a connection and the team has not authorized it', () => {
    expect(connectionStatusOf(true, false)).toBe('disconnected');
  });

  it('is connected once the team has authorized the integration', () => {
    expect(connectionStatusOf(true, true)).toBe('connected');
  });
});
