import {
  deferralIn,
  deferralWaitingIn,
} from '@work/domain/services/deferred-moves';
import { describe, expect, it } from 'vitest';

const message = (to: string | null) => ({
  kind: 'message' as const,
  approval: null,
  deferredMove: to ? { to } : null,
});
const passed = { kind: 'passed' as const, approval: null, deferredMove: null };
const asked = { kind: 'asked' as const, approval: null, deferredMove: null };
const approvalAsked = {
  kind: 'asked' as const,
  approval: { askedOf: null },
  deferredMove: null,
};

describe('deferred moves', () => {
  it('waits on the newest deferral', () => {
    const newest = message('station_review');

    expect(deferralIn([message('station_build'), newest, message(null)])).toBe(
      newest,
    );
  });

  it('is dropped by a later pass, or by a later question that asks no approval', () => {
    expect(deferralIn([message('station_review'), passed])).toBeNull();
    expect(deferralIn([message('station_review'), asked])).toBeNull();
  });

  it('still waits after a run asks for an approval', () => {
    const waiting = message('station_review');

    expect(deferralIn([waiting, approvalAsked])).toBe(waiting);
  });

  it('waits only while the task has a run', () => {
    const waiting = message('station_review');

    expect(deferralWaitingIn([waiting], true)).toBe(waiting);
    expect(deferralWaitingIn([waiting], false)).toBeNull();
  });
});
