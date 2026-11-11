import {
  provisioningOf,
  welcomes,
} from '@work/domain/services/team-provisioning';
import { describe, expect, it } from 'vitest';

describe('team provisioning', () => {
  it('welcomes only a team made at sign-up', () => {
    expect(welcomes('sign-up')).toBe(true);
    expect(welcomes('configuration')).toBe(false);
  });

  it('is pending only while a team made at sign-up waits for its welcome', () => {
    expect(provisioningOf({ origin: 'sign-up', welcomed: false })).toBe(
      'pending',
    );
    expect(provisioningOf({ origin: 'sign-up', welcomed: true })).toBe('done');
    expect(provisioningOf({ origin: 'configuration', welcomed: false })).toBe(
      'done',
    );
  });
});
