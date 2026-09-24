import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTokenSpentError } from '@runners/domain/exceptions/runner-token-spent.error';
import { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import { refuseTokenHeldElsewhere } from '@runners/domain/services/token-holding';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const BY = attributedIn(WORKSPACE);
const HOLDER = RunnerId.of('runner_1');
const CLAIMANT = RunnerId.of('runner_2');

const holding = () =>
  Runner.enrol({
    id: HOLDER,
    workspaceId: WORKSPACE,
    name: RunnerName.of('build-1'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    by: BY,
  });

describe('refuseTokenHeldElsewhere', () => {
  it('lets a runner take a token no runner has held', () => {
    expect(() => refuseTokenHeldElsewhere(null, CLAIMANT)).not.toThrow();
  });

  it('lets a runner keep the token it holds', () => {
    expect(() => refuseTokenHeldElsewhere(holding(), HOLDER)).not.toThrow();
  });

  it('refuses a token a standing runner holds, as another runner’s', () => {
    expect(() => refuseTokenHeldElsewhere(holding(), CLAIMANT)).toThrow(
      RunnerTokenTakenError,
    );
  });

  it('refuses for good a token a revoked runner held, saying so', () => {
    const revoked = holding().revoke(new Date('2026-09-24T10:00:00Z'), BY);

    expect(() => refuseTokenHeldElsewhere(revoked, CLAIMANT)).toThrow(
      RunnerTokenSpentError,
    );
    expect(new RunnerTokenSpentError().because).toMatch(
      /^was held by a runner that has been revoked and can’t be used again/,
    );
  });
});
