import { connectionStatusOf } from '@integrations/domain/services/integration-connection-status';
import { describe, expect, it } from 'vitest';

const AUTHORIZED = { refreshFailedAt: null };

describe('connectionStatusOf', () => {
  it('needs no connection where the integration requires none', () => {
    expect(connectionStatusOf(false, null)).toBe('not-required');
  });

  it('is disconnected where the integration requires a connection and the team has not authorized it', () => {
    expect(connectionStatusOf(true, null)).toBe('disconnected');
  });

  it('is connected once the team has authorized the integration', () => {
    expect(connectionStatusOf(true, AUTHORIZED)).toBe('connected');
  });

  it('is disconnected once its refresh failed, as no call can use it', () => {
    expect(
      connectionStatusOf(true, {
        refreshFailedAt: new Date('2026-11-07T10:00:00.000Z'),
      }),
    ).toBe('disconnected');
  });
});
