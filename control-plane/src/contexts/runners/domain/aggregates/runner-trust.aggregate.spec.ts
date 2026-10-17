import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerTrustKeyFixedError } from '@runners/domain/exceptions/runner-trust-key-fixed.error';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = attributedIn('ws_1');

const ISSUER = 'https://oidc.example.com/cluster';
const SUBJECT = 'system:serviceaccount:spotlight:runner';

const workload = (subject = SUBJECT) =>
  TrustedWorkload.of({ issuer: ISSUER, subject, audience: 'spotlight' });

const defined = () =>
  RunnerTrust.define({
    id: RunnerTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TrustKey.of('production'),
    workload: workload(),
    labels: RunnerLabels.of(['vpc-internal']),
    by: BY,
  });

const persisted = () => {
  const trust = defined();
  trust.pullEvents();
  return trust;
};

const kinds = (trust: RunnerTrust) =>
  trust.pullEvents().map((each) => each.kind);

describe('RunnerTrust', () => {
  it('says it was defined', () => {
    expect(kinds(defined())).toEqual(['runner-trust.defined']);
  });

  it('admits a token from its issuer, for its subject and audience', () => {
    expect(
      persisted().admits({
        issuer: ISSUER,
        subject: SUBJECT,
        audiences: ['sts.amazonaws.com', 'spotlight'],
        named: {},
      }),
    ).toBe(true);
  });

  it('admits no token issued elsewhere, to another workload or for another audience', () => {
    const trust = persisted();

    expect(
      trust.admits({
        issuer: 'https://elsewhere.example.com',
        subject: SUBJECT,
        audiences: ['spotlight'],
        named: {},
      }),
    ).toBe(false);
    expect(
      trust.admits({
        issuer: ISSUER,
        subject: 'system:serviceaccount:default:default',
        audiences: ['spotlight'],
        named: {},
      }),
    ).toBe(false);
    expect(
      trust.admits({
        issuer: ISSUER,
        subject: SUBJECT,
        audiences: ['other'],
        named: {},
      }),
    ).toBe(false);
  });

  it('admits nothing once withdrawn, and says it was withdrawn', () => {
    const withdrawn = persisted().withdraw(BY);

    expect(
      withdrawn.admits({
        issuer: ISSUER,
        subject: SUBJECT,
        audiences: ['spotlight'],
        named: {},
      }),
    ).toBe(false);
    expect(kinds(withdrawn)).toEqual(['runner-trust.withdrawn']);
    expect(() => withdrawn.withdraw(BY)).toThrow(InconsistentStateError);
  });

  it('lets runners start through it only by pulling, and only while it is not withdrawn', () => {
    expect(persisted().capacity('pull')).toBe('open');
    expect(persisted().capacity('push')).toBe('gone');
    expect(persisted().withdraw(BY).capacity('pull')).toBe('gone');
  });

  it('takes another workload and labels under the same key', () => {
    const redefined = persisted().redefinedAs(
      {
        key: TrustKey.of('production'),
        workload: workload('system:serviceaccount:spotlight:other'),
        labels: RunnerLabels.none(),
      },
      BY,
    );

    expect(redefined.workload.subject).toBe(
      'system:serviceaccount:spotlight:other',
    );
    expect(kinds(redefined)).toEqual(['runner-trust.redefined']);
  });

  it('keeps its key for its whole life', () => {
    expect(() =>
      persisted().redefinedAs(
        {
          key: TrustKey.of('staging'),
          workload: workload(),
          labels: RunnerLabels.none(),
        },
        BY,
      ),
    ).toThrow(RunnerTrustKeyFixedError);
  });

  it('rejects a change to a version no longer current', () => {
    expect(() => persisted().assertVersion(3)).toThrow(
      RunnerTrustVersionConflictError,
    );
  });
});
