import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = attributedIn('ws_1');

const ISSUER = 'https://oidc.example.com/cluster';
const SUBJECT = 'system:serviceaccount:spotlight:runner';

const workload = (subject = SUBJECT) =>
  TrustedWorkload.of({ issuer: ISSUER, subject, audience: 'spotlight' });

const created = () =>
  RunnerTrust.create({
    id: RunnerTrustId.of('trust_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TrustKey.of('production'),
    workload: workload(),
    labels: RunnerLabels.of(['vpc-internal']),
    by: BY,
  });

const persisted = () => {
  const trust = created();
  trust.pullEvents();
  return trust;
};

const kinds = (trust: RunnerTrust) =>
  trust.pullEvents().map((each) => each.kind);

describe('RunnerTrust', () => {
  it('says it was created', () => {
    expect(kinds(created())).toEqual(['runner-trust.created']);
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

  it('admits nothing once deleted, and says it was deleted', () => {
    const deleted = persisted().delete(BY);

    expect(
      deleted.admits({
        issuer: ISSUER,
        subject: SUBJECT,
        audiences: ['spotlight'],
        named: {},
      }),
    ).toBe(false);
    expect(kinds(deleted)).toEqual(['runner-trust.deleted']);
    expect(() => deleted.delete(BY)).toThrow(InconsistentStateError);
  });

  it('lets runners start through it only by pulling, and only while it is not deleted', () => {
    expect(persisted().capacity('pull')).toBe('open');
    expect(persisted().capacity('push')).toBe('gone');
    expect(persisted().delete(BY).capacity('pull')).toBe('gone');
  });

  it('takes another workload and labels under the same key', () => {
    const updated = persisted().update(
      {
        key: TrustKey.of('production'),
        workload: workload('system:serviceaccount:spotlight:other'),
        labels: RunnerLabels.none(),
      },
      BY,
    );

    expect(updated.workload.subject).toBe(
      'system:serviceaccount:spotlight:other',
    );
    expect(kinds(updated)).toEqual(['runner-trust.updated']);
  });

  it('keeps its key for its whole life', () => {
    expect(() =>
      persisted().update(
        {
          key: TrustKey.of('staging'),
          workload: workload(),
          labels: RunnerLabels.none(),
        },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
  });

  it('rejects a change to a version no longer current', () => {
    expect(() => persisted().assertVersion(3)).toThrow(
      RunnerTrustVersionConflictError,
    );
  });
});
