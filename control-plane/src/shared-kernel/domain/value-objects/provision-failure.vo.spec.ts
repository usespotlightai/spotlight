import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  PROVISION_FAILURES,
  ProvisionFailure,
} from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { describe, expect, it } from 'vitest';

describe('ProvisionFailure', () => {
  it.each([
    ['unreachable', true],
    ['http-error', true],
    ['lapsed', true],
    ['not-allowed', false],
    ['unusable', false],
    ['harness-missing', false],
  ])('states whether a %s failure may be retried (%s)', (kind, retries) => {
    expect(ProvisionFailure.of(kind, 'why').retry.retries).toBe(retries);
  });

  it('knows no kind it does not state a retry for', () => {
    expect(Object.keys(PROVISION_FAILURES).sort()).toEqual(
      [
        'harness-missing',
        'lapsed',
        'not-allowed',
        'http-error',
        'unreachable',
        'unusable',
      ].sort(),
    );
  });

  it('says what kind of failure it was and why', () => {
    expect(
      ProvisionFailure.of('unreachable', 'connection refused').saying,
    ).toBe('unreachable: connection refused');
  });

  it('rejects a kind it does not know', () => {
    expect(() => ProvisionFailure.of('exploded', 'boom')).toThrow(
      InconsistentStateError,
    );
  });

  it('trims its detail and keeps no more than a thousand characters of it', () => {
    expect(ProvisionFailure.of('http-error', '  no room  ').detail).toBe(
      'no room',
    );
    expect(
      ProvisionFailure.of('http-error', 'x'.repeat(1_500)).detail,
    ).toHaveLength(1_000);
  });

  it('says when a reservation lapsed without a claim', () => {
    const lapsed = ProvisionFailure.lapsed(
      new Date('2026-09-24T12:05:00.000Z'),
    );

    expect(lapsed.kind).toBe('lapsed');
    expect(lapsed.detail).toBe(
      'The pool accepted the work. No runner claimed it by 2026-09-24T12:05:00.000Z.',
    );
  });

  it('names the harness a provisioned runner was missing', () => {
    const missing = ProvisionFailure.harnessMissing('claude-code');

    expect(missing.kind).toBe('harness-missing');
    expect(missing.detail).toContain('claude-code');
  });

  it('equals another of the same kind and detail', () => {
    expect(
      ProvisionFailure.of('http-error', 'full').equals(
        ProvisionFailure.of('http-error', 'full'),
      ),
    ).toBe(true);
    expect(
      ProvisionFailure.of('http-error', 'full').equals(
        ProvisionFailure.of('unreachable', 'full'),
      ),
    ).toBe(false);
  });
});
