import {
  madeBy,
  problemsIn,
  refinedBy,
} from '@platform/definitions/definition-schema';
import type {
  CompiledPool,
  CompiledTrust,
  CompiledWorkspaceRunners,
  RunnerDefinitionsPort,
} from '@runners/application/ports/runner-definitions.port';
import {
  RUNNER_POOL,
  RUNNER_TRUST,
  WORKSPACE_RUNNERS,
} from '@runners/application/rendering/runner-problems';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolToken } from '@runners/domain/value-objects/pool-token.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { z } from 'zod';

const once = (all: readonly string[], context: z.RefinementCtx) => {
  for (const [at, each] of all.entries()) {
    if (all.indexOf(each) !== at) {
      context.addIssue({
        code: 'custom',
        path: [at],
        message: `gives ${each} twice`,
      });
    }
  }
};

const labels = z
  .array(madeBy((raw) => RunnerLabels.of([raw])))
  .default([])
  .superRefine(once);

const writeOnlyVersion = z
  .number({ error: 'is a whole number that changes to rotate the value' })
  .int('is a whole number that changes to rotate the value')
  .min(0, 'is a whole number that changes to rotate the value')
  .nullish();

const PULL_ONLY =
  'is only for a pool that is pulled from. A pool that provisions has no token. Spotlight calls it instead';

const poolSchema = z
  .object({
    key: madeBy(PoolKey.of),
    labels,
    maxRuns: z
      .number({ error: 'is a whole number of runs' })
      .superRefine(refinedBy(MaxRuns.of))
      .nullish(),
    token: madeBy(PoolToken.of).nullish(),
    tokenVersion: writeOnlyVersion,
    provision: z
      .object({
        url: madeBy(ProvisionUrl.of),
        secret: madeBy(ProvisionSecret.of).nullish(),
        secretVersion: writeOnlyVersion,
      })
      .nullish(),
  })
  .superRefine((pool, context) => {
    if (!pool.provision) {
      return;
    }

    for (const field of ['token', 'tokenVersion'] as const) {
      if (pool[field] !== null && pool[field] !== undefined) {
        context.addIssue({ code: 'custom', path: [field], message: PULL_ONLY });
      }
    }
  });

const trustSchema = z.object({
  key: madeBy(TrustKey.of),
  issuer: madeBy(TrustedWorkload.issuerOf),
  subject: madeBy(TrustedWorkload.subjectOf),
  audience: madeBy(TrustedWorkload.audienceOf).default('spotlight'),
  labels,
});

const workspaceRunnersSchema = z.object({
  trusts: z.array(madeBy(TrustKey.of)).default([]),
  pools: z.array(madeBy(PoolKey.of)).default([]),
});

export class RunnerDefinitions implements RunnerDefinitionsPort {
  trust(held: unknown): CompiledTrust {
    const read = trustSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          key: TrustKey.of(read.data.key),
          workload: TrustedWorkload.of(read.data),
          labels: RunnerLabels.of(read.data.labels),
        }
      : { ok: false, problems: problemsIn(RUNNER_TRUST, read.error) };
  }

  pool(held: unknown): CompiledPool {
    const read = poolSchema.safeParse(held);

    if (!read.success) {
      return { ok: false, problems: problemsIn(RUNNER_POOL, read.error) };
    }

    const { provision } = read.data;

    return {
      ok: true,
      key: PoolKey.of(read.data.key),
      labels: RunnerLabels.of(read.data.labels),
      maxRuns:
        read.data.maxRuns === null || read.data.maxRuns === undefined
          ? null
          : MaxRuns.of(read.data.maxRuns),
      access: provision
        ? {
            mode: 'push',
            url: ProvisionUrl.of(provision.url),
            secret: provision.secret
              ? ProvisionSecret.of(provision.secret)
              : null,
            secretVersion: provision.secretVersion ?? null,
          }
        : {
            mode: 'pull',
            token: read.data.token ? PoolToken.of(read.data.token) : null,
            tokenVersion: read.data.tokenVersion ?? null,
          },
    };
  }

  workspaceRunners(held: unknown): CompiledWorkspaceRunners {
    const read = workspaceRunnersSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          trusts: read.data.trusts.map(TrustKey.of),
          pools: read.data.pools.map(PoolKey.of),
        }
      : { ok: false, problems: problemsIn(WORKSPACE_RUNNERS, read.error) };
  }
}
