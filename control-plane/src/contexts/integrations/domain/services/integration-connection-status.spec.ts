import {
  connectionProblemOf,
  connectionStatusOf,
} from '@integrations/domain/services/integration-connection-status';
import { describe, expect, it } from 'vitest';

const AUTHORIZED = { refreshFailedAt: null, client: 'client_1' };

const FAILED = {
  refreshFailedAt: new Date('2026-11-07T10:00:00.000Z'),
  client: 'client_1',
};

describe('connectionStatusOf', () => {
  it('needs no connection where the integration requires none', () => {
    expect(connectionStatusOf(false, null, null)).toBe('not-required');
  });

  it('is disconnected where the integration requires a connection and the team has not authorized it', () => {
    expect(connectionStatusOf(true, null, null)).toBe('disconnected');
  });

  it('is connected once the team has authorized the integration', () => {
    expect(connectionStatusOf(true, AUTHORIZED, null)).toBe('connected');
    expect(connectionStatusOf(true, AUTHORIZED, 'client_1')).toBe('connected');
  });

  it('is disconnected once its refresh failed, as no call can use it', () => {
    expect(connectionStatusOf(true, FAILED, null)).toBe('disconnected');
  });

  it('is disconnected where the definition names another OAuth client than the one it was made through', () => {
    expect(connectionStatusOf(true, AUTHORIZED, 'client_2')).toBe(
      'disconnected',
    );
  });
});

describe('connectionProblemOf', () => {
  it('names no problem while there is no connection, or while it works', () => {
    expect(connectionProblemOf(true, null, 'client_1')).toBeNull();
    expect(connectionProblemOf(true, AUTHORIZED, 'client_1')).toBeNull();
  });

  it('says the connection was made through another OAuth client, before a failed refresh', () => {
    expect(connectionProblemOf(true, FAILED, 'client_2')).toBe('other-client');
  });

  it('names no problem where the integration requires no connection', () => {
    expect(connectionProblemOf(false, FAILED, 'client_2')).toBeNull();
  });

  it('says its refresh failed', () => {
    expect(connectionProblemOf(true, FAILED, null)).toBe('refresh-failed');
  });
});
