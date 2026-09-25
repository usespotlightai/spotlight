import { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const POOL_ID = RunnerPoolId.of('pool_1');

const POOL_WORKSPACE = WorkspaceId.of('ws_1');

export const STARTED_AT = new Date('2026-09-24T10:00:00.000Z');

export const hashOf = (character: string): TokenHash =>
  TokenHash.of(character.repeat(64));

export const secretOf = (character: string): ProvisionSecret =>
  ProvisionSecret.of(
    `whsec_${Buffer.from(character.repeat(32)).toString('base64')}`,
  );

export const aPullPool = (
  input: { maxRuns?: number; labels?: string[]; tokenVersion?: number } = {},
): RunnerPool =>
  RunnerPool.define({
    id: POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.of('ephemeral'),
    labels: RunnerLabels.of(input.labels ?? ['linux']),
    maxRuns: input.maxRuns ? MaxRuns.of(input.maxRuns) : null,
    access: {
      mode: 'pull',
      tokenHash: hashOf('a'),
      tokenVersion: input.tokenVersion ?? null,
    },
    by: attributedIn(),
  });

export const aPushPool = (
  input: { maxRuns?: number; labels?: string[] } = {},
): RunnerPool =>
  RunnerPool.define({
    id: POOL_ID,
    workspaceId: POOL_WORKSPACE,
    key: PoolKey.of('sandboxes'),
    labels: RunnerLabels.of(input.labels ?? ['sandbox']),
    maxRuns: input.maxRuns ? MaxRuns.of(input.maxRuns) : null,
    access: {
      mode: 'push',
      url: ProvisionUrl.of('https://provision.example.com/runs'),
      secret: secretOf('s'),
      secretVersion: 1,
    },
    by: attributedIn(),
  });

export const aPoolRunner = (
  input: {
    pool?: RunnerPool;
    id?: string;
    installed?: readonly InstalledHarness[];
    claimWithinMs?: number;
  } = {},
): PoolRunner =>
  PoolRunner.started({
    id: RunnerId.of(input.id ?? 'pooled_1'),
    pool: input.pool ?? aPullPool(),
    tokenHash: hashOf('b'),
    installed: input.installed ?? [],
    at: STARTED_AT,
    claimBy: new Date(STARTED_AT.getTime() + (input.claimWithinMs ?? 60_000)),
  });
