import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import { RunChecks } from '@insights/domain/value-objects/run-checks.vo';
import { describe, expect, it } from 'vitest';

const checkOf = (
  verdict: CheckVerdict,
  stackStartedAt: string,
  repository: string | null = 'api',
  checkedAt: string = stackStartedAt,
) => ({
  repository,
  stackStartedAt: new Date(stackStartedAt),
  verdict,
  checkedAt: new Date(checkedAt),
});

describe('RunChecks', () => {
  it('has no verdict before a check', () => {
    expect(RunChecks.NONE.verdict).toBeNull();
    expect(RunChecks.NONE.checkedAt).toBeNull();
  });

  it('keeps the verdict of the latest handover, not the first one', () => {
    const checks = RunChecks.NONE.checked(
      checkOf('failed', '2026-09-30T10:00:00Z'),
    ).checked(checkOf('passed', '2026-09-30T11:00:00Z'));

    expect(checks.verdict).toBe('passed');
    expect(checks.checkedAt).toEqual(new Date('2026-09-30T11:00:00Z'));
  });

  it('ignores a check of an older handover that arrives late', () => {
    const checks = RunChecks.NONE.checked(
      checkOf('passed', '2026-09-30T11:00:00Z'),
    );

    expect(checks.checked(checkOf('failed', '2026-09-30T10:00:00Z'))).toBe(
      checks,
    );
  });

  it('lets a real verdict replace a skipped one for the same stack', () => {
    const skipped = RunChecks.NONE.checked(
      checkOf('skipped', '2026-09-30T10:00:00Z'),
    );
    const passed = skipped.checked(
      checkOf('passed', '2026-09-30T10:00:00Z', 'api', '2026-09-30T10:05:00Z'),
    );

    expect(passed.verdict).toBe('passed');
    expect(passed.checked(checkOf('skipped', '2026-09-30T10:00:00Z'))).toBe(
      passed,
    );
  });

  it('fails the run when one repository fails', () => {
    const checks = RunChecks.NONE.checked(
      checkOf('passed', '2026-09-30T10:00:00Z', 'api'),
    ).checked(checkOf('failed', '2026-09-30T10:00:00Z', 'web'));

    expect(checks.verdict).toBe('failed');
  });

  it('passes the run when no repository fails and one passes', () => {
    const checks = RunChecks.NONE.checked(
      checkOf('skipped', '2026-09-30T10:00:00Z', 'api'),
    ).checked(checkOf('passed', '2026-09-30T10:00:00Z', 'web'));

    expect(checks.verdict).toBe('passed');
  });

  it('refuses two checks for one repository', () => {
    expect(() =>
      RunChecks.of([
        checkOf('passed', '2026-09-30T10:00:00Z'),
        checkOf('failed', '2026-09-30T11:00:00Z'),
      ]),
    ).toThrow('one check for each repository');
  });

  it('takes a repository named in another case as the same repository', () => {
    const checks = RunChecks.NONE.checked(
      checkOf('failed', '2026-09-30T10:00:00Z', 'Acme/API'),
    ).checked(checkOf('passed', '2026-09-30T11:00:00Z', 'acme/api'));

    expect(checks.repositories).toHaveLength(1);
    expect(checks.verdict).toBe('passed');
    expect(() =>
      RunChecks.of([
        checkOf('passed', '2026-09-30T10:00:00Z', 'Acme/API'),
        checkOf('passed', '2026-09-30T10:00:00Z', 'acme/api'),
      ]),
    ).toThrow('one check for each repository');
  });

  it('refuses a check that does not say when its stack started', () => {
    expect(() =>
      RunChecks.NONE.checked({
        ...checkOf('passed', '2026-09-30T10:00:00Z'),
        stackStartedAt: new Date('not a time'),
      }),
    ).toThrow('when its stack started');
  });
});
